import {
  BOOST_LAB_TARGET_ENERGY,
  BOOST_LAB_TARGET_MINERAL,
  getBoostLabPlan,
  getBoostLabs,
  getLabAt,
  getProductionLabPlan,
  type ProductionLabPlan,
  SOURCE_LAB_TARGET_MINERAL,
} from "../empire/labPlans";
import { isSharedMineral } from "../empire/resourcePolicy";
import type { Role } from "../types";

const PATH_STYLE: PolyStyle = { stroke: "#cc66ff" };

// The labTech is shared lab logistics: it fills production source labs and boost
// labs with the right minerals/energy and empties reaction products back into
// storage/terminal so the logistics manager can distribute them. It runs one
// action per tick and always degrades gracefully when labs or stores are
// missing.
export const labTech: Role = {
  run(creep: Creep): void {
    if (deliverCarry(creep)) {
      return;
    }

    if (pickUpWork(creep)) {
      return;
    }

    creep.moveOffRoad();
  },
};

// True when the room has any lab servicing work, used to gate spawning.
export function roomHasLabWork(room: Room): boolean {
  if (!room.storage && !room.terminal) {
    return false;
  }

  const prodPlan = getProductionLabPlan(room.name);
  if (prodPlan && productionLabWork(room, prodPlan)) {
    return true;
  }

  return boostLabWork(room);
}

// --- Delivering whatever the creep is currently carrying ---------------------

function deliverCarry(creep: Creep): boolean {
  const carried = getCarriedResource(creep);
  if (!carried) {
    return false;
  }

  if (carried === RESOURCE_ENERGY) {
    return deliverEnergyCarry(creep);
  }

  const goSink = findGoSink(creep.room, carried);
  if (goSink) {
    transfer(creep, goSink, carried);
    return true;
  }

  // Products and anything unexpected go back to store for distribution.
  const store = findDepositTarget(creep.room, carried);
  if (store) {
    transfer(creep, store, carried);
    return true;
  }

  return true; // holding something with nowhere to put it; wait rather than idle away
}

function deliverEnergyCarry(creep: Creep): boolean {
  const lab = findBoostLabNeedingEnergy(creep.room);
  if (lab) {
    transfer(creep, lab, RESOURCE_ENERGY);
    return true;
  }

  const storage = creep.room.storage;
  if (storage) {
    transfer(creep, storage, RESOURCE_ENERGY);
    return true;
  }

  return true;
}

// --- Picking up the next servicing task --------------------------------------

function pickUpWork(creep: Creep): boolean {
  // 1. Clear stale/wrong minerals and pull products out first.
  const salvage = findLabToEmpty(creep.room);
  if (salvage) {
    withdraw(creep, salvage.lab, salvage.resource);
    return true;
  }

  // 2. Refill a production source lab that is low on compound.
  const prodPlan = getProductionLabPlan(creep.room.name);
  if (prodPlan) {
    const source = getLabAt(creep.room, prodPlan.sourceLab);
    if (
      source &&
      source.store[prodPlan.compound] < SOURCE_LAB_TARGET_MINERAL &&
      withdrawFromStore(creep, prodPlan.compound)
    ) {
      return true;
    }
  }

  // 3. Refill boost labs with the boost mineral, then energy.
  const boostPlan = getBoostLabPlan(creep.room.name);
  if (boostPlan) {
    const mineralLab = getBoostLabs(creep.room, boostPlan).find(
      (lab) => lab.store[boostPlan.boost] < BOOST_LAB_TARGET_MINERAL,
    );
    if (mineralLab && withdrawFromStore(creep, boostPlan.boost)) {
      return true;
    }

    if (
      findBoostLabNeedingEnergy(creep.room) &&
      withdrawFromStore(creep, RESOURCE_ENERGY)
    ) {
      return true;
    }
  }

  return false;
}

// --- Work detection ----------------------------------------------------------

function productionLabWork(room: Room, plan: ProductionLabPlan): boolean {
  const source = getLabAt(room, plan.sourceLab);
  if (!source) {
    return false;
  }

  // Wrong mineral to clear, or output labs holding products to drain.
  if (source.mineralType && source.mineralType !== plan.compound) {
    return true;
  }
  if (
    source.store[plan.compound] < SOURCE_LAB_TARGET_MINERAL &&
    storeAmount(room, plan.compound) > 0
  ) {
    return true;
  }

  return plan.outputLabs.some((pos) => {
    const lab = getLabAt(room, pos);
    return (
      lab !== null && lab.mineralType !== null && lab.store[lab.mineralType] > 0
    );
  });
}

