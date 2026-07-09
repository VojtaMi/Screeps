import {
  getRoomReserve,
  isSharedMineral,
  SHARED_MINERALS,
} from "../../empire/resourcePolicy";
import { isPositionInHostileWeaponRange } from "../../hostileTargeting";

type ResourceLootTarget = Resource<ResourceConstant> | Ruin | Tombstone;
type ResourceLootDeliveryTarget = StructureStorage | StructureTerminal;
// Keep some terminal room free for incoming logistics transfers rather than
// packing it to the brim with collected minerals.
const TERMINAL_LOOT_RESERVE = 50_000;
// How much of a shared mineral to stage into the terminal so the logistics
// manager can send it. Kept well below TERMINAL_LOOT_RESERVE.
const STAGING_TERMINAL_CAP = 10_000;
const MIN_STAGING_AMOUNT = 200;

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
  resource: ResourceConstant | null = null,
): ResourceLootDeliveryTarget | null {
  const { storage, terminal } = creep.room;

  // Shared minerals are routed into the terminal (up to a reserve) so the
  // logistics manager can send them to rooms that need them.
  if (
    resource &&
    isSharedMineral(resource) &&
    terminal &&
    terminal.store.getUsedCapacity(resource) < TERMINAL_LOOT_RESERVE &&
    terminal.store.getFreeCapacity() > 0
  ) {
    return terminal;
  }

  if (storage && storage.store.getFreeCapacity() > 0) {
    return storage;
  }

  if (terminal && terminal.store.getFreeCapacity() > 0) {
    return terminal;
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

  const deliveryTarget = findResourceLootDeliveryTarget(creep, resourceType);
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

// Stage surplus shared minerals sitting in storage into the terminal so the
// logistics manager can send them. Terminal sends only draw from the terminal,
// so without this an existing storage stockpile would never be shared. Only the
// surplus above the room's reserve is moved, and only up to a cap that leaves
// terminal room free. deliverResourceLoot then routes the carried mineral into
// the terminal. Requester rooms have no surplus, so this is a no-op for them.
export function collectStorageStagingMineral(creep: Creep): boolean {
  const { storage, terminal } = creep.room;
  if (
    !storage ||
    !terminal ||
    creep.store.getFreeCapacity() === 0 ||
    terminal.store.getFreeCapacity() === 0 ||
    // Don't mix loads: only stage when not already carrying a mineral.
    getNonEnergyResourceInStore(creep.store) !== null
  ) {
    return false;
  }

  for (const resource of SHARED_MINERALS) {
    const inStorage = storage.store[resource];
    if (inStorage === 0) {
      continue;
    }

    const total = inStorage + terminal.store[resource];
    const surplus = total - getRoomReserve(creep.room.name, resource);
    const desiredInTerminal = Math.min(
      Math.max(surplus, 0),
      STAGING_TERMINAL_CAP,
    );
    const needToStage = desiredInTerminal - terminal.store[resource];
    if (needToStage < MIN_STAGING_AMOUNT) {
      continue;
    }

    const amount = Math.min(
      needToStage,
      inStorage,
      creep.store.getFreeCapacity(),
    );
    if (amount < MIN_STAGING_AMOUNT) {
      continue;
    }

    const result = creep.withdraw(storage, resource, amount);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(storage, {
        visualizePathStyle: { stroke: "#ffaa00" },
      });
    }
    return true;
  }

  return false;
}
