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
