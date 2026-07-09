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

interface Args {
  shard: string;
  host: string;
  events: string[];
  every: number;
  ticks: number[];
  json: boolean;
  lookahead: number;
  help?: boolean;
  room?: string;
  from?: number;
  to?: number;
  owner?: string;
}

type BodyPart = string | { type: string; hits?: number };

interface BaseHistoryObject {
  _id?: string;
  type: string;
  x: number;
  y: number;
  user?: string;
}

interface RuinObject extends BaseHistoryObject {
  type: "ruin";
  destroyTime?: number;
  structure?: { type: string; user?: string };
  store?: Record<string, number>;
}

interface TombstoneObject extends BaseHistoryObject {
  type: "tombstone";
  deathTime?: number;
  creepName?: string;
  creepTicksToLive?: number;
  creepBody?: BodyPart[];
  store?: Record<string, number>;
}

interface CreepObject extends BaseHistoryObject {
  type: "creep";
  name?: string;
  user?: string;
  hits?: number;
  hitsMax?: number;
  body?: BodyPart[];
  actionLog?: Record<string, unknown>;
}

interface StorageObject extends BaseHistoryObject {
  user?: string;
  hits?: number;
  store?: Record<string, number>;
}

interface TowerObject extends BaseHistoryObject {
  type: "tower";
  user?: string;
  hits?: number;
  store?: Record<string, number>;
}

interface SpawnObject extends BaseHistoryObject {
  type: "spawn";
  user?: string;
  hits?: number;
  store?: Record<string, number>;
  spawning?: { name: string };
}

interface ControllerObject extends BaseHistoryObject {
  type: "controller";
  user?: string;
  level?: number;
  safeMode?: number;
  safeModeAvailable?: number;
}

type HistoryObject =
  | RuinObject
  | TombstoneObject
  | CreepObject
  | TowerObject
  | SpawnObject
  | ControllerObject
  | StorageObject
  | BaseHistoryObject;

type RoomState = Record<string, Record<string, unknown>>;

interface StateSummary {
  tick: number;
  structures: string;
  controller: string;
  storage: string;
  towers: string[];
  spawns: string[];
}

type TimelineItem =
  | ({ type: "summary" } & StateSummary)
  | { type: "event"; tick: number; text: string };

interface HistoryReport {
  shard: string;
  room: string;
  from: number;
  to: number;
  owner: string | undefined;
  timeline: TimelineItem[];
}

