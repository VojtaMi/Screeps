export function findSameRoomSpawn(creep: Creep): StructureSpawn | null {
  return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureSpawn =>
      structure.structureType === STRUCTURE_SPAWN,
  });
}
