import { isHostileCombatCreep } from "./hostileTargeting";

// Repair targets within this range of a hostile combat creep are "contested":
// a creep repairing them must stand in enemy fire. Towers cover breach repair
// instead, so creep repairers steer clear.
export const REPAIR_DANGER_RANGE = 5;

export const CRITICAL_INFRASTRUCTURE_DAMAGE_RATIO = 0.5;
export const MAINTENANCE_INFRASTRUCTURE_DAMAGE_RATIO = 0.9;
export const DEFENSE_TARGET_HITS = 10_000;
export const DEFENSE_MAINTENANCE_TARGET_HITS = 100_000;
export const DEFENSE_UPGRADE_TARGET_HITS = 500_000;
export const DEFENSE_FORTIFICATION_TARGET_HITS = 2_000_000;
const BUILDER_FRESH_DEFENSE_RANGE = 3;
const REPAIR_PRIORITY_WEIGHT = 50;

export type RepairTarget =
  | StructureRoad
  | StructureContainer
  | StructureRampart
  | StructureWall;

interface RoomRepairCache {
  tick: number;
  combatHostiles: Creep[];
  targets: RepairTarget[];
}

const repairCacheByRoom = new Map<string, RoomRepairCache>();

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

  if (isDefenseTarget(target) && target.hits < DEFENSE_UPGRADE_TARGET_HITS) {
    return 5;
  }

  if (isInfrastructureTarget(target) && target.hits < target.hitsMax) {
    return 6;
  }

  if (
    isDefenseTarget(target) &&
    target.hits < DEFENSE_FORTIFICATION_TARGET_HITS
  ) {
    return 7;
  }

  return Infinity;
}

function getRepairScore(target: RepairTarget): number {
  if (isDefenseTarget(target)) {
    const targetHits =
      target.hits < DEFENSE_TARGET_HITS
        ? DEFENSE_TARGET_HITS
        : target.hits < DEFENSE_MAINTENANCE_TARGET_HITS
          ? DEFENSE_MAINTENANCE_TARGET_HITS
          : target.hits < DEFENSE_UPGRADE_TARGET_HITS
            ? DEFENSE_UPGRADE_TARGET_HITS
            : DEFENSE_FORTIFICATION_TARGET_HITS;

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
  return getRoomRepairCache(room).combatHostiles;
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

function getRoomRepairCache(room: Room): RoomRepairCache {
  const cached = repairCacheByRoom.get(room.name);
  if (cached?.tick === Game.time) {
    return cached;
  }

  const combatHostiles = room.find(FIND_HOSTILE_CREEPS, {
    filter: isHostileCombatCreep,
  });
  const targets = room.find(FIND_STRUCTURES, {
    filter: (structure): structure is RepairTarget =>
      isRepairTarget(structure) &&
      getRepairPriority(structure) !== Infinity &&
      !isContestedBy(structure, combatHostiles),
  });

  const cache = { tick: Game.time, combatHostiles, targets };
  repairCacheByRoom.set(room.name, cache);
  return cache;
}

export function findBestRepairTarget(room: Room): RepairTarget | null {
  return getRoomRepairCache(room).targets.reduce<RepairTarget | null>(
    (bestTarget, target) => {
      if (isBetterRepairTarget(target, bestTarget)) {
        return target;
      }

      return bestTarget;
    },
    null,
  );
}

export function findBestRepairTargetForCreep(
  creep: Creep,
): RepairTarget | null {
  return getRoomRepairCache(creep.room).targets.reduce<RepairTarget | null>(
    (bestTarget, target) => {
      if (isBetterRepairTargetForCreep(creep, target, bestTarget)) {
        return target;
      }

      return bestTarget;
    },
    null,
  );
}

// A rampart or wall exists with 1 hit the tick its construction site completes.
// The builder that completed it is already within build range, so only nearby
// builders top it up instead of pulling every builder across the room.
export function findFreshDefenseForCreep(creep: Creep): RepairTarget | null {
  return getRoomRepairCache(creep.room).targets.reduce<RepairTarget | null>(
    (bestTarget, target) => {
      const targetRange = creep.pos.getRangeTo(target);
      if (
        !isDefenseTarget(target) ||
        target.hits >= DEFENSE_TARGET_HITS ||
        targetRange > BUILDER_FRESH_DEFENSE_RANGE
      ) {
        return bestTarget;
      }

      if (
        !bestTarget ||
        target.hits < bestTarget.hits ||
        (target.hits === bestTarget.hits &&
          targetRange < creep.pos.getRangeTo(bestTarget))
      ) {
        return target;
      }

      return bestTarget;
    },
    null,
  );
}

export function hasRepairWork(room: Room): boolean {
  return findBestRepairTarget(room) !== null;
}

export function getDesiredRepairerCount(room: Room): number {
  const target = findBestRepairTarget(room);
  if (!target) return 0;

  const priority = getRepairPriority(target);
  if (priority === 1) return 2;
  if (priority < 5) return 1;

  const hasFortificationWork = getRoomRepairCache(room).targets.some(
    (repairTarget) =>
      isDefenseTarget(repairTarget) &&
      repairTarget.hits < DEFENSE_FORTIFICATION_TARGET_HITS,
  );
  return hasFortificationWork ? 1 : 0;
}
