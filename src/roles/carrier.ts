import type { Role } from "../types";

export const carrier: Role = {
  run(creep: Creep): void {
    if (creep.memory.working && !creep.hasEnergy()) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }

    if (creep.memory.working) {
      const refuelTarget = creep.findRefuelStructure();
      if (refuelTarget) {
        creep.transferEnergyTo(refuelTarget);
        return;
      }

      const upgrader = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
        filter: target =>
          target.memory.role === "upgrader" && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
      });
      if (upgrader) {
        creep.transferEnergyTo(upgrader);
        return;
      }

      const controllerContainer = creep.findControllerContainer();
      if (controllerContainer) {
        creep.transferEnergyTo(controllerContainer);
        return;
      }

      const spawn = Game.spawns.Spawn1;
      if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
        creep.moveToAvoidingRoomEdges(spawn, { visualizePathStyle: { stroke: "#ffffff" } });
      }
      return;
    }

    const energyTarget = creep.findEnergyRefillTarget();
    if (energyTarget instanceof Resource) {
      creep.pickUpEnergy(energyTarget);
      return;
    }

    if (energyTarget) {
      creep.withdrawEnergyFrom(energyTarget);
      return;
    }

    if (creep.hasEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }
  },
};
