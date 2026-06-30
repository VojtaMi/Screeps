import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "url";
import { dirname } from "path";
import path from "path";
import {
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "fs";
import type { IncomingMessage, ServerResponse } from "http";
import { validateBuildPlans as validateBuildPlansCore } from "./src/plan/validationCore.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = path.resolve(__dirname, "../..");

function parseBuildPlans(source: string) {
  const plans: Record<string, { plan: unknown[] }> = {};
  const roomBlockPattern =
    /"?([WE]\d+[NS]\d+)"?\s*:\s*{\s*"?plan"?\s*:\s*\[([\s\S]*?)\]\s*,?\s*}/g;
  const defaultPlansIndex = source.indexOf("export const DEFAULT_BUILD_PLANS");
  const planText = source.slice(defaultPlansIndex);
  let roomMatch;

  while ((roomMatch = roomBlockPattern.exec(planText))) {
    const [, roomName, itemsText] = roomMatch;
    const items = [];
    const itemPattern = /\{([^{}]+)\}/g;
    let itemMatch;

    while ((itemMatch = itemPattern.exec(itemsText))) {
      const rawItem = itemMatch[1];
      const structureType = rawItem.match(
        /"?structureType"?\s*:\s*"?(STRUCTURE_[A-Z_]+)"?/,
      )?.[1];

      if (!structureType) {
        continue;
      }

      const minRclRaw = rawItem.match(/"?minRcl"?\s*:\s*(\d+)/)?.[1];
      items.push({
        x: Number(rawItem.match(/"?x"?\s*:\s*(\d+)/)?.[1]),
        y: Number(rawItem.match(/"?y"?\s*:\s*(\d+)/)?.[1]),
        structureType,
        purpose: rawItem.match(/"?purpose"?\s*:\s*"([^"]+)"/)?.[1],
        action: rawItem.match(/"?action"?\s*:\s*"(destroy)"/)?.[1] as "destroy" | undefined,
        minRcl: minRclRaw !== undefined ? Number(minRclRaw) : undefined,
      });
    }

    plans[roomName] = { plan: items };
  }

  return plans;
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  data: unknown,
) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(data));
}

interface BuildPlanItem {
  x: number;
  y: number;
  structureType: string;
  purpose?: string;
  action?: "destroy";
  minRcl?: number;
}

// Minimum controller level at which each structure type first becomes placeable.
// Must stay in sync with RCL_STRUCTURE_LIMITS in src/rcl.ts.
const STRUCTURE_MIN_RCL: Record<string, number> = {
  STRUCTURE_SPAWN: 0,
  STRUCTURE_EXTENSION: 2,
  STRUCTURE_CONTAINER: 0,
  STRUCTURE_ROAD: 0,
  STRUCTURE_WALL: 2,
  STRUCTURE_RAMPART: 2,
  STRUCTURE_TOWER: 3,
  STRUCTURE_STORAGE: 4,
  STRUCTURE_LINK: 5,
  STRUCTURE_EXTRACTOR: 6,
  STRUCTURE_TERMINAL: 6,
  STRUCTURE_LAB: 6,
  STRUCTURE_FACTORY: 7,
  STRUCTURE_OBSERVER: 8,
  STRUCTURE_POWER_SPAWN: 8,
  STRUCTURE_NUKER: 8,
};

interface BuildPlansData {
  [roomName: string]: {
    plan: BuildPlanItem[];
  };
}

interface TerrainSnapshot {
  room: string;
  shard: string;
  terrain: string;
}

interface RoomLandmark {
  id: string;
  type: "controller" | "source" | "mineral";
  x: number;
  y: number;
  label?: string;
}

interface LandmarkSnapshot {
  room: string;
  shard: string;
  landmarks: RoomLandmark[];
}

