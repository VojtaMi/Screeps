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

interface Args {
  shard: string;
  host: string;
  lookback: number;
  limit: number;
  lookahead: number;
  includeRoads: boolean;
  json: boolean;
  help?: boolean;
  rooms?: string[];
  from?: number;
  to?: number;
}

type BodyPart = string | { type: string; hits?: number };

interface BaseHistoryObject {
  _id?: string;
  type: string;
  x: number;
  y: number;
}

interface SourceObject extends BaseHistoryObject {
  type: "source";
  nextRegenerationTime?: number;
  ticksToRegeneration?: number;
}

interface RuinObject extends BaseHistoryObject {
  type: "ruin";
  destroyTime?: number;
  structure?: { type: string; user?: string };
  user?: string;
  store?: Record<string, number>;
}

interface TombstoneObject extends BaseHistoryObject {
  type: "tombstone";
  deathTime?: number;
  creepName?: string;
  creepUser?: string;
  user?: string;
  creepBody?: BodyPart[];
  store?: Record<string, number>;
}

interface CreepObject extends BaseHistoryObject {
  type: "creep";
  user?: string;
  actionLog?: {
    attack?: unknown;
    rangedAttack?: unknown;
    rangedMassAttack?: unknown;
    heal?: unknown;
    rangedHeal?: unknown;
  };
  body?: BodyPart[];
}

interface ControllerObject extends BaseHistoryObject {
  type: "controller";
  user?: string;
}

type HistoryObject =
  | SourceObject
  | RuinObject
  | TombstoneObject
  | CreepObject
  | ControllerObject
  | BaseHistoryObject;

type RoomState = Record<string, Record<string, unknown>>;

interface HistoryWindow {
  ticks: Record<string, Record<string, unknown>>;
}

interface HostileCounts {
  total: number;
  combat: number;
}

interface Sighting extends HostileCounts {
  room: string;
  tick: number;
}

interface Incident {
  room: string;
  tick: number;
  observed: number;
  kind: "structure" | "defenderDeath";
  label: string;
  pos: string;
  store: string;
  hostileCreeps: number;
  hostileCombatCreeps: number;
}

interface AttackWindow {
  room: string;
  from: number;
  to: number;
  hostileCreeps: number;
  hostileCombatCreeps: number;
  incidents: Incident[];
}

interface CollectContext {
  args: Args;
  room: string;
  tick: number;
  state: RoomState;
  owner: string | undefined;
  from: number;
  to: number;
  incidents: Incident[];
  emitted: Set<string>;
}

interface RoomReport {
  room: string;
  owner: string | undefined;
  incidents: Incident[];
  windows: AttackWindow[];
}

interface Report {
  shard: string;
  from: number;
  to: number;
  rooms: string[];
  roomsScanned: RoomReport[];
}

class HttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function printUsage() {
  console.log(`Usage:
  npm run history:attacks -- [--rooms E58S28,E59S28] [options]

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

function parseArgs(argv: string[]): Args {
  const args: Args = {
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

function defaultRooms(): string[] {
  try {
    return readdirSync(ROOM_ARTIFACT_DIR)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => fileName.replace(/\.json$/, ""))
      .sort();
  } catch {
    return [];
  }
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

  const patchObj = patch as Record<string, unknown>;

  if (Array.isArray(current) && Object.keys(patchObj).every(isNumericKey)) {
    const next = current.map((item) => clone(item));
    for (const [key, value] of Object.entries(patchObj)) {
      next[Number(key)] = mergeValue(next[Number(key)], value);
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

function applyTickPatch(state: RoomState, patch: Record<string, unknown> | null | undefined): void {
  if (!patch) return;
  for (const [id, objectPatch] of Object.entries(patch)) {
    if (objectPatch === null) delete state[id];
    else state[id] = mergeValue(state[id], objectPatch) as Record<string, unknown>;
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { "accept-encoding": "gzip, deflate, br" },
  });

  if (!response.ok) {
    throw new HttpError(`Failed to fetch ${url}: ${response.status}`, response.status);
  }

  return response.json() as Promise<T>;
}

function asHistoryObjects(state: RoomState): HistoryObject[] {
  return Object.values(state) as unknown as HistoryObject[];
}

function estimateCurrentTick(objects: HistoryObject[]): number | null {
  const estimates = objects
    .filter((obj): obj is SourceObject =>
      obj.type === "source" &&
      Number.isInteger((obj as SourceObject).nextRegenerationTime) &&
      Number.isInteger((obj as SourceObject).ticksToRegeneration),
    )
    .map((source) => source.nextRegenerationTime! - source.ticksToRegeneration!);

  return estimates.length > 0 ? Math.max(...estimates) : null;
}

async function inferToTick(args: Args, rooms: string[]): Promise<number> {
  if (args.to !== undefined) return args.to;

  const estimates: number[] = [];
  for (const room of rooms) {
    try {
      const url = `${args.host}/api/game/room-objects?room=${room}&shard=${args.shard}`;
      const response = await fetchJson<{ objects?: HistoryObject[] }>(url);
      const estimate = estimateCurrentTick(response.objects ?? []);
      if (estimate !== null) estimates.push(estimate);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Could not estimate current tick from ${room}: ${msg}`);
    }
  }

  if (estimates.length === 0) {
    throw new Error("Could not infer --to tick; pass --to explicitly");
  }

  return Math.max(...estimates);
}

function position(object: BaseHistoryObject): string {
  return `${object.x},${object.y}`;
}

function findOwner(objects: HistoryObject[], explicitOwner: string | undefined): string | undefined {
  if (explicitOwner) return explicitOwner;
  const controller = objects.find((obj): obj is ControllerObject => obj.type === "controller");
  return controller?.user;
}

