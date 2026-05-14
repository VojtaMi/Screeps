import type { Role } from "../types";

function collectEnergy(creep: Creep): boolean {
  const energyTarget = creep.findEnergyRefillTarget();
  if (energyTarget && "amount" in energyTarget) {
    creep.pickUpEnergy(energyTarget);
    return true;
  }

  if (energyTarget) {
    creep.withdrawEnergyFrom(energyTarget);
    return true;
  }

  return false;
}

function hasBuilderWork(room: Room): boolean {
  if (room.find(FIND_CONSTRUCTION_SITES).length > 0) {
    return true;
  }

  return (
    room.find(FIND_STRUCTURES, {
      filter: (structure): structure is StructureRoad | StructureContainer | StructureRampart =>
        (structure.structureType === STRUCTURE_ROAD ||
          structure.structureType === STRUCTURE_CONTAINER ||
          structure.structureType === STRUCTURE_RAMPART) &&
        structure.hits < structure.hitsMax,
    }).length > 0
  );
}

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

      if (hasBuilderWork(creep.room)) {
        const builder = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
          filter: target =>
            target.memory.role === "builder" && target.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
        });
        if (builder) {
          creep.transferEnergyTo(builder);
          return;
        }
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

      if (creep.needsEnergy() && collectEnergy(creep)) {
        creep.memory.working = false;
        return;
      }

      const spawn = Game.spawns.Spawn1;
      if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
        creep.moveToAvoidingRoomEdges(spawn, { visualizePathStyle: { stroke: "#ffffff" } });
      }
      return;
    }

    if (collectEnergy(creep)) {
      return;
    }

    if (creep.hasEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }
  },
};
