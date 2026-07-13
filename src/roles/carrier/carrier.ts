import {
  hasHostileCombatCreeps,
  isHostileThreateningCore,
  isPositionInHostileWeaponRange,
} from "../../hostileTargeting";
import {
  getControllerDeliveryBuildPlan,
  getControllerDeliveryContainer,
  isControllerDeliveryContainer,
} from "../../managers/buildPlanManager";
import { hasRepairWork } from "../../repairPolicy";
import { CREEP_ROLE, type CreepRole, type Role } from "../../types";
import { LOCAL_ENERGY_RANGE } from "../support/localEnergy";
import { chooseDefenseDeliveryTarget } from "./defenseDelivery";
import {
  collectResourceLoot,
  collectStorageStagingMineral,
  deliverResourceLoot,
} from "./loot";

const MIN_DELIVERY_ENERGY_RATIO = 0.1;
const STORAGE_ENERGY_RESERVE = 50_000;
// Once storage is healthy, keep a small energy buffer in the terminal so the
// mineral logistics manager can pay for outbound transfers.
const TERMINAL_ENERGY_TARGET = 20_000;
// During an attack, keep towers topped up to this reserve rather than merely
// above empty, and treat any tower below it as an emergency delivery target.
const TOWER_WARTIME_RESERVE = 700;
// A delivery threshold of 1 matches only fully empty (0-energy) towers.
const EMPTY_TOWER_THRESHOLD = 1;
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
const DECAYING_REFILL_PROBE_INTERVAL = 10;
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

interface CarrierReservationState {
  tick: number;
  refillCapacityByTargetId: Record<string, number>;
  deliveryEnergyByTargetId: Record<string, number>;
}

let reservationState: CarrierReservationState | null = null;

function addReservation(
  reservations: Record<string, number>,
  targetId: string | undefined,
  amount: number,
): void {
  if (!targetId || amount <= 0) {
    return;
  }

  reservations[targetId] = (reservations[targetId] ?? 0) + amount;
}

function getCarrierReservationState(): CarrierReservationState {
  if (reservationState?.tick === Game.time) {
    return reservationState;
  }

  const refillCapacityByTargetId: Record<string, number> = {};
  const deliveryEnergyByTargetId: Record<string, number> = {};

  for (const otherCreep of Object.values(Game.creeps)) {
    addReservation(
      refillCapacityByTargetId,
      otherCreep.memory.energyTargetId,
      otherCreep.store.getFreeCapacity(RESOURCE_ENERGY),
    );
    addReservation(
      deliveryEnergyByTargetId,
      otherCreep.memory.deliveryTargetId,
      otherCreep.store[RESOURCE_ENERGY],
    );
  }

  reservationState = {
    tick: Game.time,
    refillCapacityByTargetId,
    deliveryEnergyByTargetId,
  };

  return reservationState;
}

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

function isTowerBelowWartimeReserve(target: StructureTower): boolean {
  return target.store[RESOURCE_ENERGY] < TOWER_WARTIME_RESERVE;
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
    (target.structureType === STRUCTURE_TOWER &&
      isTowerBelowWartimeReserve(target))
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
  const reserved =
    getCarrierReservationState().refillCapacityByTargetId[target.id] ?? 0;

  if (creep.memory.energyTargetId !== target.id) {
    return reserved;
  }

  return Math.max(0, reserved - creep.store.getFreeCapacity(RESOURCE_ENERGY));
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
    !isPositionInHostileWeaponRange(target.pos) &&
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
    hasHostileCombatCreeps(creep.room) &&
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
  if (target && creep.memory.energyTargetId !== target.id) {
    reservationState = null;
    creep.memory.energyTargetId = target.id;
  }

  return target;
}

function isDecayingRefillTarget(
  target: EnergyRefillTarget,
): target is DecayingEnergyTarget {
  return !("structureType" in target);
}