async function fetchRoomTerrain(roomName: string): Promise<TerrainSnapshot> {
  const shard = process.env.SCREEPS_SHARD ?? "shard3";
  const url = new URL("https://screeps.com/api/game/room-terrain");
  url.searchParams.set("room", roomName);
  url.searchParams.set("shard", shard);
  url.searchParams.set("encoded", "1");

  const response = await fetch(url);
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Screeps terrain fetch failed with HTTP ${response.status}: ${responseText}`,
    );
  }

  const result = JSON.parse(responseText);
  if (result.ok !== 1 || !result.terrain?.[0]?.terrain) {
    throw new Error(`Screeps terrain fetch failed: ${responseText}`);
  }

  const terrain = result.terrain[0].terrain;
  if (terrain.length !== 2500) {
    throw new Error(
      `Expected a 2500-character terrain string, got ${terrain.length}.`,
    );
  }

  return { room: roomName, shard, terrain };
}

async function fetchRoomLandmarks(roomName: string): Promise<LandmarkSnapshot> {
  const shard = process.env.SCREEPS_SHARD ?? "shard3";
  const url = new URL("https://screeps.com/api/game/room-objects");
  url.searchParams.set("room", roomName);
  url.searchParams.set("shard", shard);

  const response = await fetch(url);
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Screeps room objects fetch failed with HTTP ${response.status}: ${responseText}`,
    );
  }

  const result = JSON.parse(responseText);
  if (result.ok !== 1 || !Array.isArray(result.objects)) {
    throw new Error(`Screeps room objects fetch failed: ${responseText}`);
  }

  const landmarks = result.objects
    .filter((object: { type?: string }) =>
      ["controller", "source", "mineral", "deposit"].includes(
        object.type ?? "",
      ),
    )
    .map(
      (object: {
        _id?: string;
        type: "controller" | "source" | "mineral" | "deposit";
        x: number;
        y: number;
        mineralType?: string;
        depositType?: string;
      }): RoomLandmark => ({
        id: object._id ?? `${object.type}-${object.x}-${object.y}`,
        type: object.type,
        x: object.x,
        y: object.y,
        label:
          object.type === "mineral"
            ? object.mineralType
            : object.type === "deposit"
              ? object.depositType
              : undefined,
      }),
    );

  return { room: roomName, shard, landmarks };
}

async function readOrFetchTerrain(roomName: string): Promise<TerrainSnapshot> {
  const terrainDir = path.join(root, "tools", "artifacts", "terrain");
  const terrainPath = path.join(terrainDir, `${roomName}.json`);

  try {
    return JSON.parse(readFileSync(terrainPath, "utf8"));
  } catch {
    const terrain = await fetchRoomTerrain(roomName);
    mkdirSync(terrainDir, { recursive: true });
    writeFileSync(terrainPath, `${JSON.stringify(terrain, null, 2)}\n`);
    return terrain;
  }
}

async function readOrFetchLandmarks(
  roomName: string,
): Promise<LandmarkSnapshot> {
  const landmarksDir = path.join(root, "tools", "artifacts", "landmarks");
  const landmarksPath = path.join(landmarksDir, `${roomName}.json`);

  try {
    return JSON.parse(readFileSync(landmarksPath, "utf8"));
  } catch {
    const landmarks = await fetchRoomLandmarks(roomName);
    mkdirSync(landmarksDir, { recursive: true });
    writeFileSync(landmarksPath, `${JSON.stringify(landmarks, null, 2)}\n`);
    return landmarks;
  }
}

function validateBuildPlans(plans: BuildPlansData): string[] {
  const terrains: Record<string, string> = {};

  for (const roomName of Object.keys(plans)) {
    const terrainPath = path.join(
      root,
      "tools",
      "artifacts",
      "terrain",
      `${roomName}.json`,
    );
    try {
      terrains[roomName] =
        JSON.parse(readFileSync(terrainPath, "utf8")).terrain ?? "";
    } catch {
      terrains[roomName] = "";
    }
  }

  return validateBuildPlansCore(plans, terrains).map(
    (error) => `${error.roomName} step ${error.step}: ${error.message}`,
  );
}

