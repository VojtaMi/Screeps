const FOUNDATION_EXTENSION_COUNT = 5;

export function getConstructionPriority(
  structureType: BuildableStructureConstant,
  establishedExtensionCount: number,
): number {
  if (structureType === STRUCTURE_SPAWN) return 1;
  if (
    structureType === STRUCTURE_EXTENSION &&
    establishedExtensionCount < FOUNDATION_EXTENSION_COUNT
  ) {
    return 2;
  }
  if (structureType === STRUCTURE_TOWER) return 3;
  if (structureType === STRUCTURE_CONTAINER) return 4;
  if (structureType === STRUCTURE_RAMPART || structureType === STRUCTURE_WALL) {
    return 5;
  }
  if (structureType === STRUCTURE_EXTENSION) return 6;
  if (
    structureType === STRUCTURE_STORAGE ||
    structureType === STRUCTURE_LINK ||
    structureType === STRUCTURE_TERMINAL
  ) {
    return 7;
  }
  if (structureType === STRUCTURE_ROAD) return 8;
  return 9;
}
