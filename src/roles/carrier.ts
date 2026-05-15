import {
  getControllerDeliveryBuildPlan,
  isControllerDeliveryContainer,
} from "../managers/buildPlanManager";
import { CREEP_ROLE, type Role } from "../types";
import { LOCAL_ENERGY_RANGE } from "./support/localEnergy";

const MIN_DELIVERY_ENERGY_RATIO = 0.1;
const WORKER_REFUEL_ROLES = new Set<string>([
  CREEP_ROLE.BUILDER,
  CREEP_ROLE.REPAIRER,
  CREEP_ROLE.UPGRADER,
]);

function getEnergyRatio(creep: Creep): number {
  return (
    creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY)
  );
}

function collectEnergy(
  creep: Creep,
  energyTarget: EnergyRefillTarget | null = findCarrierEnergyRefillTarget(
    creep,
  ),
): boolean {
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

function getRefillEnergyAmount(target: EnergyRefillTarget): number {
  if ("amount" in target) {
    return target.resourceType === RESOURCE_ENERGY ? target.amount : 0;
  }

  return target.store[RESOURCE_ENERGY];
}

function hasRefillEnergy(target: EnergyRefillTarget): boolean {
  return getRefillEnergyAmount(target) > 0;
}

function isWorkerRefuelCreep(target: EnergyDeliveryTarget): target is Creep {
  return target instanceof Creep && WORKER_REFUEL_ROLES.has(target.memory.role);
}

function hasNearbyWorker(resource: Resource<RESOURCE_ENERGY>): boolean {
  return (
    resource.pos.findInRange(FIND_MY_CREEPS, LOCAL_ENERGY_RANGE, {
      filter: (creep) => WORKER_REFUEL_ROLES.has(creep.memory.role),
    }).length > 0
  );
}

function isDroppedEnergyReservedForWorker(target: EnergyRefillTarget): boolean {
  return (
    "amount" in target &&
    target.resourceType === RESOURCE_ENERGY &&
    hasNearbyWorker(target)
  );
}

function getReservedRefillCapacity(
  creep: Creep,
  target: EnergyRefillTarget,
): number {
  return Object.values(Game.creeps)
    .filter(
      (otherCreep) =>
        otherCreep.name !== creep.name &&
        otherCreep.memory.energyTargetId === target.id,
    )
    .reduce(
      (total, otherCreep) =>
        total + otherCreep.store.getFreeCapacity(RESOURCE_ENERGY),
      0,
    );
}

function isRefillTargetReservedByOtherCreep(
  creep: Creep,
  target: EnergyRefillTarget,
): boolean {
  return (
    getReservedRefillCapacity(creep, target) >= getRefillEnergyAmount(target)
  );
}

function isCarrierRefillTarget(
  creep: Creep,
  target: EnergyRefillTarget,
): boolean {
  return (
    hasRefillEnergy(target) &&
    !isDroppedEnergyReservedForWorker(target) &&
    !isRefillTargetReservedByOtherCreep(creep, target) &&
    (!("structureType" in target) || !isControllerDeliveryContainer(target))
  );
}

function rememberRefillTarget(
  creep: Creep,
  target: EnergyRefillTarget | null,
): EnergyRefillTarget | null {
  if (target) {
    creep.memory.energyTargetId = target.id;
  }

  return target;
}

function findCarrierEnergyContainer(creep: Creep): StructureContainer | null {
  return creep.pos.findClosestByPath(FIND_STRUCTURES, {
    filter: (structure): structure is StructureContainer =>
      structure.structureType === STRUCTURE_CONTAINER &&
      isCarrierRefillTarget(creep, structure),
  });
}

function findCarrierDecayingEnergy(creep: Creep): DecayingEnergyTarget | null {
  const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource): resource is Resource<RESOURCE_ENERGY> =>
      resource.resourceType === RESOURCE_ENERGY &&
      resource.amount > 0 &&
      isCarrierRefillTarget(creep, resource as Resource<RESOURCE_ENERGY>),
  });
  const ruins = creep.room.find(FIND_RUINS, {
    filter: (target) => isCarrierRefillTarget(creep, target),
  });
  const tombstones = creep.room.find(FIND_TOMBSTONES, {
    filter: (target) => isCarrierRefillTarget(creep, target),
  });

  return creep.pos.findClosestByPath([
    ...droppedEnergy,
    ...ruins,
    ...tombstones,
  ]);
}

