import { BuildPlanItem, BuildPlansData, STRUCTURE_TYPE_LABELS } from "../types";

interface ValidationError {
  step: number;
  message: string;
}

export function validatePlans(
  plans: BuildPlansData,
  selectedRoom: string,
  terrain: string
): ValidationError[] {
  if (!selectedRoom) return [];

  const errors: ValidationError[] = [];
  const plan = plans[selectedRoom]?.plan ?? [];

  for (let i = 0; i < plan.length; i++) {
    const item = plan[i];

    // Validate coordinates
    if (!Number.isInteger(item.x) || item.x < 0 || item.x > 49) {
      errors.push({
        step: i,
        message: `Invalid x coordinate: ${item.x}`,
      });
      continue;
    }
    if (!Number.isInteger(item.y) || item.y < 0 || item.y > 49) {
      errors.push({
        step: i,
        message: `Invalid y coordinate: ${item.y}`,
      });
      continue;
    }

    // Check for duplicates at same position with same type
    const duplicates = plan.filter(
      (other, j) =>
        j !== i &&
        other.x === item.x &&
        other.y === item.y &&
        other.structureType === item.structureType
    );
    if (duplicates.length > 0) {
      errors.push({
        step: i,
        message: `Duplicate structure at (${item.x}, ${item.y})`,
      });
      continue;
    }

    // Check same-tile rules
    const samePos = plan.filter(
      (other, j) => j !== i && other.x === item.x && other.y === item.y
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

    // Check terrain rules
    if (terrain) {
      const terrainCode = Number(terrain[item.y * 50 + item.x] ?? 0);
      const isWall = terrainCode & 1;
      if (isWall && item.structureType !== "STRUCTURE_ROAD") {
        errors.push({
          step: i,
          message: `Cannot place ${STRUCTURE_TYPE_LABELS[item.structureType] || item.structureType} on natural wall`,
        });
      }
    }
  }

  return errors;
}

export function validateSameTile(types: string[]): boolean {
  if (types.length === 1) {
    return true;
  }

  const sortedTypes = [...types].sort();
  const hasRampart = sortedTypes.includes("STRUCTURE_RAMPART");
  const withoutRampart = sortedTypes.filter(
    (type) => type !== "STRUCTURE_RAMPART"
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
