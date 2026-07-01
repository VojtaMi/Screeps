import { isPositionInHostileWeaponRange } from "../../hostileTargeting";

type ResourceLootTarget = Resource<ResourceConstant> | Ruin | Tombstone;
type ResourceLootDeliveryTarget = StructureStorage | StructureTerminal;

function getNonEnergyResourceInStore(
  store: StoreDefinition,
): ResourceConstant | null {
  return (
    RESOURCES_ALL.find(
      (resourceType) =>
        resourceType !== RESOURCE_ENERGY &&
        store.getUsedCapacity(resourceType) > 0,
    ) ?? null
  );
}

function isDroppedNonEnergyResource(
  target: Resource<ResourceConstant>,
): boolean {
  return (
    target.resourceType !== RESOURCE_ENERGY &&
    target.amount > 0 &&
    !isPositionInHostileWeaponRange(target.pos)
  );
}

function findResourceLootDeliveryTarget(
  creep: Creep,
): ResourceLootDeliveryTarget | null {
  if (creep.room.storage && creep.room.storage.store.getFreeCapacity() > 0) {
    return creep.room.storage;
  }

  if (creep.room.terminal && creep.room.terminal.store.getFreeCapacity() > 0) {
    return creep.room.terminal;
  }

  return null;
}

function findResourceLootTarget(creep: Creep): ResourceLootTarget | null {
  const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: isDroppedNonEnergyResource,
  });
  const ruins = creep.room.find(FIND_RUINS, {
    filter: (target) =>
      getNonEnergyResourceInStore(target.store) !== null &&
      !isPositionInHostileWeaponRange(target.pos),
  });
  const tombstones = creep.room.find(FIND_TOMBSTONES, {
    filter: (target) =>
      getNonEnergyResourceInStore(target.store) !== null &&
      !isPositionInHostileWeaponRange(target.pos),
  });

  return creep.pos.findClosestByPath([
    ...droppedResources,
    ...ruins,
    ...tombstones,
  ]);
}

export function collectResourceLoot(creep: Creep): boolean {
  if (creep.store.getFreeCapacity() === 0) {
    return false;
  }

  if (!findResourceLootDeliveryTarget(creep)) {
    return false;
  }

  const lootTarget = findResourceLootTarget(creep);
  if (!lootTarget) {
    return false;
  }

  if ("amount" in lootTarget) {
    const result = creep.pickup(lootTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(lootTarget, {
        visualizePathStyle: { stroke: "#ffaa00" },
      });
      return true;
    }

    return result === OK;
  }

  const resourceType = getNonEnergyResourceInStore(lootTarget.store);
  if (!resourceType) {
    return false;
  }

  const result = creep.withdraw(lootTarget, resourceType);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(lootTarget, {
      visualizePathStyle: { stroke: "#ffaa00" },
    });
    return true;
  }

  return result === OK;
}

export function deliverResourceLoot(creep: Creep): boolean {
  const resourceType = getNonEnergyResourceInStore(creep.store);
  if (!resourceType) {
    return false;
  }

  const deliveryTarget = findResourceLootDeliveryTarget(creep);
  if (!deliveryTarget) {
    return false;
  }

  const amount = Math.min(
    creep.store.getUsedCapacity(resourceType),
    deliveryTarget.store.getFreeCapacity(),
  );
  const result = creep.transfer(deliveryTarget, resourceType, amount);

  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(deliveryTarget, {
      visualizePathStyle: { stroke: "#ffffff" },
    });
    return true;
  }

  return result === OK;
}