function findCarrierEnergyRefillTarget(
  creep: Creep,
): EnergyRefillTarget | null {
  if (creep.memory.energyTargetId) {
    const savedTarget = Game.getObjectById(creep.memory.energyTargetId);
    if (savedTarget && isCarrierRefillTarget(creep, savedTarget)) {
      return savedTarget;
    }

    creep.clearEnergyTarget();
  }

  return rememberRefillTarget(
    creep,
    findCarrierDecayingEnergy(creep) ?? findCarrierEnergyContainer(creep),
  );
}

function getReservedDeliveryEnergy(
  creep: Creep,
  target: EnergyDeliveryTarget,
): number {
  return Object.values(Game.creeps)
    .filter(
      (otherCreep) =>
        otherCreep.name !== creep.name &&
        otherCreep.memory.deliveryTargetId === target.id,
    )
    .reduce(
      (total, otherCreep) => total + otherCreep.store[RESOURCE_ENERGY],
      0,
    );
}

function isDeliveryTargetAvailable(
  creep: Creep,
  target: EnergyDeliveryTarget,
): boolean {
  const freeCapacity = target.store.getFreeCapacity(RESOURCE_ENERGY);
  return (
    freeCapacity > 0 && getReservedDeliveryEnergy(creep, target) < freeCapacity
  );
}

function clearDeliveryTarget(creep: Creep): void {
  delete creep.memory.deliveryTargetId;
}

function findSavedDeliveryTarget(creep: Creep): EnergyDeliveryTarget | null {
  if (!creep.memory.deliveryTargetId || !creep.hasEnergy()) {
    clearDeliveryTarget(creep);
    return null;
  }

  const savedTarget = Game.getObjectById(creep.memory.deliveryTargetId);
  if (savedTarget && isDeliveryTargetAvailable(creep, savedTarget)) {
    return savedTarget;
  }

  clearDeliveryTarget(creep);
  return null;
}

function rememberDeliveryTarget(
  creep: Creep,
  target: EnergyDeliveryTarget | null,
): EnergyDeliveryTarget | null {
  if (target) {
    creep.memory.deliveryTargetId = target.id;
  }

  return target;
}

function findRefuelDeliveryTarget(
  creep: Creep,
): StructureSpawn | StructureExtension | null {
  return creep.pos.findClosestByPath(FIND_STRUCTURES, {
    filter: (structure): structure is StructureSpawn | StructureExtension =>
      (structure.structureType === STRUCTURE_SPAWN ||
        structure.structureType === STRUCTURE_EXTENSION) &&
      isDeliveryTargetAvailable(creep, structure),
  });
}

function findControllerDeliveryContainer(
  creep: Creep,
): StructureContainer | null {
  const controller = creep.room.controller;
  if (!controller) {
    return null;
  }

  const controllerDeliveryPlan = getControllerDeliveryBuildPlan(creep.room);
  if (controllerDeliveryPlan) {
    const structures = creep.room.lookForAt(
      LOOK_STRUCTURES,
      controllerDeliveryPlan.x,
      controllerDeliveryPlan.y,
    );
    const controllerDeliveryContainer = structures.find(
      (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER &&
        isDeliveryTargetAvailable(creep, structure),
    );

    if (controllerDeliveryContainer) {
      return controllerDeliveryContainer;
    }
  }

  return creep.pos.findClosestByPath(
    controller.pos.findInRange(FIND_STRUCTURES, 3, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER &&
        isDeliveryTargetAvailable(creep, structure),
    }),
  );
}

