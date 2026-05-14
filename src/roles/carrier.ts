import type { Role } from "../types";

const MIN_DELIVERY_ENERGY_RATIO = 0.1;

type CarrierDeliveryTarget = StructureSpawn | StructureExtension | StructureContainer | AnyCreep;

function getEnergyRatio(creep: Creep): number {
  return creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY);
}

function collectEnergy(creep: Creep, energyTarget: EnergyRefillTarget | null = creep.findEnergyRefillTarget()): boolean {
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

function findCarrierDeliveryTarget(creep: Creep): CarrierDeliveryTarget | null {
  const refuelTarget = creep.findRefuelStructure();
  if (refuelTarget) {
    return refuelTarget;
  }

  if (hasBuilderWork(creep.room)) {
    const builder = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
      filter: target =>
        target.memory.role === "builder" && !target.hasEnergy(),
    });
    if (builder) {
      return builder;
    }
  }

  const upgrader = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
    filter: target =>
      target.memory.role === "upgrader" && !target.hasEnergy(),
  });
  if (upgrader) {
    return upgrader;
  }

  return creep.findControllerContainer();
}

function shouldDeliverPartialEnergy(
  creep: Creep,
  refillTarget: EnergyRefillTarget | null,
  deliveryTarget: CarrierDeliveryTarget | null
): deliveryTarget is CarrierDeliveryTarget {
  if (!deliveryTarget || !creep.hasEnergy() || getEnergyRatio(creep) <= MIN_DELIVERY_ENERGY_RATIO) {
    return false;
  }

  if (!refillTarget) {
    return true;
  }

  return creep.pos.getRangeTo(deliveryTarget) <= creep.pos.getRangeTo(refillTarget);
}

function deliverEnergy(creep: Creep, deliveryTarget: CarrierDeliveryTarget | null = findCarrierDeliveryTarget(creep)): boolean {
  if (!deliveryTarget) {
    return false;
  }

  creep.transferEnergyTo(deliveryTarget);
  return true;
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
      if (deliverEnergy(creep)) {
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

    const refillTarget = creep.findEnergyRefillTarget();
    const deliveryTarget = findCarrierDeliveryTarget(creep);

    if (shouldDeliverPartialEnergy(creep, refillTarget, deliveryTarget)) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      creep.transferEnergyTo(deliveryTarget);
      return;
    }

    if (collectEnergy(creep, refillTarget)) {
      return;
    }

    if (creep.hasEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }
  },
};
