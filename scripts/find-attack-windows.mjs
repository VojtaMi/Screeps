#!/usr/bin/env node

import { readdirSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_HOST = "https://screeps.com";
const DEFAULT_SHARD = "shard3";
const DEFAULT_LOOKBACK = 20000;
const DEFAULT_LIMIT = 5;
const DEFAULT_LOOKAHEAD = 5;
const ROOM_ARTIFACT_DIR = "tools/artifacts/landmarks";

const OWNED_STRUCTURE_TYPES = new Set([
  "constructedWall",
  "container",
  "extension",
  "extractor",
  "factory",
  "lab",
  "link",
  "nuker",
  "observer",
  "powerSpawn",
  "rampart",
  "road",
  "spawn",
  "storage",
  "terminal",
  "tower",
]);

const MAJOR_STRUCTURE_TYPES = new Set([
  "container",
  "extension",
  "extractor",
  "factory",
  "lab",
  "link",
  "nuker",
  "observer",
  "powerSpawn",
  "rampart",
  "spawn",
  "storage",
  "terminal",
  "tower",
]);

const COMBAT_PARTS = new Set(["attack", "ranged_attack", "heal", "tough"]);

function printUsage() {
  console.log(`Usage:
  node scripts/find-attack-windows.mjs [--rooms E58S28,E59S28] [options]

Options:
  --room <name>           Single room to scan
  --rooms <list>          Comma list of rooms. Defaults to landmark artifact rooms
  --shard <name>          Shard name, default ${DEFAULT_SHARD}
  --host <url>            Screeps host, default ${DEFAULT_HOST}
  --from <tick>           Oldest tick to scan. Defaults to --to - --lookback
  --to <tick>             Newest tick to scan. Defaults to live room-object estimate
  --lookback <ticks>      Scan this far backward when --from is omitted, default ${DEFAULT_LOOKBACK}
  --limit <count>         Stop after this many incident windows, default ${DEFAULT_LIMIT}
  --lookahead <ticks>     Extra ticks for delayed ruins/tombstones, default ${DEFAULT_LOOKAHEAD}
  --include-roads         Include road and constructedWall ruins as structure losses
  --json                  Emit JSON instead of text
  --help                  Show this message`);
}

function parseArgs(argv) {
  const args = {
    shard: DEFAULT_SHARD,
    host: DEFAULT_HOST,
    lookback: DEFAULT_LOOKBACK,
    limit: DEFAULT_LIMIT,
    lookahead: DEFAULT_LOOKAHEAD,
    includeRoads: false,
    json: false,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }
    if (arg === "--json") {
      args.json = true;
      continue;
    }
    if (arg === "--include-roads") {
      args.includeRoads = true;
      continue;
    }
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }

    i += 1;
    if (arg === "--room") args.rooms = [value];
    else if (arg === "--rooms") args.rooms = value.split(",").filter(Boolean);
    else if (arg === "--shard") args.shard = value;
    else if (arg === "--host") args.host = value.replace(/\/$/, "");
    else if (arg === "--from") args.from = Number(value);
    else if (arg === "--to") args.to = Number(value);
    else if (arg === "--lookback") args.lookback = Number(value);
    else if (arg === "--limit") args.limit = Number(value);
    else if (arg === "--lookahead") args.lookahead = Number(value);
    else throw new Error(`Unknown argument: ${arg}`);
  }

  if (args.help) return args;
  if (!Number.isInteger(args.lookback) || args.lookback <= 0) {
    throw new Error("--lookback must be a positive integer");
  }
  if (!Number.isInteger(args.limit) || args.limit <= 0) {
    throw new Error("--limit must be a positive integer");
  }
  if (!Number.isInteger(args.lookahead) || args.lookahead < 0) {
    throw new Error("--lookahead must be a non-negative integer");
  }
  if (args.from !== undefined && !Number.isInteger(args.from)) {
    throw new Error("--from must be an integer tick");
  }
  if (args.to !== undefined && !Number.isInteger(args.to)) {
    throw new Error("--to must be an integer tick");
  }

  return args;
}