function isFullDecayingRefillTarget(
  creep: Creep,
  target: EnergyRefillTarget,
): boolean {
  return (
    isDecayingRefillTarget(target) && canFullyRefillFromTarget(creep, target)
  );
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

    const isPriorityTarget = isFullDecayingRefillTarget(creep, target);
    const isBestPriorityTarget = isFullDecayingRefillTarget(creep, bestTarget);
    if (isPriorityTarget !== isBestPriorityTarget) {
      return isPriorityTarget ? target : bestTarget;
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

function findPriorityDecayingRefillTarget(
  creep: Creep,
): Resource<RESOURCE_ENERGY> | null {
  const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource): resource is Resource<RESOURCE_ENERGY> =>
      resource.resourceType === RESOURCE_ENERGY &&
      isCarrierRefillTarget(creep, resource as Resource<RESOURCE_ENERGY>) &&
      isFullDecayingRefillTarget(creep, resource as Resource<RESOURCE_ENERGY>),
  });

  return findBestCarrierRefillTarget(creep, droppedEnergy);
}

function findCarrierEnergyRefillTarget(
  creep: Creep,
  deliveryTarget: EnergyDeliveryTarget | null = null,
): EnergyRefillTarget | null {
  const attackStorageTarget = findAttackStorageRefillTarget(
    creep,
    deliveryTarget,
  );
  if (attackStorageTarget) {
    return rememberRefillTarget(creep, attackStorageTarget);
  }

  if (Game.time % DECAYING_REFILL_PROBE_INTERVAL === 0) {
    const priorityTarget = findPriorityDecayingRefillTarget(creep);
    if (priorityTarget) {
      return rememberRefillTarget(creep, priorityTarget);
    }
  }

  if (creep.memory.energyTargetId) {
    const savedTarget = Game.getObjectById(creep.memory.energyTargetId);
    if (savedTarget && isTargetInCreepRoom(creep, savedTarget)) {
      if (isCarrierRefillTarget(creep, savedTarget)) {
        return savedTarget;
      }
    }

    creep.clearEnergyTarget();
  }

  return rememberRefillTarget(creep, findCarrierLocalRefillTarget(creep));
}

function getReservedDeliveryEnergy(
  creep: Creep,
  target: EnergyDeliveryTarget,
): number {
  const reserved =
    getCarrierReservationState().deliveryEnergyByTargetId[target.id] ?? 0;

  if (creep.memory.deliveryTargetId !== target.id) {
    return reserved;
  }

  return Math.max(0, reserved - creep.store[RESOURCE_ENERGY]);
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

function isWorkerDeliveryTarget(target: EnergyDeliveryTarget): target is Creep {
  return target instanceof Creep && WORKER_REFUEL_ROLES.has(target.memory.role);
}

function canContinueWorkerDelivery(creep: Creep, target: Creep): boolean {
  return (
    target.my &&
    isTargetInCreepRoom(creep, target) &&
    canRefuelWorkerRole(creep.room, target.memory.role) &&
    !isPositionInHostileWeaponRange(target.pos)
  );
}

function canContinueSavedDelivery(
  creep: Creep,
  target: EnergyDeliveryTarget,
): boolean {
  if (isWorkerDeliveryTarget(target)) {
    return canContinueWorkerDelivery(creep, target);
  }

  if (isStorageTarget(target)) {
    return isStorageDeliveryTargetAvailable(creep, target);
  }

  return isDeliveryTargetAvailable(creep, target);
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
    canContinueSavedDelivery(creep, savedTarget)
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
  belowEnergy = TOWER_CAPACITY,
  allowPartialLoad = false,
): StructureTower | null {
  return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureTower =>
      structure.structureType === STRUCTURE_TOWER &&
      structure.store[RESOURCE_ENERGY] < belowEnergy &&
      (allowPartialLoad
        ? isDeliveryTargetAvailable(creep, structure)
        : canTowerAcceptFullCarrierLoad(creep, structure)),
  });
}

function findStorageDeliveryTarget(creep: Creep): StructureStorage | null {
  const storage = creep.room.storage;
  if (!storage || !isStorageDeliveryTargetAvailable(creep, storage)) {
    return null;
  }

  return storage;
}

