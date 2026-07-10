export function findSameRoomSpawn(creep: Creep): StructureSpawn | null {
  // A defender can deliberately sit behind a sealed wall. Choosing a spawn by
  // path then returns null and makes defense positioning treat the defender's
  // current tile as the core. Range still identifies the owning room's spawn
  // without requiring a route through its fortifications.
  return creep.pos.findClosestByRange(FIND_MY_SPAWNS);
}