function defaultRooms() {
  try {
    return readdirSync(ROOM_ARTIFACT_DIR)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => fileName.replace(/\.json$/, ""))
      .sort();
  } catch {
    return [];
  }
}

function historyBase(tick) {
  return Math.floor(tick / 100) * 100;
}

function isNumericKey(key) {
  return String(Number(key)) === key;
}

function clone(value) {
  if (Array.isArray(value)) return value.map((item) => clone(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, clone(item)]),
    );
  }
  return value;
}

function mergeValue(current, patch) {
  if (patch === null || typeof patch !== "object") return patch;

  if (Array.isArray(current) && Object.keys(patch).every(isNumericKey)) {
    const next = current.map((item) => clone(item));
    for (const [key, value] of Object.entries(patch)) {
      next[Number(key)] = mergeValue(next[Number(key)], value);
    }
    return next;
  }

  const next =
    current && typeof current === "object" && !Array.isArray(current)
      ? clone(current)
      : {};

  for (const [key, value] of Object.entries(patch)) {
    next[key] = mergeValue(next[key], value);
  }

  return next;
}

function applyTickPatch(state, patch) {
  if (!patch || typeof patch !== "object") return;

  for (const [id, objectPatch] of Object.entries(patch)) {
    if (objectPatch === null) delete state[id];
    else state[id] = mergeValue(state[id], objectPatch);
  }
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "accept-encoding": "gzip, deflate, br" },
  });

  if (!response.ok) {
    const error = new Error(`Failed to fetch ${url}: ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

function estimateCurrentTick(objects) {
  const estimates = objects
    .filter(
      (object) =>
        object.type === "source" &&
        Number.isInteger(object.nextRegenerationTime) &&
        Number.isInteger(object.ticksToRegeneration),
    )
    .map((source) => source.nextRegenerationTime - source.ticksToRegeneration);

  return estimates.length > 0 ? Math.max(...estimates) : null;
}

async function inferToTick(args, rooms) {
  if (args.to !== undefined) return args.to;

  const estimates = [];
  for (const room of rooms) {
    try {
      const url = `${args.host}/api/game/room-objects?room=${room}&shard=${args.shard}`;
      const response = await fetchJson(url);
      const estimate = estimateCurrentTick(response.objects ?? []);
      if (estimate !== null) estimates.push(estimate);
    } catch (error) {
      console.error(`Could not estimate current tick from ${room}: ${error.message}`);
    }
  }

  if (estimates.length === 0) {
    throw new Error("Could not infer --to tick; pass --to explicitly");
  }

  return Math.max(...estimates);
}

function position(object) {
  return `${object.x},${object.y}`;
}

function findOwner(objects, explicitOwner) {
  if (explicitOwner) return explicitOwner;
  const controller = objects.find((object) => object.type === "controller");
  return controller?.user;
}

function isOwnedStructureLoss(ruin, owner, includeRoads) {
  const structureType = ruin.structure?.type;
  if (!OWNED_STRUCTURE_TYPES.has(structureType)) return false;
  if (!includeRoads && !MAJOR_STRUCTURE_TYPES.has(structureType)) return false;

  const structureUser = ruin.structure?.user ?? ruin.user;
  return !structureUser || !owner || structureUser === owner;
}

function isOwnedCreepDeath(tombstone, owner) {
  return !owner || tombstone.creepUser === owner || tombstone.user === owner;
}

function isDefenderDeath(tombstone) {
  if (tombstone.creepName?.startsWith("defender-")) return true;
  if (!Array.isArray(tombstone.creepBody)) return false;
  return tombstone.creepBody.some((part) =>
    COMBAT_PARTS.has(typeof part === "string" ? part : part.type),
  );
}

function countHostiles(objects, owner) {
  let total = 0;
  let combat = 0;
  for (const object of objects) {
    if (object.type !== "creep" || object.user === owner) continue;
    total += 1;
    const actionLog = object.actionLog ?? {};
    const usedCombatAction =
      actionLog.attack ||
      actionLog.rangedAttack ||
      actionLog.rangedMassAttack ||
      actionLog.heal ||
      actionLog.rangedHeal;
    const body = Array.isArray(object.body) ? object.body : [];
    const hasCombatBody = body.some((part) => {
        const type = typeof part === "string" ? part : part.type;
        const hits = typeof part === "string" ? 100 : (part.hits ?? 100);
        return COMBAT_PARTS.has(type) && hits > 0;
      });

    if (usedCombatAction || hasCombatBody) {
      combat += 1;
    }
  }
  return { total, combat };
}

function shortStore(store) {
  if (!store || Object.keys(store).length === 0) return "{}";
  return `{${Object.entries(store)
    .map(([resource, amount]) => `${resource}:${amount}`)
    .join(",")}}`;
}

function recordIncident(incidents, incident) {
  const existing = incidents.find(
    (item) =>
      item.tick === incident.tick &&
      item.room === incident.room &&
      item.kind === incident.kind &&
      item.label === incident.label &&
      item.pos === incident.pos,
  );

  if (!existing) incidents.push(incident);
}

function collectIncidents(context) {
  const { args, room, tick, state, owner, from, to, incidents, emitted } = context;
  const objects = Object.values(state);
  const hostiles = countHostiles(objects, owner);

  for (const object of objects) {
    if (
      object.type === "ruin" &&
      object.destroyTime &&
      object.destroyTime >= from &&
      object.destroyTime <= to &&
      object.destroyTime <= tick &&
      isOwnedStructureLoss(object, owner, args.includeRoads)
    ) {
      const key = `ruin:${object._id}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      recordIncident(incidents, {
        room,
        tick: object.destroyTime,
        observed: tick,
        kind: "structure",
        label: object.structure?.type ?? "structure",
        pos: position(object),
        store: shortStore(object.store),
        hostileCreeps: hostiles.total,
        hostileCombatCreeps: hostiles.combat,
      });
    }

    if (
      object.type === "tombstone" &&
      object.deathTime &&
      object.deathTime >= from &&
      object.deathTime <= to &&
      object.deathTime <= tick &&
      isOwnedCreepDeath(object, owner) &&
      isDefenderDeath(object)
    ) {
      const key = `death:${object._id}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      recordIncident(incidents, {
        room,
        tick: object.deathTime,
        observed: tick,
        kind: "defenderDeath",
        label: object.creepName ?? "creep",
        pos: position(object),
        store: shortStore(object.store),
        hostileCreeps: hostiles.total,
        hostileCombatCreeps: hostiles.combat,
      });
    }
  }
}

function groupIncidents(incidents, sightings = []) {
  const sorted = [...incidents].sort((a, b) => b.tick - a.tick);
  const windows = [];

  for (const incident of sorted) {
    const latestWindow = windows.at(-1);
    if (
      latestWindow &&
      latestWindow.room === incident.room &&
      latestWindow.from - incident.tick <= 100
    ) {
      latestWindow.from = Math.min(latestWindow.from, incident.tick);
      latestWindow.to = Math.max(latestWindow.to, incident.tick);
      latestWindow.incidents.push(incident);
      latestWindow.hostileCombatCreeps = Math.max(
        latestWindow.hostileCombatCreeps,
        incident.hostileCombatCreeps,
      );
      latestWindow.hostileCreeps = Math.max(
        latestWindow.hostileCreeps,
        incident.hostileCreeps,
      );
      continue;
    }

    windows.push({
      room: incident.room,
      from: incident.tick,
      to: incident.tick,
      hostileCreeps: 0,
      hostileCombatCreeps: 0,
      incidents: [incident],
    });
  }

  for (const window of windows) {
    for (const sighting of sightings) {
      if (
        sighting.room !== window.room ||
        sighting.tick < window.from - 50 ||
        sighting.tick > window.to + 50
      ) {
        continue;
      }

      window.hostileCreeps = Math.max(window.hostileCreeps, sighting.total);
      window.hostileCombatCreeps = Math.max(
        window.hostileCombatCreeps,
        sighting.combat,
      );
    }
  }

  return windows;
}

async function scanRoom(args, room, from, to) {
  const incidents = [];
  const sightings = [];
  const emitted = new Set();
  const readThrough = to + args.lookahead;
  let owner;

  for (let base = historyBase(to); base >= historyBase(from); base -= 100) {
    let window;
    try {
      const url = `${args.host}/room-history/${args.shard}/${room}/${base}.json`;
      window = await fetchJson(url);
    } catch (error) {
      if (error.status === 404) continue;
      throw error;
    }

    const state = {};
    const tickEntries = Object.entries(window.ticks).sort(
      ([a], [b]) => Number(a) - Number(b),
    );

    for (const [tickText, patch] of tickEntries) {
      const tick = Number(tickText);
      if (tick > readThrough) break;

      applyTickPatch(state, patch);
      const objects = Object.values(state);
      owner = findOwner(objects, owner);
      const hostiles = countHostiles(objects, owner);
      if (hostiles.total > 0) {
        sightings.push({ room, tick, ...hostiles });
      }

      if (tick < from) continue;
      collectIncidents({
        args,
        room,
        tick,
        state,
        owner,
        from,
        to,
        incidents,
        emitted,
      });
    }

    const windows = groupIncidents(incidents, sightings);
    if (windows.length >= args.limit) {
      const oldestLimitedWindow = windows.slice(0, args.limit).at(-1);
      if (oldestLimitedWindow && base <= historyBase(oldestLimitedWindow.from - 100)) {
        break;
      }
    }
  }

  return {
    room,
    owner,
    incidents: incidents.sort((a, b) => b.tick - a.tick),
    windows: groupIncidents(incidents, sightings).slice(0, args.limit),
  };
}

function renderText(report) {
  const lines = [
    `Attack window search ${report.shard} ticks ${report.from}-${report.to}`,
    `Rooms: ${report.rooms.join(", ")}`,
  ];

  for (const roomReport of report.roomsScanned) {
    lines.push("");
    lines.push(`ROOM ${roomReport.room} owner=${roomReport.owner ?? "unknown"}`);

    if (roomReport.windows.length === 0) {
      lines.push("  no defender deaths or major owned structure ruins found");
      continue;
    }

    for (const window of roomReport.windows) {
      lines.push(
        `  ${window.from}-${window.to} hostiles=${window.hostileCreeps} combat=${window.hostileCombatCreeps}`,
      );
      for (const incident of window.incidents.sort((a, b) => a.tick - b.tick)) {
        lines.push(
          `    ${incident.tick} ${incident.kind} ${incident.label}@${incident.pos} observed=${incident.observed} store=${incident.store}`,
        );
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printUsage();
    return;
  }

  const rooms = args.rooms?.length ? args.rooms : defaultRooms();
  if (rooms.length === 0) {
    throw new Error(
      `No rooms provided and no ${join(ROOM_ARTIFACT_DIR, "*.json")} files found`,
    );
  }

  const to = await inferToTick(args, rooms);
  const from = args.from ?? to - args.lookback;
  if (from > to) throw new Error("--from must be <= --to");

  const roomsScanned = [];
  for (const room of rooms) {
    roomsScanned.push(await scanRoom(args, room, from, to));
  }

  const report = {
    shard: args.shard,
    from,
    to,
    rooms,
    roomsScanned,
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else process.stdout.write(renderText(report));
}

main().catch((error) => {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
});
