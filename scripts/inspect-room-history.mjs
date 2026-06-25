#!/usr/bin/env node

const DEFAULT_HOST = "https://screeps.com";
const DEFAULT_EVENTS = [
  "summary",
  "ruins",
  "deaths",
  "hostiles",
  "friendly",
  "structures",
];
const DEFAULT_OBSERVATION_LAG = 5;

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

function printUsage() {
  console.log(`Usage:
  node scripts/inspect-room-history.mjs --room E58S28 --from 81080300 --to 81080499 [options]

Options:
  --shard <name>          Shard name, default shard3
  --host <url>            Screeps host, default ${DEFAULT_HOST}
  --owner <user-id>       Owned user id. Defaults to controller owner from history
  --events <list>         Comma list: summary,ruins,deaths,hostiles,friendly,structures,all
  --every <ticks>         Print periodic summary every N ticks
  --ticks <list>          Comma list of exact ticks to summarize
  --lookahead <ticks>     Extra ticks to read for delayed ruins/tombstones, default ${DEFAULT_OBSERVATION_LAG}
  --json                  Emit JSON instead of text
  --help                  Show this message`);
}

function parseArgs(argv) {
  const args = {
    shard: "shard3",
    host: DEFAULT_HOST,
    events: DEFAULT_EVENTS,
    every: 25,
    ticks: [],
    json: false,
    lookahead: DEFAULT_OBSERVATION_LAG,
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

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }

    i += 1;
    if (arg === "--room") args.room = value;
    else if (arg === "--shard") args.shard = value;
    else if (arg === "--host") args.host = value.replace(/\/$/, "");
    else if (arg === "--from") args.from = Number(value);
    else if (arg === "--to") args.to = Number(value);
    else if (arg === "--owner") args.owner = value;
    else if (arg === "--every") args.every = Number(value);
    else if (arg === "--lookahead") args.lookahead = Number(value);
    else if (arg === "--ticks") {
      args.ticks = value
        .split(",")
        .filter(Boolean)
        .map((tick) => Number(tick));
    } else if (arg === "--events") {
      args.events = value.split(",").filter(Boolean);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.help) return args;
  if (!args.room) throw new Error("--room is required");
  if (!Number.isInteger(args.from)) throw new Error("--from tick is required");
  if (!Number.isInteger(args.to)) throw new Error("--to tick is required");
  if (args.from > args.to) throw new Error("--from must be <= --to");
  if (!Number.isInteger(args.every) || args.every < 0) {
    throw new Error("--every must be a non-negative integer");
  }
  if (!Number.isInteger(args.lookahead) || args.lookahead < 0) {
    throw new Error("--lookahead must be a non-negative integer");
  }

  if (args.events.includes("all")) {
    args.events = DEFAULT_EVENTS;
  }

  return args;
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

  if (Array.isArray(patch)) return patch.map((item) => clone(item));

  if (Array.isArray(current) && Object.keys(patch).every(isNumericKey)) {
    const next = current.map((item) => clone(item));
    for (const [key, value] of Object.entries(patch)) {
      const index = Number(key);
      next[index] = mergeValue(next[index], value);
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
  for (const [id, objectPatch] of Object.entries(patch)) {
    if (objectPatch === null) {
      delete state[id];
    } else {
      state[id] = mergeValue(state[id], objectPatch);
    }
  }
}

async function fetchHistoryWindow(args, base) {
  const url = `${args.host}/room-history/${args.shard}/${args.room}/${base}.json`;
  const response = await fetch(url, {
    headers: { "accept-encoding": "gzip, deflate, br" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json();
}

function bodySummary(body) {
  if (!Array.isArray(body)) return "unknown body";

  const parts = new Map();
  let liveParts = 0;
  for (const part of body) {
    const type = typeof part === "string" ? part : part.type;
    const hits = typeof part === "string" ? 100 : (part.hits ?? 100);
    if (hits > 0) liveParts += 1;
    parts.set(type, (parts.get(type) ?? 0) + 1);
  }

  const summary = [...parts.entries()]
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");

  return `${summary}; live ${liveParts}/${body.length}`;
}

function countActiveParts(body, type) {
  if (!Array.isArray(body)) return 0;
  return body.filter((part) => part.type === type && (part.hits ?? 100) > 0)
    .length;
}

function shortStore(store) {
  if (!store || Object.keys(store).length === 0) return "{}";
  return `{${Object.entries(store)
    .map(([resource, amount]) => `${resource}:${amount}`)
    .join(",")}}`;
}

function position(object) {
  return `${object.x},${object.y}`;
}

function structureCounts(objects, owner) {
  const counts = {};
  for (const object of objects) {
    if (!OWNED_STRUCTURE_TYPES.has(object.type)) continue;
    if (
      object.user &&
      object.user !== owner &&
      object.type !== "road" &&
      object.type !== "container"
    ) {
      continue;
    }
    counts[object.type] = (counts[object.type] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([type, count]) => `${type}:${count}`)
    .join(" ");
}

function findOwner(objects, explicitOwner) {
  if (explicitOwner) return explicitOwner;
  const controller = objects.find((object) => object.type === "controller");
  return controller?.user;
}

function summarizeState(tick, objects, owner) {
  const controller = objects.find((object) => object.type === "controller");
  const storage = objects.find(
    (object) => object.type === "storage" && (!owner || object.user === owner),
  );
  const towers = objects
    .filter((object) => object.type === "tower" && (!owner || object.user === owner))
    .map(
      (tower) =>
        `tower@${position(tower)} e=${tower.store?.energy ?? 0} hits=${tower.hits}`,
    );
  const spawns = objects
    .filter((object) => object.type === "spawn" && (!owner || object.user === owner))
    .map(
      (spawn) =>
        `spawn@${position(spawn)} e=${spawn.store?.energy ?? 0} hits=${spawn.hits} spawning=${spawn.spawning?.name ?? "false"}`,
    );

  return {
    tick,
    structures: structureCounts(objects, owner),
    controller: controller
      ? `level=${controller.level} safe=${controller.safeMode ?? "none"} safeAvailable=${controller.safeModeAvailable ?? "?"}`
      : "missing",
    storage: storage
      ? `storage@${position(storage)} e=${storage.store?.energy ?? 0} hits=${storage.hits}`
      : "none",
    towers,
    spawns,
  };
}

function eventLines(tick, state, patch, events, emitted, from, to) {
  const objects = Object.values(state);
  const lines = [];

  if (events.has("ruins")) {
    for (const object of objects) {
      const key = `ruin:${object._id}`;
      if (
        object.type !== "ruin" ||
        !object.destroyTime ||
        object.destroyTime < from ||
        object.destroyTime > to ||
        object.destroyTime > tick ||
        emitted.has(key)
      ) {
        continue;
      }
      emitted.add(key);
      lines.push(
        `${object.destroyTime} ruin ${object.structure?.type ?? "structure"}@${position(object)} observed=${tick} store=${shortStore(object.store)}`,
      );
    }
  }

  if (events.has("deaths")) {
    for (const object of objects) {
      const key = `death:${object._id}`;
      if (
        object.type !== "tombstone" ||
        !object.deathTime ||
        object.deathTime < from ||
        object.deathTime > to ||
        object.deathTime > tick ||
        emitted.has(key)
      ) {
        continue;
      }
      emitted.add(key);
      lines.push(
        `${object.deathTime} death ${object.creepName}@${position(object)} observed=${tick} ttl=${object.creepTicksToLive ?? "?"} body=${object.creepBody?.join(",") ?? "?"} store=${shortStore(object.store)}`,
      );
    }
  }

  if (events.has("structures")) {
    for (const [id, objectPatch] of Object.entries(patch)) {
      if (objectPatch !== null) continue;
      const previous = state.__previous?.[id];
      if (!previous || !OWNED_STRUCTURE_TYPES.has(previous.type)) continue;
      lines.push(`${tick} gone ${previous.type}@${position(previous)}`);
    }
  }

  return lines;
}

function creepLines(tick, objects, owner, kind) {
  const hostile = kind === "hostiles";
  const creeps = objects.filter((object) => {
    if (object.type !== "creep") return false;
    return hostile ? object.user !== owner : object.user === owner;
  });

  if (creeps.length === 0) return [];

  return creeps.map((creep) => {
    const action = creep.actionLog ?? {};
    const activeCombat = [
      ["attack", countActiveParts(creep.body, "attack")],
      ["ranged", countActiveParts(creep.body, "ranged_attack")],
      ["heal", countActiveParts(creep.body, "heal")],
    ]
      .filter(([, count]) => count > 0)
      .map(([label, count]) => `${label}:${count}`)
      .join(" ");

    return `${tick} ${hostile ? "hostile" : "friendly"} ${creep.name}@${position(creep)} hp=${creep.hits}/${creep.hitsMax} ${activeCombat || "noncombat"} body=[${bodySummary(creep.body)}] action=${JSON.stringify(action)}`;
  });
}

function renderText(report) {
  const lines = [
    `History inspection ${report.shard}/${report.room} ticks ${report.from}-${report.to}`,
    `Owner: ${report.owner ?? "unknown"}`,
  ];

  for (const item of report.timeline) {
    if (item.type === "summary") {
      lines.push("");
      lines.push(`TICK ${item.tick}`);
      lines.push(`  structures ${item.structures || "none"}`);
      lines.push(`  controller ${item.controller}`);
      lines.push(`  storage ${item.storage}`);
      lines.push(`  towers ${item.towers.length ? item.towers.join("; ") : "none"}`);
      lines.push(`  spawns ${item.spawns.length ? item.spawns.join("; ") : "none"}`);
    } else {
      lines.push(item.text);
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

  const events = new Set(args.events);
  const summaryTicks = new Set(args.ticks);
  const bases = [];
  const readThrough = args.to + args.lookahead;
  for (let base = historyBase(args.from); base <= historyBase(readThrough); base += 100) {
    bases.push(base);
  }

  const state = {};
  let owner = args.owner;
  const timeline = [];
  const emitted = new Set();

  for (const base of bases) {
    const window = await fetchHistoryWindow(args, base);
    const tickEntries = Object.entries(window.ticks).sort(([a], [b]) => Number(a) - Number(b));

    for (const [tickText, patch] of tickEntries) {
      const tick = Number(tickText);
      if (tick > readThrough) break;

      const previous = clone(state);
      applyTickPatch(state, patch);
      state.__previous = previous;

      if (tick < args.from) {
        delete state.__previous;
        continue;
      }

      if (tick > args.to && !events.has("ruins") && !events.has("deaths")) {
        delete state.__previous;
        continue;
      }

      const objects = Object.values(state).filter(
        (object) => object && object !== state.__previous,
      );
      owner = findOwner(objects, owner);

      if (
        events.has("summary") &&
        tick <= args.to &&
        (tick === args.from ||
          tick === args.to ||
          summaryTicks.has(tick) ||
          (args.every > 0 && (tick - args.from) % args.every === 0))
      ) {
        timeline.push({ type: "summary", ...summarizeState(tick, objects, owner) });
      }

      for (const text of eventLines(tick, state, patch, events, emitted, args.from, args.to)) {
        timeline.push({ type: "event", tick, text });
      }

      if (events.has("hostiles") && summaryTicks.has(tick)) {
        for (const text of creepLines(tick, objects, owner, "hostiles")) {
          timeline.push({ type: "event", tick, text });
        }
      }

      if (events.has("friendly") && summaryTicks.has(tick)) {
        for (const text of creepLines(tick, objects, owner, "friendly")) {
          timeline.push({ type: "event", tick, text });
        }
      }

      delete state.__previous;
    }
  }

  const report = {
    shard: args.shard,
    room: args.room,
    from: args.from,
    to: args.to,
    owner,
    timeline,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    process.stdout.write(renderText(report));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
