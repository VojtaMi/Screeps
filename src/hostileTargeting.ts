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

/**
 * The room is facing an attack its towers cannot simply shrug off: at least one
 * combat hostile out-heals or out-ranges what the towers can do to it.
 *
 * This is the room's single "we are in trouble" signal. Spawn policy switches to
 * wartime priorities on it, and soft civilian creeps stand down on it, so both
 * agree on when the attack starts and ends. Hostiles the towers can delete on
 * their own deliberately do not trip it: the economy keeps running through a
 * lone invader.
 */
export function isRoomUnderUnsafeAttack(
  room: Room,
  hostiles = room.find(FIND_HOSTILE_CREEPS),
): boolean {
  return hostiles
    .filter(isHostileCombatCreep)
    .some((hostile) => !canTowersOverpowerHostile(room, hostile, hostiles));
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

/** Choose the weakest hostile at the highest combat priority. */
export function pickHostileTarget(hostiles: Creep[]): Creep | null {
  return (
    [...hostiles].sort((left, right) => {
      const priorityDifference =
        getHostilePriority(left) - getHostilePriority(right);
      return priorityDifference !== 0
        ? priorityDifference
        : left.hits - right.hits;
    })[0] ?? null
  );
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
 * hold fire so their energy can heal defenders or shore up the breach.
 */
export function shouldTowersFireAtHostile(
  room: Room,
  hostile: Creep,
  hostiles = room.find(FIND_HOSTILE_CREEPS),
  additionalDamage = 0,
): boolean {
  const towerDamage = getTowerDamageAtPosition(room, hostile.pos);
  if (towerDamage === 0) {
    return false;
  }

  const incomingHealing = getIncomingHostileHealing(hostile, hostiles);

  // Already damaged enough to finish despite healing this tick.
  const totalDamage = towerDamage + additionalDamage;

  if (totalDamage >= hostile.hits + incomingHealing) {
    return true;
  }

  // We out-damage their healing, so firing makes real progress.
  if (totalDamage > incomingHealing) {
    return true;
  }

  return false;
}

/**
 * Return the hostile a ranged defender would select this tick, together with
 * the damage the in-range ranged defenders can contribute to that target.
 * This mirrors roles/support/defense.ts without making tower logic depend on
 * role execution order.
 */
export function findDefenderAttack(
  room: Room,
  hostiles = room.find(FIND_HOSTILE_CREEPS),
): { target: Creep; damage: number } | null {
  const defenders = room
    .find(FIND_MY_CREEPS)
    .filter((creep) => creep.getActiveBodyparts(RANGED_ATTACK) > 0);
  const attacks = new Map<string, { target: Creep; damage: number }>();

  for (const defender of defenders) {
    const target = pickHostileTarget(
      hostiles.filter((hostile) => defender.pos.inRangeTo(hostile, 3)),
    );

    if (!target) {
      continue;
    }

    const current = attacks.get(target.id);
    const damage = getEffectiveRangedAttackPower(defender);
    attacks.set(target.id, {
      target,
      damage: (current?.damage ?? 0) + damage,
    });
  }

  const target = pickHostileTarget(
    [...attacks.values()].map((attack) => attack.target),
  );
  return target ? (attacks.get(target.id) ?? null) : null;
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

function getEffectiveRangedAttackPower(creep: Creep): number {
  return creep.body.reduce((total, part) => {
    if (part.type !== RANGED_ATTACK || part.hits <= 0) {
      return total;
    }

    const multiplier = part.boost
      ? (BOOSTS[RANGED_ATTACK][part.boost]?.rangedAttack ?? 1)
      : 1;
    return total + RANGED_ATTACK_POWER * multiplier;
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
