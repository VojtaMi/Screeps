import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { BuildPlanItemData, BuildPlansData } from "../shared/buildPlans";
import { isNaturalWall, wouldBlockExit } from "../tools/build-plan-editor/src/plan/validationCore";
import { generateBuildPlans } from "./generate-build-plans";
import { loadTerrain, readBuildPlans } from "./lib/build-plan-files";

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), "..");

const DEFENSE_TYPES = new Set(["STRUCTURE_RAMPART", "STRUCTURE_WALL"]);
const CORE_TYPES = new Set([
  "STRUCTURE_SPAWN",
  "STRUCTURE_STORAGE",
  "STRUCTURE_TOWER",
  "STRUCTURE_EXTENSION",
  "STRUCTURE_LAB",
  "STRUCTURE_LINK",
  "STRUCTURE_TERMINAL",
]);

function key(x: number, y: number): string {
  return `${x},${y}`;
}

function parseKey(k: string): [number, number] {
  const [x, y] = k.split(",").map(Number);
  return [x, y];
}

function floodFillClusters(coords: Set<string>): string[][] {
  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const start of coords) {
    if (visited.has(start)) continue;
    const stack = [start];
    visited.add(start);
    const cluster: string[] = [];

    while (stack.length > 0) {
      const current = stack.pop() as string;
      cluster.push(current);
      const [cx, cy] = parseKey(current);

      for (let dx = -1; dx <= 1; dx += 1) {
        for (let dy = -1; dy <= 1; dy += 1) {
          if (dx === 0 && dy === 0) continue;
          const neighbor = key(cx + dx, cy + dy);
          if (coords.has(neighbor) && !visited.has(neighbor)) {
            visited.add(neighbor);
            stack.push(neighbor);
          }
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function isPartOf2x2Block(cset: Set<string>, x: number, y: number): boolean {
  const corners: Array<Array<[number, number]>> = [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [-1, 0], [0, 1], [-1, 1]],
    [[0, 0], [1, 0], [0, -1], [1, -1]],
    [[0, 0], [-1, 0], [0, -1], [-1, -1]],
  ];

  return corners.some((offsets) =>
    offsets.every(([dx, dy]) => cset.has(key(x + dx, y + dy))),
  );
}

interface WidenResult {
  plan: BuildPlanItemData[];
  added: string[];
  flagged: string[];
}

// Widens exposed (no non-road structure on them) rampart tiles that are only
// 1 tile thick to 2-tile thickness, by adding a backing rampart on the side
// closer to the room's core structures. STRUCTURE_WALL tiles are exempt: they
// are impassable chokepoints and don't need width.
function widenRoom(roomName: string, plan: BuildPlanItemData[]): WidenResult {
  const terrain = loadTerrain(root, roomName);

  const itemsByCoord = new Map<string, BuildPlanItemData[]>();
  for (const item of plan) {
    const k = key(item.x, item.y);
    const list = itemsByCoord.get(k) ?? [];
    list.push(item);
    itemsByCoord.set(k, list);
  }

  const defenseCoords = new Set<string>();
  for (const item of plan) {
    if (DEFENSE_TYPES.has(item.structureType)) {
      defenseCoords.add(key(item.x, item.y));
    }
  }

  const coreItems = plan.filter((item) => CORE_TYPES.has(item.structureType));
  const centroidX =
    coreItems.reduce((sum, item) => sum + item.x, 0) / (coreItems.length || 1);
  const centroidY =
    coreItems.reduce((sum, item) => sum + item.y, 0) / (coreItems.length || 1);

  const clusters = floodFillClusters(defenseCoords);
  const added: BuildPlanItemData[] = [];
  const flagged: string[] = [];

  for (const cluster of clusters) {
    const cset = new Set(cluster);

    for (const coordKey of cluster) {
      const [x, y] = parseKey(coordKey);
      const itemsHere = itemsByCoord.get(coordKey) ?? [];
      const isRampart = itemsHere.some((item) => item.structureType === "STRUCTURE_RAMPART");
      const isWall = itemsHere.some((item) => item.structureType === "STRUCTURE_WALL");
      if (!isRampart || isWall) continue;

      const hasOtherStructure = itemsHere.some(
        (item) => !DEFENSE_TYPES.has(item.structureType) && item.structureType !== "STRUCTURE_ROAD",
      );
      if (hasOtherStructure) continue;

      if (isPartOf2x2Block(cset, x, y)) continue;

      // Only a neighbor perpendicular to the tile's local run direction adds
      // real width — a neighbor that merely extends the same line doesn't.
      // Figure out which axis the cluster runs along at this tile and only
      // offer the other axis as backing candidates. For corners/isolated
      // tiles (ambiguous run direction) fall back to all 4 neighbors.
      const hasHorizontalRun = cset.has(key(x - 1, y)) || cset.has(key(x + 1, y));
      const hasVerticalRun = cset.has(key(x, y - 1)) || cset.has(key(x, y + 1));

      let neighborOffsets: Array<[number, number]>;
      if (hasHorizontalRun && !hasVerticalRun) {
        neighborOffsets = [
          [0, 1],
          [0, -1],
        ];
      } else if (hasVerticalRun && !hasHorizontalRun) {
        neighborOffsets = [
          [1, 0],
          [-1, 0],
        ];
      } else {
        neighborOffsets = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ];
      }

      const candidates = neighborOffsets
        .map(([dx, dy]) => ({ nx: x + dx, ny: y + dy }))
        .sort((a, b) => {
          const distA = (a.nx - centroidX) ** 2 + (a.ny - centroidY) ** 2;
          const distB = (b.nx - centroidX) ** 2 + (b.ny - centroidY) ** 2;
          return distA - distB;
        });

      let placed = false;
      for (const { nx, ny } of candidates) {
        const nk = key(nx, ny);

        if (defenseCoords.has(nk)) {
          placed = true;
          break;
        }

        if (nx < 1 || nx > 48 || ny < 1 || ny > 48) continue;
        if (isNaturalWall(terrain, nx, ny)) continue;
        if (wouldBlockExit(terrain, nx, ny)) continue;

        const existingHere = itemsByCoord.get(nk) ?? [];
        if (existingHere.some((item) => item.structureType === "STRUCTURE_WALL")) continue;

        const newItem: BuildPlanItemData = { x: nx, y: ny, structureType: "STRUCTURE_RAMPART" };
        added.push(newItem);
        itemsByCoord.set(nk, [...existingHere, newItem]);
        defenseCoords.add(nk);
        placed = true;
        break;
      }

      if (!placed) {
        flagged.push(`${roomName} (${x},${y}): no valid backing tile (all neighbors are walls/edges)`);
      }
    }
  }

  return { plan: [...plan, ...added], added: added.map((item) => key(item.x, item.y)), flagged };
}

// Reorders the plan so every connected rampart/wall cluster builds as one
// contiguous run (nearest-neighbor order from the earliest-indexed tile),
// instead of being scattered across the array between unrelated structures.
// Non-defense items keep their original relative order.
function groupDefenseClusters(plan: BuildPlanItemData[]): BuildPlanItemData[] {
  const defenseCoords = new Set<string>();
  for (const item of plan) {
    if (DEFENSE_TYPES.has(item.structureType)) {
      defenseCoords.add(key(item.x, item.y));
    }
  }

  const clusters = floodFillClusters(defenseCoords);
  const coordToCluster = new Map<string, string[]>();
  for (const cluster of clusters) {
    for (const coordKey of cluster) {
      coordToCluster.set(coordKey, cluster);
    }
  }

  const itemsByCoord = new Map<string, BuildPlanItemData[]>();
  for (const item of plan) {
    const k = key(item.x, item.y);
    const list = itemsByCoord.get(k) ?? [];
    list.push(item);
    itemsByCoord.set(k, list);
  }

  const emitted = new Set<string>();
  const result: BuildPlanItemData[] = [];

  function emitClusterOrdered(cluster: string[], startCoordKey: string): void {
    const remaining = new Set(cluster);
    remaining.delete(startCoordKey);
    const order = [startCoordKey];
    let current = startCoordKey;

    while (remaining.size > 0) {
      const [cx, cy] = parseKey(current);
      let best: string | null = null;
      let bestDist = Number.POSITIVE_INFINITY;

      for (const candidate of remaining) {
        const [nx, ny] = parseKey(candidate);
        const dist = (nx - cx) ** 2 + (ny - cy) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = candidate;
        }
      }

      order.push(best as string);
      remaining.delete(best as string);
      current = best as string;
    }

    for (const coordKey of order) {
      for (const item of itemsByCoord.get(coordKey) ?? []) {
        if (DEFENSE_TYPES.has(item.structureType)) {
          result.push(item);
        }
      }
      emitted.add(coordKey);
    }
  }

  for (const item of plan) {
    const k = key(item.x, item.y);
    if (DEFENSE_TYPES.has(item.structureType)) {
      if (emitted.has(k)) continue;
      emitClusterOrdered(coordToCluster.get(k) as string[], k);
    } else {
      result.push(item);
    }
  }

  return result;
}

function reorganizePlans(plans: BuildPlansData): {
  plans: BuildPlansData;
  added: Record<string, string[]>;
  flagged: string[];
} {
  const nextPlans: BuildPlansData = {};
  const added: Record<string, string[]> = {};
  const flagged: string[] = [];

  for (const [roomName, roomPlan] of Object.entries(plans)) {
    const widened = widenRoom(roomName, roomPlan.plan);
    const grouped = groupDefenseClusters(widened.plan);
    nextPlans[roomName] = { plan: grouped };
    added[roomName] = widened.added;
    flagged.push(...widened.flagged);
  }

  return { plans: nextPlans, added, flagged };
}

function main(): void {
  const plans = readBuildPlans(root);
  const { plans: nextPlans, added, flagged } = reorganizePlans(plans);

  const jsonPath = path.join(root, "src", "buildPlans.json");
  writeFileSync(jsonPath, `${JSON.stringify(nextPlans, null, 2)}\n`);

  generateBuildPlans();

  for (const [roomName, tiles] of Object.entries(added)) {
    if (tiles.length > 0) {
      console.log(`${roomName}: added ${tiles.length} backing rampart tile(s): ${tiles.join(" ")}`);
    }
  }

  if (flagged.length > 0) {
    console.log("\nFlagged for manual review:");
    for (const line of flagged) {
      console.log(`  ${line}`);
    }
  }
}

main();
