import { isHostileCombatCreep } from "./hostileTargeting";

// Repair targets within this range of a hostile combat creep are "contested":
// a creep repairing them must stand in enemy fire. Towers cover breach repair
// instead, so creep repairers steer clear.
export const REPAIR_DANGER_RANGE = 5;

export const CRITICAL_INFRASTRUCTURE_DAMAGE_RATIO = 0.5;
export const MAINTENANCE_INFRASTRUCTURE_DAMAGE_RATIO = 0.9;
export const DEFENSE_TARGET_HITS = 10_000;
export const DEFENSE_MAINTENANCE_TARGET_HITS = 100_000;
const REPAIR_PRIORITY_WEIGHT = 50;

export type RepairTarget =
  | StructureRoad
  | StructureContainer
  | StructureRampart
  | StructureWall;

export function isRepairTarget(
  structure: Structure,
): structure is RepairTarget {
  return (
    structure.structureType === STRUCTURE_ROAD ||
    structure.structureType === STRUCTURE_CONTAINER ||
    structure.structureType === STRUCTURE_RAMPART ||
    structure.structureType === STRUCTURE_WALL
  );
}

function isInfrastructureTarget(
  structure: RepairTarget,
): structure is StructureRoad | StructureContainer {
  return (
    structure.structureType === STRUCTURE_ROAD ||
    structure.structureType === STRUCTURE_CONTAINER
  );
}

function isDefenseTarget(
  structure: RepairTarget,
): structure is StructureRampart | StructureWall {
  return (
    structure.structureType === STRUCTURE_RAMPART ||
    structure.structureType === STRUCTURE_WALL
  );
}

export function getRepairPriority(target: RepairTarget): number {
  if (
    isInfrastructureTarget(target) &&
    target.hits / target.hitsMax < CRITICAL_INFRASTRUCTURE_DAMAGE_RATIO
  ) {
    return 1;
  }

  if (isDefenseTarget(target) && target.hits < DEFENSE_TARGET_HITS) {
    return 2;
  }

  if (
    isInfrastructureTarget(target) &&
    target.hits / target.hitsMax < MAINTENANCE_INFRASTRUCTURE_DAMAGE_RATIO
  ) {
    return 3;
  }

  if (
    isDefenseTarget(target) &&
    target.hits < DEFENSE_MAINTENANCE_TARGET_HITS
  ) {
    return 4;
  }

  if (isInfrastructureTarget(target) && target.hits < target.hitsMax) {
    return 5;
  }

  return Infinity;
}

function getRepairScore(target: RepairTarget): number {
  if (isDefenseTarget(target)) {
    const targetHits =
      target.hits < DEFENSE_TARGET_HITS
        ? DEFENSE_TARGET_HITS
        : DEFENSE_MAINTENANCE_TARGET_HITS;

    return target.hits / targetHits;
  }

  return target.hits / target.hitsMax;
}

function isBetterRepairTarget(
  target: RepairTarget,
  currentBest: RepairTarget | null,
): boolean {
  if (!currentBest) {
    return true;
  }

  const targetPriority = getRepairPriority(target);
  const currentPriority = getRepairPriority(currentBest);

  if (targetPriority < currentPriority) {
    return true;
  }

  return (
    targetPriority === currentPriority &&
    getRepairScore(target) < getRepairScore(currentBest)
  );
}

function getCreepRepairScore(creep: Creep, target: RepairTarget): number {
  return (
    getRepairPriority(target) * REPAIR_PRIORITY_WEIGHT +
    creep.pos.getRangeTo(target)
  );
}

function isBetterRepairTargetForCreep(
  creep: Creep,
  target: RepairTarget,
  currentBest: RepairTarget | null,
): boolean {
  if (!currentBest) {
    return getCreepRepairScore(creep, target) !== Infinity;
  }

  const targetScore = getCreepRepairScore(creep, target);
  const currentScore = getCreepRepairScore(creep, currentBest);

  if (targetScore < currentScore) {
    return true;
  }

  return (
    targetScore === currentScore &&
    getRepairScore(target) < getRepairScore(currentBest)
  );
}

function getCombatHostiles(room: Room): Creep[] {
  return room.find(FIND_HOSTILE_CREEPS, { filter: isHostileCombatCreep });
}

function isContestedBy(target: RepairTarget, combatHostiles: Creep[]): boolean {
  return combatHostiles.some((hostile) =>
    hostile.pos.inRangeTo(target, REPAIR_DANGER_RANGE),
  );
}

// True when a hostile combat creep is close enough that repairing the target
// would put the repairer in the fight. Used to drop committed targets that
// become dangerous mid-repair.
export function isRepairTargetContested(
  target: RepairTarget,
  room: Room,
): boolean {
  return isContestedBy(target, getCombatHostiles(room));
}

export function findBestRepairTarget(room: Room): RepairTarget | null {
  const combatHostiles = getCombatHostiles(room);
  const repairTargets = room.find(FIND_STRUCTURES, {
    filter: (structure): structure is RepairTarget =>
      isRepairTarget(structure) &&
      getRepairPriority(structure) !== Infinity &&
      !isContestedBy(structure, combatHostiles),
  });

  return repairTargets.reduce<RepairTarget | null>((bestTarget, target) => {
    if (isBetterRepairTarget(target, bestTarget)) {
      return target;
    }

    return bestTarget;
  }, null);
}

export function findBestRepairTargetForCreep(
  creep: Creep,
): RepairTarget | null {
  const combatHostiles = getCombatHostiles(creep.room);
  const repairTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure): structure is RepairTarget =>
      isRepairTarget(structure) &&
      getRepairPriority(structure) !== Infinity &&
      !isContestedBy(structure, combatHostiles),
  });

  return repairTargets.reduce<RepairTarget | null>((bestTarget, target) => {
    if (isBetterRepairTargetForCreep(creep, target, bestTarget)) {
      return target;
    }

    return bestTarget;
  }, null);
}

export function hasRepairWork(room: Room): boolean {
  return findBestRepairTarget(room) !== null;
}
