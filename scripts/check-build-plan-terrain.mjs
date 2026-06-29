#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateBuildPlans } from "../tools/build-plan-editor/src/plan/validationCore.mjs";
import { loadTerrain, readBuildPlans } from "./lib/build-plan-files.mjs";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");

function usage() {
  console.log(`Usage:
  node scripts/check-build-plan-terrain.mjs [room]

Examples:
  node scripts/check-build-plan-terrain.mjs E59S29
  node scripts/check-build-plan-terrain.mjs`);
}

function main() {
  const [roomName, extra] = process.argv.slice(2);

  if (roomName === "--help" || roomName === "-h") {
    usage();
    return;
  }

  if (extra) {
    usage();
    process.exitCode = 2;
    return;
  }

  const allPlans = readBuildPlans(root);
  const selectedPlans = roomName
    ? { [roomName]: allPlans[roomName] }
    : allPlans;

  if (roomName && !selectedPlans[roomName]) {
    console.error(`Unknown build plan room: ${roomName}`);
    process.exitCode = 2;
    return;
  }

  const terrains = Object.fromEntries(
    Object.keys(selectedPlans).map((room) => [room, loadTerrain(root, room)]),
  );
  const missingTerrainRooms = Object.entries(terrains)
    .filter(([, terrain]) => !terrain)
    .map(([room]) => room);
  const errors = validateBuildPlans(selectedPlans, terrains);

  for (const room of missingTerrainRooms) {
    console.warn(`WARN ${room}: missing cached terrain; natural wall checks skipped`);
  }

  if (errors.length === 0) {
    const roomLabel = roomName ?? `${Object.keys(selectedPlans).length} room(s)`;
    console.log(`OK build plan validation passed for ${roomLabel}`);
    return;
  }

  for (const error of errors) {
    const item = selectedPlans[error.roomName]?.plan[error.step];
    const location = item ? `${item.structureType} at ${item.x},${item.y}` : "";
    console.log(
      `${error.roomName} step ${error.step}: ${location} - ${error.message}`,
    );
  }

  process.exitCode = 1;
}

main();
