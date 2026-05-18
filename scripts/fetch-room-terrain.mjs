import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const roomName = process.argv[2] ?? "E59S28";
const shard = process.argv[3] ?? process.env.SCREEPS_SHARD ?? "shard3";
const outputDir = path.join(process.cwd(), "artifacts", "terrain");
const outputPath = path.join(outputDir, `${roomName}.json`);

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

await mkdir(outputDir, { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ room: roomName, shard, terrain }, null, 2)}\n`,
);

console.log(`Saved ${roomName} ${shard} terrain to ${path.relative(process.cwd(), outputPath)}`);
