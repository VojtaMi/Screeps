import type { BuildPlanItem, BuildPlansData, RoomLandmark } from "../types";

export const GRID_SIZE = 50;
export const TERRAIN_MASK_WALL = 1;
export const TERRAIN_MASK_SWAMP = 2;
// Screeps rejects createConstructionSite (ERR_INVALID_TARGET) for anything but
// roads/containers one tile in from a room edge (x/y === 1 or 48) if that
// placement would seal off a passable exit tile on the border itself.
export const EDGE_BUILD_MARGIN = 1;
const EDGE_EXEMPT_STRUCTURE_TYPES = new Set([
  "STRUCTURE_ROAD",
  "STRUCTURE_CONTAINER",
]);

const STRUCTURE_TYPE_LABELS: Record<string, string> = {
  STRUCTURE_SPAWN: "Spawn",
  STRUCTURE_EXTENSION: "Extension",
  STRUCTURE_CONTAINER: "Container",
  STRUCTURE_STORAGE: "Storage",
  STRUCTURE_LINK: "Link",
  STRUCTURE_ROAD: "Road",
  STRUCTURE_TOWER: "Tower",
  STRUCTURE_TERMINAL: "Terminal",
  STRUCTURE_LAB: "Lab",
  STRUCTURE_EXTRACTOR: "Extractor",
  STRUCTURE_FACTORY: "Factory",
  STRUCTURE_WALL: "Wall",
  STRUCTURE_RAMPART: "Rampart",
};

export interface ValidationError {
  roomName?: string;
  step: number;
  message: string;
}

export interface TileInspection {
  room: string;
  x: number;
  y: number;
  terrain: "plain" | "swamp" | "wall" | "unknown";
  terrainCode: number | null;
  isEdge: boolean;
  planned: Array<
    BuildPlanItem & {
      step: number;
      state: "past" | "current" | "future";
    }
  >;
  landmarks: RoomLandmark[];
  validation: ValidationError[];
}

export function getTerrainAt(terrain: string, x: number, y: number): number {
  if (!terrain || !Number.isInteger(x) || !Number.isInteger(y)) {
    return 0;
  }

  return Number(terrain[y * GRID_SIZE + x] ?? 0);
}

export function isNaturalWall(terrain: string, x: number, y: number): boolean {
  return (getTerrainAt(terrain, x, y) & TERRAIN_MASK_WALL) !== 0;
}

export function isSwamp(terrain: string, x: number, y: number): boolean {
  return (getTerrainAt(terrain, x, y) & TERRAIN_MASK_SWAMP) !== 0;
}

export function isRoomEdge(x: number, y: number): boolean {
  return x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1;
}

// True exactly one tile in from the room border, the only ring where a
// placement can possibly seal off an exit tile on the border itself.
export function isTileAfterEdge(x: number, y: number): boolean {
  const farEdge = GRID_SIZE - 1 - EDGE_BUILD_MARGIN;
  return (
    x === EDGE_BUILD_MARGIN ||
    x === farEdge ||
    y === EDGE_BUILD_MARGIN ||
    y === farEdge
  );
}

export function canPlaceNearEdge(structureType: string): boolean {
  return EDGE_EXEMPT_STRUCTURE_TYPES.has(structureType);
}

// For a tile one step in from the border, checks the up-to-3 border tiles
// (straight + 2 diagonal) that lie between it and the true edge on each side
// it borders. If any of those is passable (not natural wall), it's an exit
// tile, and blocking this position would seal it off.
export function wouldBlockExit(
  terrain: string,
  x: number,
  y: number,
): boolean {
  if (!terrain) return false;

  const lastIndex = GRID_SIZE - 1;
  const farEdge = lastIndex - EDGE_BUILD_MARGIN;
  const borderTiles: Array<[number, number]> = [];

  if (x === EDGE_BUILD_MARGIN) {
    borderTiles.push([0, y - 1], [0, y], [0, y + 1]);
  }
  if (x === farEdge) {
    borderTiles.push([lastIndex, y - 1], [lastIndex, y], [lastIndex, y + 1]);
  }
  if (y === EDGE_BUILD_MARGIN) {
    borderTiles.push([x - 1, 0], [x, 0], [x + 1, 0]);
  }
  if (y === farEdge) {
    borderTiles.push([x - 1, lastIndex], [x, lastIndex], [x + 1, lastIndex]);
  }

  return borderTiles.some(([bx, by]) => {
    if (bx < 0 || bx > lastIndex || by < 0 || by > lastIndex) return false;
    return !isNaturalWall(terrain, bx, by);
  });
}

export function validateSameTile(types: string[]): boolean {
  if (types.length === 1) {
    return true;
  }

  const sortedTypes = [...types].sort();
  const hasRampart = sortedTypes.includes("STRUCTURE_RAMPART");
  const withoutRampart = sortedTypes.filter(
    (type) => type !== "STRUCTURE_RAMPART",
  );

  if (hasRampart && withoutRampart.length === sortedTypes.length - 1) {
    return validateSameTile(withoutRampart);
  }

  return (
    sortedTypes.length === 2 &&
    sortedTypes[0] === "STRUCTURE_CONTAINER" &&
    sortedTypes[1] === "STRUCTURE_ROAD"
  );
}

