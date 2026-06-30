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
import {
  type BuildPlansData,
  serializeBuildPlansToTypeScript,
  withDerivedBuildPlanFields,
} from "../../shared/buildPlans";
import { validateBuildPlans as validateBuildPlansCore } from "./src/plan/validationCore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const root = path.resolve(__dirname, "../..");
const buildPlansJsonPath = path.join(root, "src", "buildPlans.json");
const buildPlansTsPath = path.join(root, "src", "buildPlans.ts");

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

function readBuildPlans(): BuildPlansData {
  return JSON.parse(readFileSync(buildPlansJsonPath, "utf8")) as BuildPlansData;
}

function writeBuildPlans(plans: BuildPlansData): void {
  const normalizedPlans = withDerivedBuildPlanFields(plans);
  writeFileSync(
    buildPlansJsonPath,
    `${JSON.stringify(normalizedPlans, null, 2)}\n`,
  );
  writeFileSync(buildPlansTsPath, serializeBuildPlansToTypeScript(plans));
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
              plans: readBuildPlans(),
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

            writeBuildPlans(body.plans);
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
