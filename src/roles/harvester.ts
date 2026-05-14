import type { Role } from "../types";

export const harvester: Role = {
  run(creep: Creep): void {
    const source = creep.memory.sourceId ? Game.getObjectById(creep.memory.sourceId) : null;

    if (!source) {
      creep.goToSource();
      return;
    }

    if (creep.hasEnergy()) {
      const container = creep.findAdjacentSourceContainer(source);
      if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        creep.transferEnergyTo(container);
      } else if (creep.hasFullEnergy()) {
        creep.drop(RESOURCE_ENERGY);
      }
      return;
    }

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(source, { visualizePathStyle: { stroke: "#ffaa00" } });
    }
  },
};