function boostLabWork(room: Room): boolean {
  const plan = getBoostLabPlan(room.name);
  if (!plan) {
    return false;
  }

  return getBoostLabs(room, plan).some((lab) => {
    if (lab.mineralType && lab.mineralType !== plan.boost) {
      return true; // wrong mineral to clear
    }
    if (
      lab.store[plan.boost] < BOOST_LAB_TARGET_MINERAL &&
      storeAmount(room, plan.boost) > 0
    ) {
      return true;
    }
    return (
      lab.store[RESOURCE_ENERGY] < BOOST_LAB_TARGET_ENERGY &&
      storeAmount(room, RESOURCE_ENERGY) > 0
    );
  });
}

// A lab that should be emptied: an output lab holding product, or any lab
// holding the wrong mineral.
function findLabToEmpty(
  room: Room,
): { lab: StructureLab; resource: ResourceConstant } | null {
  const prodPlan = getProductionLabPlan(room.name);
  if (prodPlan) {
    const source = getLabAt(room, prodPlan.sourceLab);
    if (source?.mineralType && source.mineralType !== prodPlan.compound) {
      return { lab: source, resource: source.mineralType };
    }

    for (const pos of prodPlan.outputLabs) {
      const lab = getLabAt(room, pos);
      if (lab?.mineralType && lab.store[lab.mineralType] > 0) {
        return { lab, resource: lab.mineralType };
      }
    }
  }

  const boostPlan = getBoostLabPlan(room.name);
  if (boostPlan) {
    const wrong = getBoostLabs(room, boostPlan).find(
      (lab) => lab.mineralType && lab.mineralType !== boostPlan.boost,
    );
    if (wrong?.mineralType) {
      return { lab: wrong, resource: wrong.mineralType };
    }
  }

  return null;
}

// A lab that still wants the boost mineral (GO), if the creep is carrying it.
function findGoSink(
  room: Room,
  resource: ResourceConstant,
): StructureLab | null {
  const prodPlan = getProductionLabPlan(room.name);
  if (prodPlan && resource === prodPlan.compound) {
    const source = getLabAt(room, prodPlan.sourceLab);
    if (source && source.store[prodPlan.compound] < LAB_MINERAL_CAPACITY) {
      return source;
    }
  }

  const boostPlan = getBoostLabPlan(room.name);
  if (boostPlan && resource === boostPlan.boost) {
    return (
      getBoostLabs(room, boostPlan).find(
        (lab) => lab.store[boostPlan.boost] < BOOST_LAB_TARGET_MINERAL,
      ) ?? null
    );
  }

  return null;
}

function findBoostLabNeedingEnergy(room: Room): StructureLab | null {
  const plan = getBoostLabPlan(room.name);
  if (!plan) {
    return null;
  }

  return (
    getBoostLabs(room, plan).find(
      (lab) => lab.store[RESOURCE_ENERGY] < BOOST_LAB_TARGET_ENERGY,
    ) ?? null
  );
}

// --- Store helpers -----------------------------------------------------------

function getCarriedResource(creep: Creep): ResourceConstant | null {
  const stored = Object.keys(creep.store) as ResourceConstant[];
  // Prefer minerals over energy so a mixed load empties minerals first.
  return (
    stored.find((resource) => resource !== RESOURCE_ENERGY) ?? stored[0] ?? null
  );
}

function storeAmount(room: Room, resource: ResourceConstant): number {
  return (
    (room.storage?.store[resource] ?? 0) + (room.terminal?.store[resource] ?? 0)
  );
}

function findWithdrawSource(
  room: Room,
  resource: ResourceConstant,
): StructureStorage | StructureTerminal | null {
  if (room.storage && room.storage.store[resource] > 0) {
    return room.storage;
  }
  if (room.terminal && room.terminal.store[resource] > 0) {
    return room.terminal;
  }
  return null;
}

function findDepositTarget(
  room: Room,
  resource: ResourceConstant,
): StructureStorage | StructureTerminal | null {
  // Shared minerals (products like G and O) go to the terminal so logistics can
  // move them; everything else prefers storage.
  if (isSharedMineral(resource) && room.terminal?.store.getFreeCapacity()) {
    return room.terminal;
  }
  if (room.storage?.store.getFreeCapacity()) {
    return room.storage;
  }
  if (room.terminal?.store.getFreeCapacity()) {
    return room.terminal;
  }
  return null;
}

function withdrawFromStore(creep: Creep, resource: ResourceConstant): boolean {
  const source = findWithdrawSource(creep.room, resource);
  if (!source) {
    return false;
  }
  withdraw(creep, source, resource);
  return true;
}

function withdraw(
  creep: Creep,
  target: StructureLab | StructureStorage | StructureTerminal,
  resource: ResourceConstant,
): void {
  const result = creep.withdraw(target, resource);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(target, { visualizePathStyle: PATH_STYLE });
  }
}

function transfer(
  creep: Creep,
  target: StructureLab | StructureStorage | StructureTerminal,
  resource: ResourceConstant,
): void {
  const result = creep.transfer(target, resource);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(target, { visualizePathStyle: PATH_STYLE });
  }
}