function serializeBuildPlans(plans: BuildPlansData): string {
  const header =
    "// Generated by build-plan-editor. Do not edit manually.\n\n" +
    "export interface DefaultBuildPlan {\n" +
    "  plan: RoomBuildPlanItem[];\n" +
    "}\n\n" +
    "export const DEFAULT_BUILD_PLANS: Record<string, DefaultBuildPlan> = ";

  const rooms = Object.entries(plans).map(([roomName, roomPlan]) => {
    const items = roomPlan.plan
      .map((item, index) => {
        // For destroy steps, derive minRcl from the next build step at the same tile.
        // Preserve an existing minRcl when no replacement exists (allows manual override).
        let minRcl = item.minRcl;
        if (item.action === "destroy") {
          const replacement = roomPlan.plan
            .slice(index + 1)
            .find((p) => !p.action && p.x === item.x && p.y === item.y);
          if (replacement) {
            minRcl = STRUCTURE_MIN_RCL[replacement.structureType];
          }
        }

        if (item.purpose || item.action || minRcl !== undefined) {
          const lines = [
            "      {",
            `        x: ${item.x},`,
            `        y: ${item.y},`,
            `        structureType: ${item.structureType},`,
          ];
          if (item.purpose) lines.push(`        purpose: ${JSON.stringify(item.purpose)},`);
          if (item.action) lines.push(`        action: ${JSON.stringify(item.action)},`);
          if (minRcl !== undefined) lines.push(`        minRcl: ${minRcl},`);
          lines.push("      },");
          return lines.join("\n");
        }

        return `      { x: ${item.x}, y: ${item.y}, structureType: ${item.structureType} },`;
      })
      .join("\n");

    return `  ${roomName}: {\n    plan: [\n${items}\n    ],\n  },`;
  });

  return `${header}{\n${rooms.join("\n")}\n};\n`;
}

function buildPlanApiPlugin() {
  return {
    name: "build-plan-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        if (!request.url?.startsWith("/api/")) {
          next();
          return;
        }

        try {
          const url = new URL(request.url, "http://localhost");

          if (request.method === "GET" && url.pathname === "/api/build-plans") {
            const source = readFileSync(
              path.join(root, "src", "buildPlans.ts"),
              "utf8",
            );
            const terrainDir = path.join(root, "tools", "artifacts", "terrain");
            let availableTerrains: string[] = [];

            try {
              availableTerrains = readdirSync(terrainDir)
                .filter((fileName) => fileName.endsWith(".json"))
                .map((fileName) => fileName.replace(".json", ""));
            } catch {
              availableTerrains = [];
            }

            sendJson(response, 200, {
              plans: parseBuildPlans(source),
              availableTerrains,
            });
            return;
          }

          if (
            request.method === "POST" &&
            url.pathname === "/api/build-plans"
          ) {
            const body = JSON.parse(await readRequestBody(request));
            const errors = validateBuildPlans(body.plans);

            if (errors.length > 0) {
              sendJson(response, 400, { error: errors.join("; "), errors });
              return;
            }

            writeFileSync(
              path.join(root, "src", "buildPlans.ts"),
              serializeBuildPlans(body.plans),
            );
            sendJson(response, 200, { success: true });
            return;
          }

          const terrainMatch = url.pathname.match(/^\/api\/terrain\/([^/]+)$/);
          if (request.method === "GET" && terrainMatch) {
            const terrain = await readOrFetchTerrain(terrainMatch[1]);
            sendJson(response, 200, terrain);
            return;
          }

          const landmarksMatch = url.pathname.match(
            /^\/api\/landmarks\/([^/]+)$/,
          );
          if (request.method === "GET" && landmarksMatch) {
            const landmarks = await readOrFetchLandmarks(landmarksMatch[1]);
            sendJson(response, 200, landmarks);
            return;
          }

          sendJson(response, 404, { error: "Not found" });
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), buildPlanApiPlugin()],
  build: {
    outDir: path.join(root, "tools", "artifacts", "editor"),
    emptyOutDir: true,
  },
});
