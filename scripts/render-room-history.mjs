#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_HOST = "https://screeps.com";
const DEFAULT_OUT_DIR = "tools/artifacts/history";
const ROOM_SIZE = 50;
const CELL_SIZE = 16;
const HEADER_HEIGHT = 44;
const LEGEND_HEIGHT = 52;
const SVG_SIZE = ROOM_SIZE * CELL_SIZE;

const STRUCTURE_COLORS = {
  constructedWall: "#343a40",
  container: "#b08968",
  extension: "#f59f00",
  extractor: "#868e96",
  factory: "#4dabf7",
  lab: "#cc5de8",
  link: "#15aabf",
  nuker: "#ff6b6b",
  observer: "#91a7ff",
  powerSpawn: "#ff8787",
  rampart: "#2f9e44",
  road: "#868e96",
  spawn: "#ffd43b",
  storage: "#fcc419",
  terminal: "#40c057",
  tower: "#f76707",
};

function usage() {
  console.log(`Usage:
  node scripts/render-room-history.mjs --room E58S28 --ticks 81080300,81080437 [options]

Options:
  --shard <name>     Shard name, default shard3
  --host <url>       Screeps host, default ${DEFAULT_HOST}
  --out <dir>        Output directory, default ${DEFAULT_OUT_DIR}
  --owner <user-id>  Owned user id. Defaults to controller owner from history
  --labels           Draw compact labels for major objects and creeps
  --help             Show this message`);
}

