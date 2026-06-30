import { readFileSync } from "node:fs";
import path from "node:path";
import type { BuildPlanItemData, BuildPlansData } from "../../shared/buildPlans";

export type BuildPlanItem = BuildPlanItemData;
export type { BuildPlansData };

export function readBuildPlans(root: string): BuildPlansData {
  return JSON.parse(
    readFileSync(path.join(root, "src", "buildPlans.json"), "utf8"),
  ) as BuildPlansData;
}

export function loadTerrain(root: string, roomName: string): string {
  const terrainPath = path.join(
    root,
    "tools",
    "artifacts",
    "terrain",
    `${roomName}.json`,
  );

  try {
    return (JSON.parse(readFileSync(terrainPath, "utf8")) as { terrain?: string }).terrain ?? "";
  } catch {
    return "";
  }
}
