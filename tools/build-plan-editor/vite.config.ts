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

      items.push({
        x: Number(rawItem.match(/"?x"?\s*:\s*(\d+)/)?.[1]),
        y: Number(rawItem.match(/"?y"?\s*:\s*(\d+)/)?.[1]),
        structureType,
        purpose: rawItem.match(/"?purpose"?\s*:\s*"([^"]+)"/)?.[1],
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
}

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
      ["controller", "source", "mineral"].includes(object.type ?? ""),
    )
    .map(
      (object: {
        _id?: string;
        type: "controller" | "source" | "mineral";
        x: number;
        y: number;
        mineralType?: string;
      }): RoomLandmark => ({
        id: object._id ?? `${object.type}-${object.x}-${object.y}`,
        type: object.type,
        x: object.x,
        y: object.y,
        label: object.type === "mineral" ? object.mineralType : undefined,
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

function validateSameTile(types: string[]): boolean {
  if (types.length === 1) {
    return true;
  }

  const sortedTypes = [...types].sort();
  const hasRampart = sortedTypes.includes("STRUCTURE_RAMPART");
  const withoutRampart = sortedTypes.filter(
    (type) => type !== "STRUCTURE_RAMPART",
  );

  if (hasRampart && withoutRampart.length === sortedTypes.length - 1) {
    return validateSameTile(withoutRampart);
  }

  return (
    sortedTypes.length === 2 &&
    sortedTypes[0] === "STRUCTURE_CONTAINER" &&
    sortedTypes[1] === "STRUCTURE_ROAD"
  );
}

function validateBuildPlans(plans: BuildPlansData): string[] {
  const errors: string[] = [];

  for (const [roomName, roomPlan] of Object.entries(plans)) {
    const terrainPath = path.join(
      root,
      "tools",
      "artifacts",
      "terrain",
      `${roomName}.json`,
    );
    let terrain = "";

    try {
      terrain = JSON.parse(readFileSync(terrainPath, "utf8")).terrain ?? "";
    } catch {
      terrain = "";
    }

    for (const [index, item] of roomPlan.plan.entries()) {
      if (!Number.isInteger(item.x) || item.x < 0 || item.x > 49) {
        errors.push(`${roomName} step ${index}: invalid x coordinate`);
      }

      if (!Number.isInteger(item.y) || item.y < 0 || item.y > 49) {
        errors.push(`${roomName} step ${index}: invalid y coordinate`);
      }

      if (
        terrain &&
        Number(terrain[item.y * 50 + item.x] ?? 0) & 1 &&
        item.structureType !== "STRUCTURE_ROAD"
      ) {
        errors.push(
          `${roomName} step ${index}: only roads may be placed on natural walls`,
        );
      }
    }

    const byTile = new Map<string, BuildPlanItem[]>();
    for (const item of roomPlan.plan) {
      const key = `${item.x},${item.y}`;
      byTile.set(key, [...(byTile.get(key) ?? []), item]);
    }

    for (const [tile, items] of byTile) {
      const types = items.map((item) => item.structureType);
      if (new Set(types).size !== types.length) {
        errors.push(`${roomName} ${tile}: duplicate structure type`);
      }

      if (!validateSameTile(types)) {
        errors.push(`${roomName} ${tile}: invalid same-tile combination`);
      }
    }
  }

  return errors;
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
      .map((item) => {
        if (item.purpose) {
          return [
            "      {",
            `        x: ${item.x},`,
            `        y: ${item.y},`,
            `        structureType: ${item.structureType},`,
            `        purpose: ${JSON.stringify(item.purpose)},`,
            "      },",
          ].join("\n");
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
