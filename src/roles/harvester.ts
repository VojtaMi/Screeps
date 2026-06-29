import type { Role } from "../types";
import { moveToTargetRoom } from "./support/targetRoom";

export const harvester: Role = {
  run(creep: Creep): void {
    const source = creep.memory.sourceId
      ? Game.getObjectById(creep.memory.sourceId)
      : null;

    if (!source) {
      const { targetRoom } = creep.memory;
      if (targetRoom && creep.room.name !== targetRoom) {
        moveToTargetRoom(creep, targetRoom, { stroke: "#ffaa00" });
        return;
      }
      creep.goToSource();
      return;
    }

    delete creep.memory.targetRoom;

    const container = creep.findAdjacentSourceContainer(source);
    if (creep.hasFullEnergy()) {
      if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        creep.transferEnergyTo(container);
      } else {
        creep.drop(RESOURCE_ENERGY);
      }
      return;
    }

    const target = container ?? source;
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(target, {
        visualizePathStyle: { stroke: "#ffaa00" },
      });
    }
  },
};
