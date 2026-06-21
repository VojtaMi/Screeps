import { findPriorityHostile } from "../../hostileTargeting";
import {
  getControllerDeliveryBuildPlan,
  isControllerDeliveryContainer,
} from "../../managers/buildPlanManager";
import { hasRepairWork } from "../../repairPolicy";
import { CREEP_ROLE, type CreepRole, type Role } from "../../types";
import { LOCAL_ENERGY_RANGE } from "../support/localEnergy";
import { findSameRoomSpawn } from "../support/spawns";
import { collectResourceLoot, deliverResourceLoot } from "./loot";

const MIN_DELIVERY_ENERGY_RATIO = 0.1;
const STORAGE_ENERGY_RESERVE = 50_000;
const CARRIER_REFILL_MOVE_OPTS: MoveToOpts = {
  reusePath: 10,
  visualizePathStyle: { stroke: "#ffaa00" },
};
const CARRIER_DELIVERY_MOVE_OPTS: MoveToOpts = {
  reusePath: 10,
  visualizePathStyle: { stroke: "#ffffff" },
};
const NEARBY_DROPPED_ENERGY_RANGE = 5;
const MIN_DROPPED_ENERGY_PER_RANGE = 10;
const DECAYING_REFILL_SCORE_BONUS = 8;
const FULL_REFILL_SCORE_BONUS = 3;
const MAX_PARTIAL_REFILL_SCORE_PENALTY = 6;
const WORKER_REFUEL_ROLES = new Set<CreepRole>([
  CREEP_ROLE.PIONEER,
  CREEP_ROLE.BUILDER,
  CREEP_ROLE.REPAIRER,
  CREEP_ROLE.UPGRADER,
]);
const WORKER_REFUEL_ROLE_PENALTY: Partial<Record<CreepRole, number>> = {
  [CREEP_ROLE.PIONEER]: 0,
  [CREEP_ROLE.BUILDER]: 0,
  [CREEP_ROLE.REPAIRER]: 4,
  [CREEP_ROLE.UPGRADER]: 8,
};

function getEnergyRatio(creep: Creep): number {
  return (
    creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY)
  );
}

function collectAdjacentDroppedEnergy(
  creep: Creep,
  container: StructureContainer,
): boolean {
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    return false;
  }

  const droppedEnergy = creep.pos
    .findInRange(FIND_DROPPED_RESOURCES, 1, {
      filter: (resource): resource is Resource<RESOURCE_ENERGY> =>
        resource.resourceType === RESOURCE_ENERGY &&
        resource.amount > 0 &&
        resource.pos.inRangeTo(container, 1) &&
        isCarrierRefillTarget(creep, resource as Resource<RESOURCE_ENERGY>),
    })
    .reduce<Resource<RESOURCE_ENERGY> | null>(
      (bestResource, resource) =>
        !bestResource || resource.amount > bestResource.amount
          ? resource
          : bestResource,
      null,
    );

  return droppedEnergy ? creep.pickup(droppedEnergy) === OK : false;
}

