#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath } from "node:url";
import { inspectTile } from "../tools/build-plan-editor/src/plan/validationCore.mjs";
import { loadTerrain, readBuildPlans } from "./lib/build-plan-files.mjs";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");

function usage() {
  console.log(`Usage:
  node scripts/inspect-tile.mjs <room> <x> <y> [--json] [--no-live] [--shard shard3]

Examples:
  node scripts/inspect-tile.mjs E59S29 37 5
  node scripts/inspect-tile.mjs E59S29 13 9 --json
  node scripts/inspect-tile.mjs E59S29 37 5 --no-live`);
}

function parseArgs(args) {
  const positional = [];
  const options = {
    json: false,
    live: true,
    shard: process.env.SCREEPS_SHARD ?? "shard3",
  };

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      return { help: true };
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--no-live") {
      options.live = false;
      continue;
    }
    if (arg === "--shard") {
      options.shard = args[i + 1];
      i += 1;
      continue;
    }
    positional.push(arg);
  }

  const [roomName, rawX, rawY] = positional;
  return {
    ...options,
    roomName,
    x: Number(rawX),
    y: Number(rawY),
    valid: positional.length === 3,
  };
}

async function fetchRoomObjects(roomName, shard) {
  const url = new URL("https://screeps.com/api/game/room-objects");
  url.searchParams.set("room", roomName);
  url.searchParams.set("shard", shard);

  const response = await fetch(url);
  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(
      `Screeps room object fetch failed with HTTP ${response.status}: ${responseText}`,
    );
  }

  const result = JSON.parse(responseText);
  if (result.ok !== 1 || !Array.isArray(result.objects)) {
    throw new Error(`Screeps room object fetch failed: ${responseText}`);
  }

  return result.objects;
}

function pickStore(object) {
  if (!object.store || Object.keys(object.store).length === 0) {
    return undefined;
  }
  return object.store;
}

function summarizeLiveObjects(objects, x, y) {
  const tileObjects = objects.filter((object) => object.x === x && object.y === y);
  const summary = {
    structures: [],
    constructionSites: [],
    creeps: [],
    landmarks: [],
    resources: [],
    other: [],
  };

  for (const object of tileObjects) {
    if (object.type === "creep") {
      summary.creeps.push({
        name: object.name,
        store: pickStore(object),
        bodyParts: object.body?.length,
        hits: object.hits,
        hitsMax: object.hitsMax,
      });
      continue;
    }

    if (object.type === "constructionSite") {
      summary.constructionSites.push({
        structureType: object.structureType,
        progress: object.progress,
        progressTotal: object.progressTotal,
      });
      continue;
    }

    if (["controller", "source", "mineral", "deposit"].includes(object.type)) {
      summary.landmarks.push({
        type: object.type,
        id: object._id,
        level: object.level,
        mineralType: object.mineralType,
        depositType: object.depositType,
        energy: object.energy,
        energyCapacity: object.energyCapacity,
      });
      continue;
    }

    if (object.type === "energy" || object.type === "resource") {
      summary.resources.push({
        type: object.type,
        resourceType: object.resourceType,
        amount: object.amount,
      });
      continue;
    }

    if (object.hitsMax || object.store || object.type === "spawn") {
      summary.structures.push({
        type: object.type,
        name: object.name,
        hits: object.hits,
        hitsMax: object.hitsMax,
        store: pickStore(object),
      });
      continue;
    }

    summary.other.push({
      type: object.type,
      id: object._id,
    });
  }

  return summary;
}

function liveLandmarks(objects) {
  return objects
    .filter((object) =>
      ["controller", "source", "mineral", "deposit"].includes(object.type),
    )
    .map((object) => ({
      id: object._id ?? `${object.type}-${object.x}-${object.y}`,
      type: object.type,
      x: object.x,
      y: object.y,
      label: object.mineralType ?? object.depositType,
    }));
}

function buildTileReport({ roomName, x, y, shard, plans, terrain, liveObjects }) {
  const plan = plans[roomName]?.plan ?? [];
  const inspection = inspectTile({
    roomName,
    x,
    y,
    plan,
    terrain,
    currentStep: plan.length,
    landmarks: liveObjects ? liveLandmarks(liveObjects) : [],
  });

  return {
    ...inspection,
    shard,
    live: liveObjects ? summarizeLiveObjects(liveObjects, x, y) : null,
  };
}

function printSection(label, rows, render) {
  if (rows.length === 0) {
    console.log(`${label}: none`);
    return;
  }

  console.log(`${label}:`);
  for (const row of rows) {
    console.log(`  - ${render(row)}`);
  }
}

function printReport(report, liveError) {
  console.log(`${report.room} ${report.x},${report.y} (${report.shard})`);
  console.log(`terrain: ${report.terrain}`);
  console.log(`edge: ${report.isEdge ? "yes" : "no"}`);

  printSection(
    "planned",
    report.planned,
    (item) =>
      `step ${item.step}: ${item.structureType}${item.purpose ? ` (${item.purpose})` : ""}`,
  );
  printSection("validation", report.validation, (error) => error.message);
  printSection(
    "landmarks",
    report.landmarks,
    (item) =>
      `${landmarkLabel(item.type)}${item.label ? ` (${item.label})` : ""}`,
  );

  if (liveError) {
    console.log(`live: unavailable - ${liveError.message}`);
    return;
  }

  if (!report.live) {
    console.log("live: skipped");
    return;
  }

  printSection(
    "structures",
    report.live.structures,
    (item) =>
      `${item.type}${item.name ? ` ${item.name}` : ""}${
        item.hitsMax ? ` ${item.hits}/${item.hitsMax}` : ""
      }`,
  );
  printSection(
    "construction sites",
    report.live.constructionSites,
    (item) => `${item.structureType} ${item.progress}/${item.progressTotal}`,
  );
  printSection(
    "creeps",
    report.live.creeps,
    (item) =>
      `${item.name}${item.bodyParts ? ` ${item.bodyParts} parts` : ""}${
        item.store ? ` store=${JSON.stringify(item.store)}` : ""
      }`,
  );
  printSection(
    "resources",
    report.live.resources,
    (item) => `${item.resourceType ?? item.type} ${item.amount}`,
  );
  printSection("other", report.live.other, (item) => item.type);
}

function landmarkLabel(type) {
  if (type === "controller") return "room controller";
  if (type === "source") return "energy source";
  if (type === "mineral") return "mineral deposit";
  if (type === "deposit") return "deposit";
  return type;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.help) {
    usage();
    return;
  }

  if (
    !options.valid ||
    !Number.isInteger(options.x) ||
    !Number.isInteger(options.y)
  ) {
    usage();
    process.exitCode = 2;
    return;
  }

  const plans = readBuildPlans(root);
  if (!plans[options.roomName]) {
    console.error(`Unknown build plan room: ${options.roomName}`);
    process.exitCode = 2;
    return;
  }

  const terrain = loadTerrain(root, options.roomName);
  let liveObjects = null;
  let liveError = null;

  if (options.live) {
    try {
      liveObjects = await fetchRoomObjects(options.roomName, options.shard);
    } catch (error) {
      liveError = error;
    }
  }

  const report = buildTileReport({
    roomName: options.roomName,
    x: options.x,
    y: options.y,
    shard: options.shard,
    plans,
    terrain,
    liveObjects,
  });

  if (options.json) {
    console.log(JSON.stringify({ ...report, liveError: liveError?.message }, null, 2));
    return;
  }

  printReport(report, liveError);
}

main();
