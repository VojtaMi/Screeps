import type { Role } from "../types";
import { runWorkRefuelLoop } from "./support/workRefuelLoop";

type RepairTarget = StructureRoad | StructureContainer | StructureRampart;

function isRepairTarget(structure: Structure): structure is RepairTarget {
  return (
    structure.structureType === STRUCTURE_ROAD ||
    structure.structureType === STRUCTURE_CONTAINER ||
    structure.structureType === STRUCTURE_RAMPART
  );
}

function getDamageRatio(structure: RepairTarget): number {
  return structure.hits / structure.hitsMax;
}

function findMostDamagedRepairTarget(room: Room): RepairTarget | null {
  const repairTargets = room.find(FIND_STRUCTURES, {
    filter: (structure): structure is RepairTarget =>
      isRepairTarget(structure) && structure.hits < structure.hitsMax,
  });

  return repairTargets.reduce<RepairTarget | null>((mostDamaged, target) => {
    if (!mostDamaged || getDamageRatio(target) < getDamageRatio(mostDamaged)) {
      return target;
    }

    return mostDamaged;
  }, null);
}

function clearRepairTarget(creep: Creep): void {
  delete creep.memory.repairTargetId;
}

function getSavedRepairTarget(creep: Creep): RepairTarget | null {
  if (!creep.memory.repairTargetId) {
    return null;
  }

  const target = Game.getObjectById(creep.memory.repairTargetId);
  if (target && target.hits < target.hitsMax) {
    return target;
  }

  clearRepairTarget(creep);
  return null;
}

function findRepairTarget(creep: Creep): RepairTarget | null {
  const savedTarget = getSavedRepairTarget(creep);
  if (savedTarget) {
    return savedTarget;
  }

  const target = findMostDamagedRepairTarget(creep.room);
  if (target) {
    creep.memory.repairTargetId = target.id;
  }

  return target;
}

function repairMostDamagedTarget(creep: Creep): boolean {
  const target = findRepairTarget(creep);
  if (!target) {
    creep.moveOffRoad();
    return false;
  }

  const result = creep.repair(target);
  creep.moveToWorkTarget(target, result, 3, {
    visualizePathStyle: { stroke: "#ffaa00" },
  });
  if (result === OK && !creep.hasEnergy()) {
    clearRepairTarget(creep);
  }

  return true;
}

export const repairer: Role = {
  run(creep: Creep): void {
    if (!creep.hasEnergy()) {
      clearRepairTarget(creep);
    }

    runWorkRefuelLoop(creep, repairMostDamagedTarget);
  },
};
