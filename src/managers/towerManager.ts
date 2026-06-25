import {
  findPriorityHostile,
  shouldTowersFireAtHostile,
} from "../hostileTargeting";

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
    // Pick one shared target so towers focus fire instead of splitting damage.
    const target =
      hostiles.length > 0 ? findPriorityHostile(room, towers[0].pos) : null;
    const shouldFire =
      target !== null && shouldTowersFireAtHostile(room, target, hostiles);

    const woundedFriendly = shouldFire ? null : findMostWoundedFriendly(room);

    for (const tower of towers) {
      if (shouldFire && target) {
        tower.attack(target);
        continue;
      }

      // Hold fire to save energy; spend idle ticks healing defenders instead.
      if (woundedFriendly) {
        tower.heal(woundedFriendly);
      }
    }
  },
};

function findMostWoundedFriendly(room: Room): Creep | null {
  return room
    .find(FIND_MY_CREEPS, {
      filter: (creep) => creep.hits < creep.hitsMax,
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