function structureLabel(structureType: string): string {
  return STRUCTURE_TYPE_LABELS[structureType] ?? structureType;
}

export function validateRoomPlan(
  plan: BuildPlanItem[],
  terrain = "",
): ValidationError[] {
  const errors: ValidationError[] = [];

  const destroyedAtPos = new Map<string, Set<string>>();
  for (const item of plan) {
    if (item.action === "destroy") {
      const key = `${item.x},${item.y}`;
      const destroyed = destroyedAtPos.get(key) ?? new Set<string>();
      destroyed.add(item.structureType);
      destroyedAtPos.set(key, destroyed);
    }
  }

  for (let i = 0; i < plan.length; i += 1) {
    const item = plan[i];

    // Destroy steps don't need placement validation
    if (item.action === "destroy") continue;

    if (!Number.isInteger(item.x) || item.x < 0 || item.x > GRID_SIZE - 1) {
      errors.push({
        step: i,
        message: `Invalid x coordinate: ${item.x}`,
      });
      continue;
    }

    if (!Number.isInteger(item.y) || item.y < 0 || item.y > GRID_SIZE - 1) {
      errors.push({
        step: i,
        message: `Invalid y coordinate: ${item.y}`,
      });
      continue;
    }

    if (
      !canPlaceNearEdge(item.structureType) &&
      isTileAfterEdge(item.x, item.y) &&
      wouldBlockExit(terrain, item.x, item.y)
    ) {
      errors.push({
        step: i,
        message: `Cannot place ${structureLabel(item.structureType)} here — it would block an exit`,
      });
    }

    // Duplicate check: only compare against other build steps (not destroy steps)
    const duplicates = plan.filter(
      (other, j) =>
        j !== i &&
        !other.action &&
        other.x === item.x &&
        other.y === item.y &&
        other.structureType === item.structureType,
    );
    if (duplicates.length > 0) {
      errors.push({
        step: i,
        message: `Duplicate structure at (${item.x}, ${item.y})`,
      });
      continue;
    }

    // Same-tile check: exclude types scheduled for destruction (they're transient)
    const posKey = `${item.x},${item.y}`;
    const destroyed = destroyedAtPos.get(posKey) ?? new Set();

    if (!destroyed.has(item.structureType)) {
      const samePos = plan.filter(
        (other, j) =>
          j !== i &&
          !other.action &&
          other.x === item.x &&
          other.y === item.y &&
          !destroyed.has(other.structureType),
      );
      if (samePos.length > 0) {
        const types = [
          item.structureType,
          ...samePos.map((s) => s.structureType),
        ];
        const isValid = validateSameTile(types);
        if (!isValid) {
          errors.push({
            step: i,
            message: `Invalid same-tile combination at (${item.x}, ${item.y})`,
          });
        }
      }
    }

    if (
      terrain &&
      isNaturalWall(terrain, item.x, item.y) &&
      item.structureType !== "STRUCTURE_ROAD"
    ) {
      errors.push({
        step: i,
        message: `Cannot place ${structureLabel(item.structureType)} on natural wall`,
      });
    }
  }

  return errors;
}

export function validateBuildPlans(
  plans: BuildPlansData,
  terrains: Record<string, string> = {},
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const [roomName, roomPlan] of Object.entries(plans)) {
    const terrain = terrains[roomName] ?? "";
    const planErrors = validateRoomPlan(roomPlan.plan, terrain);

    for (const error of planErrors) {
      errors.push({
        roomName,
        ...error,
      });
    }
  }

  return errors;
}

function terrainName(code: number): "plain" | "swamp" | "wall" {
  if (code & TERRAIN_MASK_WALL) {
    return "wall";
  }
  if (code & TERRAIN_MASK_SWAMP) {
    return "swamp";
  }
  return "plain";
}

export function inspectTile({
  roomName,
  x,
  y,
  plan,
  terrain = "",
  currentStep = 0,
  landmarks = [],
}: {
  roomName: string;
  x: number;
  y: number;
  plan: BuildPlanItem[];
  terrain?: string;
  currentStep?: number;
  landmarks?: RoomLandmark[];
}): TileInspection {
  const terrainCode = getTerrainAt(terrain, x, y);
  const planned = plan
    .map((item, step) => ({
      step,
      state:
        step === currentStep - 1
          ? "current"
          : step < currentStep
            ? "past"
            : "future" as "past" | "current" | "future",
      ...item,
    }))
    .filter((item) => item.x === x && item.y === y);
  const validation = validateRoomPlan(plan, terrain).filter((error) => {
    const item = plan[error.step];
    return item?.x === x && item?.y === y;
  });
  const tileLandmarks = landmarks.filter(
    (landmark) => landmark.x === x && landmark.y === y,
  );

  return {
    room: roomName,
    x,
    y,
    terrain: terrain ? terrainName(terrainCode) : "unknown",
    terrainCode: terrain ? terrainCode : null,
    isEdge: isRoomEdge(x, y),
    planned,
    landmarks: tileLandmarks,
    validation,
  };
}