function findCarrierDeliveryTarget(creep: Creep): EnergyDeliveryTarget | null {
  const savedTarget = findSavedDeliveryTarget(creep);
  if (savedTarget) {
    return savedTarget;
  }

  const refuelTarget = findRefuelDeliveryTarget(creep);
  if (refuelTarget) {
    return rememberDeliveryTarget(creep, refuelTarget);
  }

  if (hasBuilderWork(creep.room)) {
    const builder = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
      filter: (target) =>
        target.memory.role === CREEP_ROLE.BUILDER &&
        !target.hasEnergy() &&
        isDeliveryTargetAvailable(creep, target),
    });
    if (builder) {
      return rememberDeliveryTarget(creep, builder);
    }
  }

  if (hasRepairerWork(creep.room)) {
    const repairer = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
      filter: (target) =>
        target.memory.role === CREEP_ROLE.REPAIRER &&
        !target.hasEnergy() &&
        isDeliveryTargetAvailable(creep, target),
    });
    if (repairer) {
      return rememberDeliveryTarget(creep, repairer);
    }
  }

  const upgrader = creep.pos.findClosestByPath(FIND_MY_CREEPS, {
    filter: (target) =>
      target.memory.role === CREEP_ROLE.UPGRADER &&
      !target.hasEnergy() &&
      isDeliveryTargetAvailable(creep, target),
  });
  if (upgrader) {
    return rememberDeliveryTarget(creep, upgrader);
  }

  return rememberDeliveryTarget(creep, findControllerDeliveryContainer(creep));
}

function shouldDeliverPartialEnergy(
  creep: Creep,
  refillTarget: EnergyRefillTarget | null,
  deliveryTarget: EnergyDeliveryTarget | null,
): deliveryTarget is EnergyDeliveryTarget {
  if (
    !deliveryTarget ||
    !creep.hasEnergy() ||
    getEnergyRatio(creep) <= MIN_DELIVERY_ENERGY_RATIO
  ) {
    return false;
  }

  if (!refillTarget) {
    return true;
  }

  return (
    creep.pos.getRangeTo(deliveryTarget) <= creep.pos.getRangeTo(refillTarget)
  );
}

function hasNearbyEnergyContainer(creep: Creep): boolean {
  return (
    creep.pos.findInRange(FIND_STRUCTURES, LOCAL_ENERGY_RANGE, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.store[RESOURCE_ENERGY] > 0,
    }).length > 0
  );
}

function dropLeftoverEnergyForWorker(
  carrierCreep: Creep,
  workerCreep: Creep,
): void {
  if (carrierCreep.hasEnergy() && !hasNearbyEnergyContainer(workerCreep)) {
    carrierCreep.drop(RESOURCE_ENERGY);
  }
}

function deliverEnergy(
  creep: Creep,
  deliveryTarget: EnergyDeliveryTarget | null = findCarrierDeliveryTarget(
    creep,
  ),
): boolean {
  if (!deliveryTarget) {
    clearDeliveryTarget(creep);
    return false;
  }

  const amount = Math.min(
    creep.store[RESOURCE_ENERGY],
    deliveryTarget.store.getFreeCapacity(RESOURCE_ENERGY),
  );
  const result = creep.transfer(deliveryTarget, RESOURCE_ENERGY, amount);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(deliveryTarget, {
      visualizePathStyle: { stroke: "#ffffff" },
    });
    return true;
  }

  if (result === OK) {
    if (isWorkerRefuelCreep(deliveryTarget)) {
      dropLeftoverEnergyForWorker(creep, deliveryTarget);
    }
    return true;
  }

  clearDeliveryTarget(creep);
  return false;
}

function hasBuilderWork(room: Room): boolean {
  return room.find(FIND_CONSTRUCTION_SITES).length > 0;
}

function hasRepairerWork(room: Room): boolean {
  return (
    room.find(FIND_STRUCTURES, {
      filter: (
        structure,
      ): structure is StructureRoad | StructureContainer | StructureRampart =>
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
      clearDeliveryTarget(creep);
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      clearDeliveryTarget(creep);
    }

    if (creep.memory.working) {
      if (deliverEnergy(creep)) {
        return;
      }

      if (creep.needsEnergy() && collectEnergy(creep)) {
        creep.memory.working = false;
        clearDeliveryTarget(creep);
        return;
      }

      const spawn = Game.spawns.Spawn1;
      if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
        creep.moveToAvoidingRoomEdges(spawn, {
          visualizePathStyle: { stroke: "#ffffff" },
        });
      }
      return;
    }

    const refillTarget = findCarrierEnergyRefillTarget(creep);
    const deliveryTarget = findCarrierDeliveryTarget(creep);

    if (shouldDeliverPartialEnergy(creep, refillTarget, deliveryTarget)) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      creep.transferEnergyTo(deliveryTarget);
      return;
    }

    clearDeliveryTarget(creep);

    if (collectEnergy(creep, refillTarget)) {
      return;
    }

    if (creep.hasEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      clearDeliveryTarget(creep);
    }
  },
};