// Top up the terminal with a small energy buffer for outbound transfers, but
// only once storage is healthy so the local economy is never robbed for it.
function findTerminalEnergyDeliveryTarget(
  creep: Creep,
): StructureTerminal | null {
  const { storage, terminal } = creep.room;
  if (
    !terminal ||
    !storage ||
    storage.store[RESOURCE_ENERGY] < STORAGE_ENERGY_RESERVE ||
    terminal.store[RESOURCE_ENERGY] >= TERMINAL_ENERGY_TARGET ||
    !isDeliveryTargetAvailable(creep, terminal)
  ) {
    return null;
  }

  return terminal;
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

  return role === CREEP_ROLE.UPGRADER && !getControllerDeliveryContainer(room);
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
      !isPositionInHostileWeaponRange(target.pos) &&
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
  const committedBreach = creep.room
    .find(FIND_HOSTILE_CREEPS)
    .some(isHostileThreateningCore);
  const savedTarget = findSavedDeliveryTarget(creep);
  const committedEmergencyTower = committedBreach
    ? findTowerDeliveryTarget(creep, TOWER_WARTIME_RESERVE, true)
    : null;
  const refuelTarget = findRefuelDeliveryTarget(creep);
  const defenseTarget = chooseDefenseDeliveryTarget(
    committedBreach,
    committedEmergencyTower,
    savedTarget,
  );
  if (
    defenseTarget &&
    (!isWorkerDeliveryTarget(defenseTarget) || !refuelTarget)
  ) {
    return rememberDeliveryTarget(creep, defenseTarget);
  }

  if (refuelTarget) {
    return rememberDeliveryTarget(creep, refuelTarget);
  }

  // During an attack, treat any tower below the wartime reserve as an emergency
  // delivery target ahead of storage. Otherwise only fully empty towers jump
  // the storage queue.
  const emergencyTowerThreshold = hasHostileCombatCreeps(creep.room)
    ? TOWER_WARTIME_RESERVE
    : EMPTY_TOWER_THRESHOLD;
  const emergencyTower = findTowerDeliveryTarget(
    creep,
    emergencyTowerThreshold,
  );
  if (emergencyTower) {
    return rememberDeliveryTarget(creep, emergencyTower);
  }

  const storage = findStorageDeliveryTarget(creep);
  if (storage) {
    return rememberDeliveryTarget(creep, storage);
  }

  const terminalEnergy = findTerminalEnergyDeliveryTarget(creep);
  if (terminalEnergy) {
    return rememberDeliveryTarget(creep, terminalEnergy);
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
  if (amount === 0 && isWorkerDeliveryTarget(deliveryTarget)) {
    if (!creep.pos.isNearTo(deliveryTarget)) {
      creep.moveToAvoidingRoomEdges(deliveryTarget, CARRIER_DELIVERY_MOVE_OPTS);
    }
    return true;
  }

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

function collectAdjacentDecayingEnergy(creep: Creep): void {
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) return;

  const tombstone = creep.pos.findInRange(FIND_TOMBSTONES, 1, {
    filter: (t) => t.store[RESOURCE_ENERGY] > 0,
  })[0];
  if (tombstone) {
    creep.withdraw(tombstone, RESOURCE_ENERGY);
    return;
  }

  const ruin = creep.pos.findInRange(FIND_RUINS, 1, {
    filter: (r) => r.store[RESOURCE_ENERGY] > 0,
  })[0];
  if (ruin) {
    creep.withdraw(ruin, RESOURCE_ENERGY);
    return;
  }

  const dropped = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
    filter: (r): r is Resource<RESOURCE_ENERGY> =>
      r.resourceType === RESOURCE_ENERGY && r.amount > 0,
  })[0];
  if (dropped) creep.pickup(dropped);
}

export const carrier: Role = {
  run(creep: Creep): void {
    if (
      creep.store[RESOURCE_ENERGY] === 0 &&
      (collectResourceLoot(creep) || collectStorageStagingMineral(creep))
    ) {
      return;
    }

    if (deliverResourceLoot(creep)) {
      return;
    }

    collectAdjacentDecayingEnergy(creep);

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