function parseArgs(argv) {
  const args = {
    shard: "shard3",
    host: DEFAULT_HOST,
    out: DEFAULT_OUT_DIR,
    labels: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (arg === "--help" || arg === "-h") {
      args.help = true;
      continue;
    }

    if (arg === "--labels") {
      args.labels = true;
      continue;
    }

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }

    index += 1;
    if (arg === "--room") args.room = value;
    else if (arg === "--shard") args.shard = value;
    else if (arg === "--host") args.host = value.replace(/\/$/, "");
    else if (arg === "--out") args.out = value;
    else if (arg === "--owner") args.owner = value;
    else if (arg === "--ticks") {
      args.ticks = value
        .split(",")
        .filter(Boolean)
        .map((tick) => Number(tick));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (args.help) return args;
  if (!args.room) throw new Error("--room is required");
  if (!args.ticks?.length) throw new Error("--ticks is required");
  if (!args.ticks.every(Number.isInteger)) {
    throw new Error("--ticks must be comma-separated integer ticks");
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { "accept-encoding": "gzip, deflate, br" },
  });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

async function fetchTerrain(args) {
  const url = `${args.host}/api/game/room-terrain?room=${args.room}&shard=${args.shard}`;
  const data = await fetchJson(url);
  if (!data.ok || !Array.isArray(data.terrain)) {
    throw new Error(`Unexpected terrain response for ${args.shard}/${args.room}`);
  }
  return data.terrain;
}

async function fetchStateAtTick(args, tick) {
  const base = historyBase(tick);
  const url = `${args.host}/room-history/${args.shard}/${args.room}/${base}.json`;
  const data = await fetchJson(url);
  const state = {};

  for (const [tickText, patch] of Object.entries(data.ticks).sort(
    ([a], [b]) => Number(a) - Number(b),
  )) {
    const currentTick = Number(tickText);
    if (currentTick > tick) break;
    applyTickPatch(state, patch);
  }

  return Object.values(state).filter(Boolean);
}

function detectOwner(objects, explicitOwner) {
  if (explicitOwner) return explicitOwner;
  return objects.find((object) => object.type === "controller")?.user;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function cellX(x) {
  return x * CELL_SIZE;
}

function cellY(y) {
  return HEADER_HEIGHT + y * CELL_SIZE;
}

function centerX(x) {
  return cellX(x) + CELL_SIZE / 2;
}

function centerY(y) {
  return cellY(y) + CELL_SIZE / 2;
}

function objectTitle(object) {
  const parts = [`${object.type}@${object.x},${object.y}`];
  if (object.name) parts.push(object.name);
  if (object.hits !== undefined) parts.push(`hits ${object.hits}/${object.hitsMax}`);
  if (object.store?.energy !== undefined) parts.push(`energy ${object.store.energy}`);
  if (object.user) parts.push(`user ${object.user}`);
  return parts.join(" | ");
}

function renderTerrain(terrain) {
  return terrain
    .map((tile) => {
      const fill =
        tile.type === "wall" ? "#2b2f33" : tile.type === "swamp" ? "#31452d" : "#11161a";
      return `<rect x="${cellX(tile.x)}" y="${cellY(tile.y)}" width="${CELL_SIZE}" height="${CELL_SIZE}" fill="${fill}" />`;
    })
    .join("\n");
}

function renderGrid() {
  const lines = [];
  for (let i = 0; i <= ROOM_SIZE; i += 1) {
    const pos = i * CELL_SIZE;
    lines.push(
      `<line x1="${pos}" y1="${HEADER_HEIGHT}" x2="${pos}" y2="${HEADER_HEIGHT + SVG_SIZE}" class="grid" />`,
      `<line x1="0" y1="${HEADER_HEIGHT + pos}" x2="${SVG_SIZE}" y2="${HEADER_HEIGHT + pos}" class="grid" />`,
    );
  }
  return lines.join("\n");
}

function renderStructure(object, owner) {
  const color = STRUCTURE_COLORS[object.type] ?? "#adb5bd";
  const title = `<title>${escapeXml(objectTitle(object))}</title>`;
  const x = cellX(object.x);
  const y = cellY(object.y);

  if (object.type === "road") {
    return `<circle cx="${centerX(object.x)}" cy="${centerY(object.y)}" r="3.5" fill="${color}" opacity="0.8">${title}</circle>`;
  }

  if (object.type === "rampart") {
    return `<rect x="${x + 1}" y="${y + 1}" width="${CELL_SIZE - 2}" height="${CELL_SIZE - 2}" fill="none" stroke="${color}" stroke-width="3" opacity="0.9">${title}</rect>`;
  }

  const stroke = object.user && object.user !== owner ? "#ff6b6b" : "#f8f9fa";
  return `<rect x="${x + 2}" y="${y + 2}" width="${CELL_SIZE - 4}" height="${CELL_SIZE - 4}" rx="2" fill="${color}" stroke="${stroke}" stroke-width="1.5">${title}</rect>`;
}

function renderCreep(object, owner) {
  const isHostile = object.user !== owner;
  const fill = isHostile ? "#fa5252" : "#51cf66";
  const stroke = isHostile ? "#ffe3e3" : "#d3f9d8";
  const title = `<title>${escapeXml(objectTitle(object))}</title>`;
  return `<circle cx="${centerX(object.x)}" cy="${centerY(object.y)}" r="6" fill="${fill}" stroke="${stroke}" stroke-width="2">${title}</circle>`;
}

function renderRemains(object) {
  const fill = object.type === "tombstone" ? "#ced4da" : "#9775fa";
  const title = `<title>${escapeXml(objectTitle(object))}</title>`;
  return `<path d="M ${centerX(object.x)} ${cellY(object.y) + 3} L ${cellX(object.x) + CELL_SIZE - 3} ${centerY(object.y)} L ${centerX(object.x)} ${cellY(object.y) + CELL_SIZE - 3} L ${cellX(object.x) + 3} ${centerY(object.y)} Z" fill="${fill}" opacity="0.85">${title}</path>`;
}

function shortLabel(object) {
  if (object.type === "creep") return object.name?.split("-")[0]?.slice(0, 3) ?? "cr";
  if (object.type === "spawn") return "Sp";
  if (object.type === "storage") return "St";
  if (object.type === "tower") return "Tw";
  if (object.type === "controller") return "Ct";
  if (object.type === "tombstone") return "T";
  if (object.type === "ruin") return "R";
  return "";
}

function renderLabels(objects) {
  return objects
    .map((object) => {
      const label = shortLabel(object);
      if (!label) return "";
      return `<text x="${centerX(object.x)}" y="${centerY(object.y) + 3}" class="label">${escapeXml(label)}</text>`;
    })
    .filter(Boolean)
    .join("\n");
}

function renderObjects(objects, owner, labels) {
  const structures = [];
  const creeps = [];
  const remains = [];
  const controllers = [];

  for (const object of objects) {
    if (object.x === undefined || object.y === undefined) continue;
    if (object.type === "creep") creeps.push(renderCreep(object, owner));
    else if (object.type === "ruin" || object.type === "tombstone") {
      remains.push(renderRemains(object));
    } else if (object.type === "controller") {
      controllers.push(renderStructure({ ...object, type: "controller" }, owner));
    } else if (STRUCTURE_COLORS[object.type]) {
      structures.push(renderStructure(object, owner));
    }
  }

  return [
    ...structures,
    ...controllers,
    ...remains,
    ...creeps,
    labels ? renderLabels(objects) : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function renderLegend() {
  const y = HEADER_HEIGHT + SVG_SIZE + 22;
  const items = [
    ["friendly creep", "#51cf66"],
    ["hostile creep", "#fa5252"],
    ["tower", STRUCTURE_COLORS.tower],
    ["spawn/storage", STRUCTURE_COLORS.spawn],
    ["rampart", STRUCTURE_COLORS.rampart],
    ["ruin", "#9775fa"],
  ];

  return items
    .map(([label, color], index) => {
      const x = 12 + index * 128;
      return `<circle cx="${x}" cy="${y}" r="5" fill="${color}" /><text x="${x + 10}" y="${y + 4}" class="legend">${escapeXml(label)}</text>`;
    })
    .join("\n");
}

function renderSvg(args, tick, terrain, objects, owner) {
  const height = HEADER_HEIGHT + SVG_SIZE + LEGEND_HEIGHT;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${SVG_SIZE}" height="${height}" viewBox="0 0 ${SVG_SIZE} ${height}">
  <style>
    .title { fill: #f8f9fa; font: 700 18px system-ui, sans-serif; }
    .subtitle { fill: #adb5bd; font: 12px system-ui, sans-serif; }
    .grid { stroke: rgba(255,255,255,0.055); stroke-width: 1; }
    .label { fill: #111; font: 700 8px system-ui, sans-serif; text-anchor: middle; pointer-events: none; }
    .legend { fill: #dee2e6; font: 11px system-ui, sans-serif; }
  </style>
  <rect width="${SVG_SIZE}" height="${height}" fill="#0b0f12" />
  <text x="12" y="24" class="title">${escapeXml(args.shard)}/${escapeXml(args.room)} tick ${tick}</text>
  <text x="12" y="39" class="subtitle">Static Screeps history render. Use object titles/tooltips for details.</text>
  ${renderTerrain(terrain)}
  ${renderGrid()}
  ${renderObjects(objects, owner, args.labels)}
  ${renderLegend()}
</svg>
`;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    usage();
    return;
  }

  const terrain = await fetchTerrain(args);
  const outputDir = path.join(args.out, args.room);
  await mkdir(outputDir, { recursive: true });

  for (const tick of args.ticks) {
    const objects = await fetchStateAtTick(args, tick);
    const owner = detectOwner(objects, args.owner);
    const svg = renderSvg(args, tick, terrain, objects, owner);
    const outputFile = path.join(outputDir, `${args.shard}-${args.room}-${tick}.svg`);
    await writeFile(outputFile, svg);
    console.log(outputFile);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
