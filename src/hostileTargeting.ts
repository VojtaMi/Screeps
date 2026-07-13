const HOSTILE_CORE_THREAT_RANGE = 3;
const HOSTILE_MELEE_DANGER_RANGE = 1;
const HOSTILE_RANGED_DANGER_RANGE = 3;
// Hostile healers cannot always focus the same target, so let towers test
// favorable shots against a conservative fraction of their potential healing.
const TOWER_EXPECTED_HEALING_FACTOR = 0.7;
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

    const hitsDifference = a.hits - b.hits;
    if (hitsDifference !== 0) {
      return hitsDifference;
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
 * tower damage out-paces the expected portion of potential hostile healing.
 * When that estimate wins, towers hold fire so their energy can heal defenders
 * or shore up the breach.
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

  const incomingHealing =
    getIncomingHostileHealing(hostile, hostiles) *
    TOWER_EXPECTED_HEALING_FACTOR;

  // Already damaged enough to finish despite healing this tick.
  if (towerDamage >= hostile.hits + incomingHealing) {
    return true;
  }

  // We out-damage their healing, so firing makes real progress.
  if (towerDamage > incomingHealing) {
    return true;
  }

  return false;
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

type HealAction = "heal" | "rangedHeal";

function getEffectiveHealPower(creep: Creep, action: HealAction): number {
  const basePower = action === "heal" ? HEAL_POWER : RANGED_HEAL_POWER;

  return creep.body.reduce((total, part) => {
    if (part.type !== HEAL || part.hits <= 0) {
      return total;
    }

    const multiplier = part.boost
      ? (BOOSTS[HEAL][part.boost]?.[action] ?? 1)
      : 1;
    return total + basePower * multiplier;
  }, 0);
}

export function getIncomingHostileHealing(
  hostile: Creep,
  hostiles: Creep[],
): number {
  return hostiles.reduce((total, healer) => {
    if (healer.pos.isNearTo(hostile)) {
      return total + getEffectiveHealPower(healer, "heal");
    }

    if (healer.pos.inRangeTo(hostile, 3)) {
      return total + getEffectiveHealPower(healer, "rangedHeal");
    }

    return total;
  }, 0);
}
