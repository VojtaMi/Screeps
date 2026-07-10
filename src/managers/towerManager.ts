import {
  findPriorityHostile,
  getHostilePriority,
  hasHostileCombatCreeps,
  shouldTowersFireAtHostile,
} from "../hostileTargeting";

// Keep enough energy to resume attacking if the fight suddenly becomes winnable.
const TOWER_REPAIR_RESERVE = 200;
// Only shore up ramparts the attackers are actually pressing against.
const THREATENED_RAMPART_RANGE = 3;

export const towerManager = {
  manageTowers(): void {
    for (const roomName in Game.rooms) {
      this.manageRoomTowers(Game.rooms[roomName]);
    }
  },

  manageRoomTowers(room: Room): void {
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: (structure): structure is StructureTower =>
        structure.structureType === STRUCTURE_TOWER,
    });
    if (towers.length === 0) {
      return;
    }

    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const underAttack = hasHostileCombatCreeps(room, hostiles);
    const target = findLockedTowerTarget(room, hostiles, towers[0].pos);
    const shouldFire =
      target !== null && shouldTowersFireAtHostile(room, target, hostiles);

    // While holding fire during an attack, the breached rampart is the thing
    // actually failing. Towers repair it (800/tick, and never walk into danger)
    // far more safely and quickly than a creep repairer, buying time before a
    // safe mode is spent. Outside an attack, repair stays with creeps.
    const repairTarget =
      !shouldFire && underAttack ? findThreatenedRampart(room, hostiles) : null;
    const woundedDefender = underAttack
      ? findMostWoundedCombatCreep(room)
      : null;
    const woundedFriendly =
      woundedDefender || shouldFire || repairTarget
        ? null
        : findMostWoundedFriendly(room);

    for (const tower of towers) {
      if (woundedDefender) {
        tower.heal(woundedDefender);
        continue;
      }

      if (shouldFire && target) {
        tower.attack(target);
        continue;
      }

      if (repairTarget && tower.store[RESOURCE_ENERGY] > TOWER_REPAIR_RESERVE) {
        tower.repair(repairTarget);
        continue;
      }

      // Otherwise spend idle ticks healing defenders.
      if (woundedFriendly) {
        tower.heal(woundedFriendly);
      }
    }
  },
};

export function findLockedTowerTarget(
  room: Room,
  hostiles: Creep[],
  origin: RoomPosition,
): Creep | null {
  if (hostiles.length === 0) {
    delete room.memory.towerTargetId;
    return null;
  }

  const highestPriority = hostiles.reduce(
    (priority, hostile) => Math.min(priority, getHostilePriority(hostile)),
    Infinity,
  );
  const locked = room.memory.towerTargetId
    ? hostiles.find((hostile) => hostile.id === room.memory.towerTargetId)
    : undefined;
  if (locked && getHostilePriority(locked) === highestPriority) {
    return locked;
  }

  const target = findPriorityHostile(room, origin);
  if (target) {
    room.memory.towerTargetId = target.id;
  } else {
    delete room.memory.towerTargetId;
  }
  return target;
}

// The most-damaged rampart an attacker is currently pressing against.
function findThreatenedRampart(
  room: Room,
  hostiles: Creep[],
): StructureRampart | null {
  const threatened = room.find(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureRampart =>
      structure.structureType === STRUCTURE_RAMPART &&
      structure.hits < structure.hitsMax &&
      hostiles.some((hostile) =>
        hostile.pos.inRangeTo(structure, THREATENED_RAMPART_RANGE),
      ),
  });

  return threatened.reduce<StructureRampart | null>((weakest, rampart) => {
    if (!weakest || rampart.hits < weakest.hits) {
      return rampart;
    }

    return weakest;
  }, null);
}

function findMostWoundedCombatCreep(room: Room): Creep | null {
  return findMostWoundedFriendly(room, (creep) =>
    hasActiveCombatBodyparts(creep),
  );
}

function findMostWoundedFriendly(
  room: Room,
  filter: (creep: Creep) => boolean = () => true,
): Creep | null {
  return room
    .find(FIND_MY_CREEPS, {
      filter: (creep) => creep.hits < creep.hitsMax && filter(creep),
    })
    .reduce<Creep | null>((mostWounded, creep) => {
      if (
        !mostWounded ||
        creep.hitsMax - creep.hits > mostWounded.hitsMax - mostWounded.hits
      ) {
        return creep;
      }

      return mostWounded;
    }, null);
}

function hasActiveCombatBodyparts(creep: Creep): boolean {
  return (
    creep.getActiveBodyparts(ATTACK) > 0 ||
    creep.getActiveBodyparts(RANGED_ATTACK) > 0 ||
    creep.getActiveBodyparts(HEAL) > 0
  );
}
