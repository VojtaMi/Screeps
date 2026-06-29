import { readFileSync } from "node:fs";
import path from "node:path";

export function parseBuildPlans(source) {
  const plans = {};
  const roomBlockPattern =
    /"?([WE]\d+[NS]\d+)"?\s*:\s*{\s*"?plan"?\s*:\s*\[([\s\S]*?)\]\s*,?\s*}/g;
  const defaultPlansIndex = source.indexOf("export const DEFAULT_BUILD_PLANS");

  if (defaultPlansIndex < 0) {
    throw new Error("Could not find DEFAULT_BUILD_PLANS in src/buildPlans.ts");
  }

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

export function readBuildPlans(root) {
  const source = readFileSync(path.join(root, "src", "buildPlans.ts"), "utf8");
  return parseBuildPlans(source);
}

export function loadTerrain(root, roomName) {
  const terrainPath = path.join(
    root,
    "tools",
    "artifacts",
    "terrain",
    `${roomName}.json`,
  );

  try {
    return JSON.parse(readFileSync(terrainPath, "utf8")).terrain ?? "";
  } catch {
    return "";
  }
}