function collectEnergy(
  creep: Creep,
  energyTarget: EnergyRefillTarget | null = findCarrierEnergyRefillTarget(
    creep,
  ),
): boolean {
  if (energyTarget && "amount" in energyTarget) {
    const result = creep.pickup(energyTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(energyTarget, CARRIER_REFILL_MOVE_OPTS);
      return true;
    }

    return result === OK;
  }

  if (energyTarget) {
    if (
      "structureType" in energyTarget &&
      energyTarget.structureType === STRUCTURE_CONTAINER &&
      collectAdjacentDroppedEnergy(creep, energyTarget)
    ) {
      return true;
    }

    const result = creep.withdraw(energyTarget, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(energyTarget, CARRIER_REFILL_MOVE_OPTS);
      return true;
    }

    return result === OK;
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

function getAvailableRefillEnergy(
  creep: Creep,
  target: EnergyRefillTarget,
): number {
  return Math.max(
    0,
    getRefillEnergyAmount(target) - getReservedRefillCapacity(creep, target),
  );
}

function canFullyRefillFromTarget(
  creep: Creep,
  target: EnergyRefillTarget,
): boolean {
  return (
    getAvailableRefillEnergy(creep, target) >=
    creep.store.getFreeCapacity(RESOURCE_ENERGY)
  );
}

function isStorageTarget(
  target: EnergyRefillTarget | EnergyDeliveryTarget,
): target is StructureStorage {
  return (
    "structureType" in target && target.structureType === STRUCTURE_STORAGE
  );
}

function isTargetInCreepRoom(
  creep: Creep,
  target: EnergyRefillTarget | EnergyDeliveryTarget,
): boolean {
  return target.pos.roomName === creep.room.name;
}

function isEmptyTower(target: StructureTower): boolean {
  return target.store[RESOURCE_ENERGY] === 0;
}

function isUrgentAttackDeliveryTarget(
  target: EnergyDeliveryTarget | null,
): target is StructureSpawn | StructureExtension | StructureTower {
  if (!target || !("structureType" in target)) {
    return false;
  }

  return (
    target.structureType === STRUCTURE_SPAWN ||
    target.structureType === STRUCTURE_EXTENSION ||
    (target.structureType === STRUCTURE_TOWER && isEmptyTower(target))
  );
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

function isWorthCarrierDroppedEnergyTrip(
  creep: Creep,
  target: EnergyRefillTarget,
): boolean {
  if (!("amount" in target)) {
    return true;
  }

  const range = creep.pos.getRangeTo(target);
  return (
    range <= NEARBY_DROPPED_ENERGY_RANGE ||
    target.amount >= range * MIN_DROPPED_ENERGY_PER_RANGE
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
  return getAvailableRefillEnergy(creep, target) === 0;
}

function isCarrierRefillTarget(
  creep: Creep,
  target: EnergyRefillTarget,
): boolean {
  return (
    hasRefillEnergy(target) &&
    !isStorageTarget(target) &&
    isWorthCarrierDroppedEnergyTrip(creep, target) &&
    !isDroppedEnergyReservedForWorker(target) &&
    !isRefillTargetReservedByOtherCreep(creep, target) &&
    (!("structureType" in target) || !isControllerDeliveryContainer(target))
  );
}

function isAttackStorageRefillTarget(
  creep: Creep,
  target: EnergyRefillTarget,
  deliveryTarget: EnergyDeliveryTarget | null,
): target is StructureStorage {
  return (
    findPriorityHostile(creep.room, creep.pos) !== null &&
    isStorageTarget(target) &&
    isUrgentAttackDeliveryTarget(deliveryTarget) &&
    hasRefillEnergy(target) &&
    !isRefillTargetReservedByOtherCreep(creep, target)
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

function isDecayingRefillTarget(
  target: EnergyRefillTarget,
): target is DecayingEnergyTarget {
  return !("structureType" in target);
}

function getRefillTargetScore(
  creep: Creep,
  target: EnergyRefillTarget,
): number {
  const freeCapacity = creep.store.getFreeCapacity(RESOURCE_ENERGY);
  const availableEnergy = getAvailableRefillEnergy(creep, target);
  const remainingFreeCapacity = Math.max(0, freeCapacity - availableEnergy);
  const partialRefillPenalty =
    (remainingFreeCapacity / Math.max(1, freeCapacity)) *
    MAX_PARTIAL_REFILL_SCORE_PENALTY;

  return (
    creep.pos.getRangeTo(target) -
    (isDecayingRefillTarget(target) ? DECAYING_REFILL_SCORE_BONUS : 0) -
    (canFullyRefillFromTarget(creep, target) ? FULL_REFILL_SCORE_BONUS : 0) +
    partialRefillPenalty
  );
}

function findBestCarrierRefillTarget<T extends EnergyRefillTarget>(
  creep: Creep,
  targets: T[],
): T | null {
  return targets.reduce<T | null>((bestTarget, target) => {
    if (!bestTarget) {
      return target;
    }

    const score = getRefillTargetScore(creep, target);
    const bestScore = getRefillTargetScore(creep, bestTarget);
    if (score !== bestScore) {
      return score < bestScore ? target : bestTarget;
    }

    const availableEnergy = getAvailableRefillEnergy(creep, target);
    const bestAvailableEnergy = getAvailableRefillEnergy(creep, bestTarget);
    if (availableEnergy !== bestAvailableEnergy) {
      return availableEnergy > bestAvailableEnergy ? target : bestTarget;
    }

    return creep.pos.getRangeTo(target) < creep.pos.getRangeTo(bestTarget)
      ? target
      : bestTarget;
  }, null);
}

function findAttackStorageRefillTarget(
  creep: Creep,
  deliveryTarget: EnergyDeliveryTarget | null,
): StructureStorage | null {
  const storage = creep.room.storage;
  if (
    !storage ||
    !isAttackStorageRefillTarget(creep, storage, deliveryTarget)
  ) {
    return null;
  }

  return storage;
}

function findCarrierLocalRefillTarget(creep: Creep): EnergyRefillTarget | null {
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
  const containers = creep.room.find(FIND_STRUCTURES, {
    filter: (structure): structure is StructureContainer =>
      structure.structureType === STRUCTURE_CONTAINER &&
      isCarrierRefillTarget(creep, structure),
  });

  return findBestCarrierRefillTarget(creep, [
    ...droppedEnergy,
    ...ruins,
    ...tombstones,
    ...containers,
  ]);
}

function findCarrierEnergyRefillTarget(
  creep: Creep,
  deliveryTarget: EnergyDeliveryTarget | null = null,
): EnergyRefillTarget | null {
  if (creep.memory.energyTargetId) {
    const savedTarget = Game.getObjectById(creep.memory.energyTargetId);
    if (
      savedTarget &&
      isTargetInCreepRoom(creep, savedTarget) &&
      (isAttackStorageRefillTarget(creep, savedTarget, deliveryTarget) ||
        isCarrierRefillTarget(creep, savedTarget))
    ) {
      return savedTarget;
    }

    creep.clearEnergyTarget();
  }

  return rememberRefillTarget(
    creep,
    findAttackStorageRefillTarget(creep, deliveryTarget) ??
      findCarrierLocalRefillTarget(creep),
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

function canTowerAcceptFullCarrierLoad(
  creep: Creep,
  target: StructureTower,
): boolean {
  return (
    isDeliveryTargetAvailable(creep, target) &&
    target.store.getFreeCapacity(RESOURCE_ENERGY) -
      getReservedDeliveryEnergy(creep, target) >=
      creep.store[RESOURCE_ENERGY]
  );
}

function isStorageDeliveryTargetAvailable(
  creep: Creep,
  target: StructureStorage,
): boolean {
  return (
    isDeliveryTargetAvailable(creep, target) &&
    target.store[RESOURCE_ENERGY] + getReservedDeliveryEnergy(creep, target) <
      STORAGE_ENERGY_RESERVE
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
  if (
    savedTarget &&
    isTargetInCreepRoom(creep, savedTarget) &&
    (isStorageTarget(savedTarget)
      ? isStorageDeliveryTargetAvailable(creep, savedTarget)
      : isDeliveryTargetAvailable(creep, savedTarget))
  ) {
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

function findTowerDeliveryTarget(
  creep: Creep,
  emptyOnly = false,
): StructureTower | null {
  return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureTower =>
      structure.structureType === STRUCTURE_TOWER &&
      (!emptyOnly || isEmptyTower(structure)) &&
      canTowerAcceptFullCarrierLoad(creep, structure),
  });
}

function findStorageDeliveryTarget(creep: Creep): StructureStorage | null {
  const storage = creep.room.storage;
  if (!storage || !isStorageDeliveryTargetAvailable(creep, storage)) {
    return null;
  }

  return storage;
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

function canRefuelWorkerRole(room: Room, role: CreepRole): boolean {
  if (role === CREEP_ROLE.PIONEER) {
    return hasBuilderWork(room);
  }

  if (role === CREEP_ROLE.BUILDER) {
    return hasBuilderWork(room);
  }

  if (role === CREEP_ROLE.REPAIRER) {
    return hasRepairerWork(room);
  }

  return role === CREEP_ROLE.UPGRADER;
}

function getWorkerRefuelScore(carrier: Creep, worker: Creep): number {
  return (
    carrier.pos.getRangeTo(worker) +
    (WORKER_REFUEL_ROLE_PENALTY[worker.memory.role] ?? 0)
  );
}

function findWorkerDeliveryTarget(creep: Creep): Creep | null {
  const workers = creep.room.find(FIND_MY_CREEPS, {
    filter: (target) =>
      WORKER_REFUEL_ROLES.has(target.memory.role) &&
      canRefuelWorkerRole(creep.room, target.memory.role) &&
      !target.hasEnergy() &&
      isDeliveryTargetAvailable(creep, target),
  });

  return workers.reduce<Creep | null>((bestWorker, worker) => {
    if (
      !bestWorker ||
      getWorkerRefuelScore(creep, worker) <
        getWorkerRefuelScore(creep, bestWorker)
    ) {
      return worker;
    }

    return bestWorker;
  }, null);
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

  const emptyTower = findTowerDeliveryTarget(creep, true);
  if (emptyTower) {
    return rememberDeliveryTarget(creep, emptyTower);
  }

  const storage = findStorageDeliveryTarget(creep);
  if (storage) {
    return rememberDeliveryTarget(creep, storage);
  }

  const tower = findTowerDeliveryTarget(creep);
  if (tower) {
    return rememberDeliveryTarget(creep, tower);
  }

  const worker = findWorkerDeliveryTarget(creep);
  if (worker) {
    return rememberDeliveryTarget(creep, worker);
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
    creep.moveToAvoidingRoomEdges(deliveryTarget, CARRIER_DELIVERY_MOVE_OPTS);
    return true;
  }

  if (result === OK) {
    return true;
  }

  clearDeliveryTarget(creep);
  return false;
}

function hasBuilderWork(room: Room): boolean {
  return room.find(FIND_CONSTRUCTION_SITES).length > 0;
}

function hasRepairerWork(room: Room): boolean {
  return hasRepairWork(room);
}

export const carrier: Role = {
  run(creep: Creep): void {
    if (creep.store[RESOURCE_ENERGY] === 0 && collectResourceLoot(creep)) {
      return;
    }

    if (deliverResourceLoot(creep)) {
      return;
    }

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

      const spawn = findSameRoomSpawn(creep);
      if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
        creep.moveToAvoidingRoomEdges(spawn, {
          ...CARRIER_DELIVERY_MOVE_OPTS,
          requestSwap: false,
        });
        return;
      }
      creep.moveOffRoad();
      return;
    }

    const deliveryTarget = findCarrierDeliveryTarget(creep);
    const refillTarget = findCarrierEnergyRefillTarget(creep, deliveryTarget);

    if (shouldDeliverPartialEnergy(creep, refillTarget, deliveryTarget)) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      deliverEnergy(creep, deliveryTarget);
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
      return;
    }

    creep.moveOffRoad();
  },
};
