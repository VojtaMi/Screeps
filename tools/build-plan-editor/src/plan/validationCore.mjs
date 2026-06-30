export const GRID_SIZE = 50;
export const TERRAIN_MASK_WALL = 1;
export const TERRAIN_MASK_SWAMP = 2;

const STRUCTURE_TYPE_LABELS = {
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

export function getTerrainAt(terrain, x, y) {
  if (!terrain || !Number.isInteger(x) || !Number.isInteger(y)) {
    return 0;
  }

  return Number(terrain[y * GRID_SIZE + x] ?? 0);
}

export function isNaturalWall(terrain, x, y) {
  return (getTerrainAt(terrain, x, y) & TERRAIN_MASK_WALL) !== 0;
}

export function isSwamp(terrain, x, y) {
  return (getTerrainAt(terrain, x, y) & TERRAIN_MASK_SWAMP) !== 0;
}

export function isRoomEdge(x, y) {
  return x === 0 || x === GRID_SIZE - 1 || y === 0 || y === GRID_SIZE - 1;
}

export function validateSameTile(types) {
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

function structureLabel(structureType) {
  return STRUCTURE_TYPE_LABELS[structureType] ?? structureType;
}

export function validateRoomPlan(plan, terrain = "") {
  const errors = [];

  // Collect destroyed types per position so same-tile checks can ignore transient structures
  const destroyedAtPos = new Map();
  for (const item of plan) {
    if (item.action === "destroy") {
      const key = `${item.x},${item.y}`;
      if (!destroyedAtPos.has(key)) destroyedAtPos.set(key, new Set());
      destroyedAtPos.get(key).add(item.structureType);
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

    if (isRoomEdge(item.x, item.y)) {
      errors.push({
        step: i,
        message: `Cannot place ${structureLabel(item.structureType)} on room edge`,
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
        const types = [item.structureType, ...samePos.map((s) => s.structureType)];
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

export function validateBuildPlans(plans, terrains = {}) {
  const errors = [];

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

function terrainName(code) {
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
}) {
  const terrainCode = getTerrainAt(terrain, x, y);
  const planned = plan
    .map((item, step) => ({
      step,
      state:
        step === currentStep - 1
          ? "current"
          : step < currentStep
            ? "past"
            : "future",
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
