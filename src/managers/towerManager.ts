import { findPriorityHostile } from "../hostileTargeting";

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

    for (const tower of towers) {
      const hostile = findPriorityHostile(room, tower.pos);
      if (hostile) {
        tower.attack(hostile);
      }
    }
  },
};
