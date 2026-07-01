const HOSTILE_CORE_THREAT_RANGE = 3;
const HOSTILE_MELEE_DANGER_RANGE = 1;
const HOSTILE_RANGED_DANGER_RANGE = 3;
const CORE_STRUCTURE_TYPES = new Set<StructureConstant>([
  STRUCTURE_SPAWN,
  STRUCTURE_STORAGE,
  STRUCTURE_TOWER,
  STRUCTURE_TERMINAL,
]);

export function isHostileCombatCreep(hostile: Creep): boolean {
  return (
    hostile.getActiveBodyparts(ATTACK) > 0 ||
    hostile.getActiveBodyparts(RANGED_ATTACK) > 0 ||
    hostile.getActiveBodyparts(HEAL) > 0
  );
}

export function hasHostileCombatCreeps(
  room: Room,
  hostiles = room.find(FIND_HOSTILE_CREEPS),
): boolean {
  return hostiles.some(isHostileCombatCreep);
}

export function isPositionInHostileWeaponRange(
  position: RoomPosition,
  hostiles = Game.rooms[position.roomName]?.find(FIND_HOSTILE_CREEPS) ?? [],
): boolean {
  return hostiles.some(
    (hostile) =>
      (hostile.getActiveBodyparts(ATTACK) > 0 &&
        hostile.pos.inRangeTo(position, HOSTILE_MELEE_DANGER_RANGE)) ||
      (hostile.getActiveBodyparts(RANGED_ATTACK) > 0 &&
        hostile.pos.inRangeTo(position, HOSTILE_RANGED_DANGER_RANGE)),
  );
}

export function getHostilePriority(hostile: Creep): number {
  if (hostile.getActiveBodyparts(HEAL) > 0) {
    return 0;
  }

  if (
    hostile.getActiveBodyparts(ATTACK) > 0 ||
    hostile.getActiveBodyparts(RANGED_ATTACK) > 0
  ) {
    return 1;
  }

  return 2;
}

export function findPriorityHostile(
  room: Room,
  origin: RoomPosition,
): Creep | null {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  if (hostiles.length === 0) {
    return null;
  }

  return hostiles.sort((a, b) => {
    const priorityDifference = getHostilePriority(a) - getHostilePriority(b);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return origin.getRangeTo(a) - origin.getRangeTo(b);
  })[0];
}

export function canTowersOverpowerHostile(
  room: Room,
  hostile: Creep,
  hostiles = room.find(FIND_HOSTILE_CREEPS),
): boolean {
  const towerDamage = getTowerDamageAtPosition(room, hostile.pos);
  const incomingHealing = getIncomingHostileHealing(hostile, hostiles);

  return towerDamage > incomingHealing;
}

/**
 * Decide whether the room's towers should spend energy firing at `hostile`.
 *
 * Towers fire when the shot can finish the target this tick, or when combined
 * tower damage out-paces incoming hostile healing. When healing wins, towers
 * hold fire to conserve energy unless the hostile is breaching ramparts or
 * threatening core structures, where spending energy is still worthwhile.
 */
export function shouldTowersFireAtHostile(
  room: Room,
  hostile: Creep,
  hostiles = room.find(FIND_HOSTILE_CREEPS),
): boolean {
  const towerDamage = getTowerDamageAtPosition(room, hostile.pos);
  if (towerDamage === 0) {
    return false;
  }

  const incomingHealing = getIncomingHostileHealing(hostile, hostiles);

  // Already damaged enough to finish despite healing this tick.
  if (towerDamage >= hostile.hits + incomingHealing) {
    return true;
  }

  // We out-damage their healing, so firing makes real progress.
  if (towerDamage > incomingHealing) {
    return true;
  }

  // Healing wins the long game; only spend energy if the hostile is breaching
  // or sitting on/near critical structures.
  return isHostileThreateningCore(hostile);
}

/** Hostile is standing on or directly beside one of our ramparts. */
export function isHostileBreachingRampart(hostile: Creep): boolean {
  return (
    hostile.pos.findInRange(FIND_MY_STRUCTURES, 1, {
      filter: (structure) => structure.structureType === STRUCTURE_RAMPART,
    }).length > 0
  );
}

/** Hostile is within striking range of a spawn, storage, tower, or terminal. */
export function isHostileNearCriticalStructure(hostile: Creep): boolean {
  return (
    hostile.pos.findInRange(FIND_MY_STRUCTURES, HOSTILE_CORE_THREAT_RANGE, {
      filter: (structure) => CORE_STRUCTURE_TYPES.has(structure.structureType),
    }).length > 0
  );
}

/**
 * Hostile has committed into the defended area: breaching a rampart line or
 * sitting next to a critical structure. Used to decide when defenders should
 * engage instead of holding, and as one signal for safe mode.
 */
export function isHostileThreateningCore(hostile: Creep): boolean {
  return (
    isHostileBreachingRampart(hostile) ||
    isHostileNearCriticalStructure(hostile)
  );
}

function getTowerDamageAtPosition(room: Room, position: RoomPosition): number {
  const towers = room.find(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureTower =>
      structure.structureType === STRUCTURE_TOWER &&
      structure.store[RESOURCE_ENERGY] >= TOWER_ENERGY_COST,
  });

  return towers.reduce(
    (total, tower) =>
      total + getTowerDamageAtRange(tower.pos.getRangeTo(position)),
    0,
  );
}

function getTowerDamageAtRange(range: number): number {
  if (range <= TOWER_OPTIMAL_RANGE) {
    return TOWER_POWER_ATTACK;
  }

  if (range >= TOWER_FALLOFF_RANGE) {
    return Math.floor(TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF));
  }

  const falloff =
    TOWER_FALLOFF *
    ((range - TOWER_OPTIMAL_RANGE) /
      (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE));

  return Math.floor(TOWER_POWER_ATTACK * (1 - falloff));
}

function getIncomingHostileHealing(hostile: Creep, hostiles: Creep[]): number {
  return hostiles.reduce((total, healer) => {
    const healParts = healer.getActiveBodyparts(HEAL);
    if (healParts === 0) {
      return total;
    }

    if (healer.pos.isNearTo(hostile)) {
      return total + healParts * HEAL_POWER;
    }

    if (healer.pos.inRangeTo(hostile, 3)) {
      return total + healParts * RANGED_HEAL_POWER;
    }

    return total;
  }, 0);
}
