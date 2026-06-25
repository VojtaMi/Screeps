import { getHostilePriority } from "../../hostileTargeting";

// Structures that occupy their tile so a creep cannot share it. A rampart over
// any of these is not a valid place for a defender to stand.
const BLOCKING_STRUCTURE_TYPES = new Set<StructureConstant>([
  STRUCTURE_SPAWN,
  STRUCTURE_EXTENSION,
  STRUCTURE_LINK,
  STRUCTURE_STORAGE,
  STRUCTURE_TOWER,
  STRUCTURE_OBSERVER,
  STRUCTURE_POWER_SPAWN,
  STRUCTURE_LAB,
  STRUCTURE_TERMINAL,
  STRUCTURE_NUKER,
  STRUCTURE_FACTORY,
  STRUCTURE_WALL,
]);

/** A rampart a defender can actually stand on (no blocking structure beneath). */
export function isStandableRampart(rampart: StructureRampart): boolean {
  return !rampart.pos
    .lookFor(LOOK_STRUCTURES)
    .some((structure) => BLOCKING_STRUCTURE_TYPES.has(structure.structureType));
}

/**
 * Pick the best rampart for this defender to hold, closest to `anchor`.
 * Ramparts occupied by another creep are skipped unless none are free, so two
 * defenders spread across breach points instead of stacking on one tile.
 */
export function findGuardRampart(
  room: Room,
  anchor: RoomPosition,
  self: Creep,
): StructureRampart | null {
  const ramparts = room.find(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureRampart =>
      structure.structureType === STRUCTURE_RAMPART &&
      isStandableRampart(structure),
  });
  if (ramparts.length === 0) {
    return null;
  }

  const free = ramparts.filter((rampart) => {
    const occupant = rampart.pos.lookFor(LOOK_CREEPS)[0];
    return !occupant || occupant.name === self.name;
  });
  const candidates = free.length > 0 ? free : ramparts;

  return anchor.findClosestByRange(candidates);
}

/** Choose which hostile to swing at: healers first, then the weakest. */
export function pickAttackTarget(hostiles: Creep[]): Creep | null {
  if (hostiles.length === 0) {
    return null;
  }

  return [...hostiles].sort((a, b) => {
    const priorityDifference = getHostilePriority(a) - getHostilePriority(b);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return a.hits - b.hits;
  })[0];
}
