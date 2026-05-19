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

export function getRepairPriority(target: RepairTarget): number | null {
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

  return null;
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

  if (targetPriority === null) {
    return false;
  }

  if (currentPriority === null || targetPriority < currentPriority) {
    return true;
  }

  return (
    targetPriority === currentPriority &&
    getRepairScore(target) < getRepairScore(currentBest)
  );
}

function getCreepRepairScore(
  creep: Creep,
  target: RepairTarget,
): number | null {
  const priority = getRepairPriority(target);
  if (priority === null) {
    return null;
  }

  return priority * REPAIR_PRIORITY_WEIGHT + creep.pos.getRangeTo(target);
}

function isBetterRepairTargetForCreep(
  creep: Creep,
  target: RepairTarget,
  currentBest: RepairTarget | null,
): boolean {
  if (!currentBest) {
    return getCreepRepairScore(creep, target) !== null;
  }

  const targetScore = getCreepRepairScore(creep, target);
  const currentScore = getCreepRepairScore(creep, currentBest);

  if (targetScore === null) {
    return false;
  }

  if (currentScore === null || targetScore < currentScore) {
    return true;
  }

  return (
    targetScore === currentScore &&
    getRepairScore(target) < getRepairScore(currentBest)
  );
}

export function findBestRepairTarget(room: Room): RepairTarget | null {
  const repairTargets = room.find(FIND_STRUCTURES, {
    filter: (structure): structure is RepairTarget =>
      isRepairTarget(structure) && getRepairPriority(structure) !== null,
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
  const repairTargets = creep.room.find(FIND_STRUCTURES, {
    filter: (structure): structure is RepairTarget =>
      isRepairTarget(structure) && getRepairPriority(structure) !== null,
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