function isOwnedStructureLoss(ruin: RuinObject, owner: string | undefined, includeRoads: boolean): boolean {
  const structureType = ruin.structure?.type;
  if (!structureType || !OWNED_STRUCTURE_TYPES.has(structureType)) return false;
  if (!includeRoads && !MAJOR_STRUCTURE_TYPES.has(structureType)) return false;

  const structureUser = ruin.structure?.user ?? ruin.user;
  return !structureUser || !owner || structureUser === owner;
}

function isOwnedCreepDeath(tombstone: TombstoneObject, owner: string | undefined): boolean {
  return !owner || tombstone.creepUser === owner || tombstone.user === owner;
}

function isDefenderDeath(tombstone: TombstoneObject): boolean {
  if (tombstone.creepName?.startsWith("defender-")) return true;
  if (!Array.isArray(tombstone.creepBody)) return false;
  return tombstone.creepBody.some((part) =>
    COMBAT_PARTS.has(typeof part === "string" ? part : part.type),
  );
}

function countHostiles(objects: HistoryObject[], owner: string | undefined): HostileCounts {
  let total = 0;
  let combat = 0;
  for (const object of objects) {
    if (object.type !== "creep") continue;
    const creep = object as CreepObject;
    if (creep.user === owner) continue;
    total += 1;
    const actionLog = creep.actionLog ?? {};
    const usedCombatAction =
      actionLog.attack ||
      actionLog.rangedAttack ||
      actionLog.rangedMassAttack ||
      actionLog.heal ||
      actionLog.rangedHeal;
    const body = Array.isArray(creep.body) ? creep.body : [];
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

function shortStore(store: Record<string, number> | undefined): string {
  if (!store || Object.keys(store).length === 0) return "{}";
  return `{${Object.entries(store)
    .map(([resource, amount]) => `${resource}:${amount}`)
    .join(",")}}`;
}

function recordIncident(incidents: Incident[], incident: Incident): void {
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

function collectIncidents(context: CollectContext): void {
  const { args, room, tick, state, owner, from, to, incidents, emitted } = context;
  const objects = asHistoryObjects(state);
  const hostiles = countHostiles(objects, owner);

  for (const object of objects) {
    if (object.type === "ruin") {
      const ruin = object as RuinObject;
      if (
        ruin.destroyTime !== undefined &&
        ruin.destroyTime >= from &&
        ruin.destroyTime <= to &&
        ruin.destroyTime <= tick &&
        isOwnedStructureLoss(ruin, owner, args.includeRoads)
      ) {
        const key = `ruin:${ruin._id}`;
        if (emitted.has(key)) continue;
        emitted.add(key);
        recordIncident(incidents, {
          room,
          tick: ruin.destroyTime,
          observed: tick,
          kind: "structure",
          label: ruin.structure?.type ?? "structure",
          pos: position(ruin),
          store: shortStore(ruin.store),
          hostileCreeps: hostiles.total,
          hostileCombatCreeps: hostiles.combat,
        });
      }
    }

    if (object.type === "tombstone") {
      const tombstone = object as TombstoneObject;
      if (
        tombstone.deathTime !== undefined &&
        tombstone.deathTime >= from &&
        tombstone.deathTime <= to &&
        tombstone.deathTime <= tick &&
        isOwnedCreepDeath(tombstone, owner) &&
        isDefenderDeath(tombstone)
      ) {
        const key = `death:${tombstone._id}`;
        if (emitted.has(key)) continue;
        emitted.add(key);
        recordIncident(incidents, {
          room,
          tick: tombstone.deathTime,
          observed: tick,
          kind: "defenderDeath",
          label: tombstone.creepName ?? "creep",
          pos: position(tombstone),
          store: shortStore(tombstone.store),
          hostileCreeps: hostiles.total,
          hostileCombatCreeps: hostiles.combat,
        });
      }
    }
  }
}

function groupIncidents(incidents: Incident[], sightings: Sighting[] = []): AttackWindow[] {
  const sorted = [...incidents].sort((a, b) => b.tick - a.tick);
  const windows: AttackWindow[] = [];

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

async function scanRoom(args: Args, room: string, from: number, to: number): Promise<RoomReport> {
  const incidents: Incident[] = [];
  const sightings: Sighting[] = [];
  const emitted = new Set<string>();
  const readThrough = to + args.lookahead;
  let owner: string | undefined;

  for (let base = historyBase(to); base >= historyBase(from); base -= 100) {
    let window: HistoryWindow;
    try {
      const url = `${args.host}/room-history/${args.shard}/${room}/${base}.json`;
      window = await fetchJson<HistoryWindow>(url);
    } catch (err) {
      if (err instanceof HttpError && err.status === 404) continue;
      throw err;
    }

    const state: RoomState = {};
    const tickEntries = Object.entries(window.ticks).sort(
      ([a], [b]) => Number(a) - Number(b),
    );

    for (const [tickText, patch] of tickEntries) {
      const tick = Number(tickText);
      if (tick > readThrough) break;

      applyTickPatch(state, patch);
      const objects = asHistoryObjects(state);
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

function renderText(report: Report): string {
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

  const roomsScanned: RoomReport[] = [];
  for (const room of rooms) {
    roomsScanned.push(await scanRoom(args, room, from, to));
  }

  const report: Report = {
    shard: args.shard,
    from,
    to,
    rooms,
    roomsScanned,
  };

  if (args.json) console.log(JSON.stringify(report, null, 2));
  else process.stdout.write(renderText(report));
}

main().catch((error: unknown) => {
  const msg = error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(msg);
  process.exitCode = 1;
});
