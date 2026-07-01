import { isPositionInHostileWeaponRange } from "../../hostileTargeting";

export const LOCAL_ENERGY_RANGE = 5;

export function collectLocalEnergy(creep: Creep): boolean {
  const droppedEnergy = creep.pos.findClosestByRange(
    creep.pos.findInRange(FIND_DROPPED_RESOURCES, LOCAL_ENERGY_RANGE, {
      filter: (resource): resource is Resource<RESOURCE_ENERGY> =>
        resource.resourceType === RESOURCE_ENERGY &&
        resource.amount > 0 &&
        !isPositionInHostileWeaponRange(resource.pos),
    }),
  );

  if (droppedEnergy) {
    creep.pickUpEnergy(droppedEnergy);
    return true;
  }

  const container = creep.pos.findClosestByRange(
    creep.pos.findInRange(FIND_STRUCTURES, LOCAL_ENERGY_RANGE, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.store[RESOURCE_ENERGY] > 0 &&
        !isPositionInHostileWeaponRange(structure.pos),
    }),
  );

  if (container) {
    creep.withdrawEnergyFrom(container);
    return true;
  }

  return false;
}
