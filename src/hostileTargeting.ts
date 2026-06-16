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