function printUsage() {
  console.log(`Usage:
  npm run history:inspect -- --room E58S28 --from 81080300 --to 81080499 [options]

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

function parseArgs(argv: string[]): Args {
  const args: Args = {
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
  if ((args.from ?? 0) > (args.to ?? 0)) throw new Error("--from must be <= --to");
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

function historyBase(tick: number): number {
  return Math.floor(tick / 100) * 100;
}

function isNumericKey(key: string): boolean {
  return String(Number(key)) === key;
}

function clone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => clone(item));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, clone(item)]),
    );
  }
  return value;
}

function mergeValue(current: unknown, patch: unknown): unknown {
  if (patch === null || typeof patch !== "object") return patch;

  if (Array.isArray(patch)) return patch.map((item) => clone(item));

  const patchObj = patch as Record<string, unknown>;

  if (Array.isArray(current) && Object.keys(patchObj).every(isNumericKey)) {
    const next = current.map((item) => clone(item));
    for (const [key, value] of Object.entries(patchObj)) {
      const index = Number(key);
      next[index] = mergeValue(next[index], value);
    }
    return next;
  }

  const next: Record<string, unknown> =
    current !== null && typeof current === "object" && !Array.isArray(current)
      ? (clone(current) as Record<string, unknown>)
      : {};

  for (const [key, value] of Object.entries(patchObj)) {
    next[key] = mergeValue(next[key], value);
  }

  return next;
}

function applyTickPatch(state: RoomState, patch: Record<string, unknown>): void {
  for (const [id, objectPatch] of Object.entries(patch)) {
    if (objectPatch === null) {
      delete state[id];
    } else {
      state[id] = mergeValue(state[id], objectPatch) as Record<string, unknown>;
    }
  }
}

async function fetchHistoryWindow(
  args: Args,
  base: number,
): Promise<{ ticks: Record<string, Record<string, unknown>> }> {
  const url = `${args.host}/room-history/${args.shard}/${args.room}/${base}.json`;
  const response = await fetch(url, {
    headers: { "accept-encoding": "gzip, deflate, br" },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.json() as Promise<{ ticks: Record<string, Record<string, unknown>> }>;
}

function asHistoryObject(raw: Record<string, unknown>): HistoryObject {
  return raw as unknown as HistoryObject;
}

function bodySummary(body: BodyPart[] | undefined): string {
  if (!Array.isArray(body)) return "unknown body";

  const parts = new Map<string, number>();
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

function countActiveParts(body: BodyPart[] | undefined, type: string): number {
  if (!Array.isArray(body)) return 0;
  return body.filter(
    (part): part is { type: string; hits?: number } =>
      typeof part !== "string" && part.type === type && (part.hits ?? 100) > 0,
  ).length;
}

function shortStore(store: Record<string, number> | undefined): string {
  if (!store || Object.keys(store).length === 0) return "{}";
  return `{${Object.entries(store)
    .map(([resource, amount]) => `${resource}:${amount}`)
    .join(",")}}`;
}

function position(object: BaseHistoryObject): string {
  return `${object.x},${object.y}`;
}

function structureCounts(objects: HistoryObject[], owner: string | undefined): string {
  const counts: Record<string, number> = {};
  for (const object of objects) {
    if (!OWNED_STRUCTURE_TYPES.has(object.type)) continue;
    const obj = object as StorageObject;
    if (
      obj.user &&
      obj.user !== owner &&
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

function findOwner(objects: HistoryObject[], explicitOwner: string | undefined): string | undefined {
  if (explicitOwner) return explicitOwner;
  const controller = objects.find((obj): obj is ControllerObject => obj.type === "controller");
  return controller?.user;
}

function summarizeState(tick: number, objects: HistoryObject[], owner: string | undefined): StateSummary {
  const controller = objects.find((obj): obj is ControllerObject => obj.type === "controller");
  const storage = objects.find(
    (obj): obj is StorageObject =>
      obj.type === "storage" && (!owner || (obj as StorageObject).user === owner),
  ) as (StorageObject & { store?: Record<string, number> }) | undefined;
  const towers = objects
    .filter((obj): obj is TowerObject => obj.type === "tower" && (!owner || obj.user === owner))
    .map(
      (tower) =>
        `tower@${position(tower)} e=${tower.store?.energy ?? 0} hits=${tower.hits}`,
    );
  const spawns = objects
    .filter((obj): obj is SpawnObject => obj.type === "spawn" && (!owner || obj.user === owner))
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

function eventLines(
  tick: number,
  state: RoomState,
  previous: RoomState,
  patch: Record<string, unknown>,
  events: Set<string>,
  emitted: Set<string>,
  from: number,
  to: number,
): string[] {
  const objects = Object.values(state).map(asHistoryObject);
  const lines: string[] = [];

  if (events.has("ruins")) {
    for (const object of objects) {
      if (object.type !== "ruin") continue;
      const ruin = object as RuinObject;
      const key = `ruin:${ruin._id}`;
      if (
        !ruin.destroyTime ||
        ruin.destroyTime < from ||
        ruin.destroyTime > to ||
        ruin.destroyTime > tick ||
        emitted.has(key)
      ) {
        continue;
      }
      emitted.add(key);
      lines.push(
        `${ruin.destroyTime} ruin ${ruin.structure?.type ?? "structure"}@${position(ruin)} observed=${tick} store=${shortStore(ruin.store)}`,
      );
    }
  }

  if (events.has("deaths")) {
    for (const object of objects) {
      if (object.type !== "tombstone") continue;
      const tombstone = object as TombstoneObject;
      const key = `death:${tombstone._id}`;
      if (
        !tombstone.deathTime ||
        tombstone.deathTime < from ||
        tombstone.deathTime > to ||
        tombstone.deathTime > tick ||
        emitted.has(key)
      ) {
        continue;
      }
      emitted.add(key);
      lines.push(
        `${tombstone.deathTime} death ${tombstone.creepName}@${position(tombstone)} observed=${tick} ttl=${tombstone.creepTicksToLive ?? "?"} body=${tombstone.creepBody?.join(",") ?? "?"} store=${shortStore(tombstone.store)}`,
      );
    }
  }

  if (events.has("structures")) {
    for (const [id, objectPatch] of Object.entries(patch)) {
      if (objectPatch !== null) continue;
      const prev = previous[id];
      if (!prev || !OWNED_STRUCTURE_TYPES.has(prev.type as string)) continue;
      const prevObj = asHistoryObject(prev);
      lines.push(`${tick} gone ${prevObj.type}@${position(prevObj)}`);
    }
  }

  return lines;
}

function creepLines(
  tick: number,
  objects: HistoryObject[],
  owner: string | undefined,
  kind: "hostiles" | "friendly",
): string[] {
  const hostile = kind === "hostiles";
  const creeps = objects.filter((obj): obj is CreepObject => {
    if (obj.type !== "creep") return false;
    return hostile ? (obj as CreepObject).user !== owner : (obj as CreepObject).user === owner;
  });

  if (creeps.length === 0) return [];

  return creeps.map((creep) => {
    const action = creep.actionLog ?? {};
    const activeCombat = [
      ["attack", countActiveParts(creep.body, "attack")],
      ["ranged", countActiveParts(creep.body, "ranged_attack")],
      ["heal", countActiveParts(creep.body, "heal")],
    ]
      .filter(([, count]) => (count as number) > 0)
      .map(([label, count]) => `${label}:${count}`)
      .join(" ");

    return `${tick} ${hostile ? "hostile" : "friendly"} ${creep.name}@${position(creep)} hp=${creep.hits}/${creep.hitsMax} ${activeCombat || "noncombat"} body=[${bodySummary(creep.body)}] action=${JSON.stringify(action)}`;
  });
}

function renderText(report: HistoryReport): string {
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

  const from = args.from!;
  const to = args.to!;
  const room = args.room!;

  const events = new Set(args.events);
  const summaryTicks = new Set(args.ticks);
  const bases: number[] = [];
  const readThrough = to + args.lookahead;
  for (let base = historyBase(from); base <= historyBase(readThrough); base += 100) {
    bases.push(base);
  }

  const state: RoomState = {};
  let owner = args.owner;
  const timeline: TimelineItem[] = [];
  const emitted = new Set<string>();

  for (const base of bases) {
    const window = await fetchHistoryWindow(args, base);
    const tickEntries = Object.entries(window.ticks).sort(([a], [b]) => Number(a) - Number(b));

    for (const [tickText, patch] of tickEntries) {
      const tick = Number(tickText);
      if (tick > readThrough) break;

      const previous = clone(state) as RoomState;
      const tickPatch = patch ?? {};
      if (patch !== null) {
        applyTickPatch(state, tickPatch);
      }

      if (tick < from) {
        continue;
      }

      if (tick > to && !events.has("ruins") && !events.has("deaths")) {
        continue;
      }

      const objects = Object.values(state).map(asHistoryObject);
      owner = findOwner(objects, owner);

      if (
        events.has("summary") &&
        tick <= to &&
        (tick === from ||
          tick === to ||
          summaryTicks.has(tick) ||
          (args.every > 0 && (tick - from) % args.every === 0))
      ) {
        timeline.push({ type: "summary", ...summarizeState(tick, objects, owner) });
      }

      for (const text of eventLines(tick, state, previous, tickPatch, events, emitted, from, to)) {
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
    }
  }

  const report: HistoryReport = {
    shard: args.shard,
    room,
    from,
    to,
    owner,
    timeline,
  };

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    process.stdout.write(renderText(report));
  }
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? error.message : String(error);
  console.error(msg);
  process.exitCode = 1;
});
