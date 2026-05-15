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

function repairMostDamagedTarget(creep: Creep): boolean {
  const target = findMostDamagedRepairTarget(creep.room);
  if (!target) {
    return false;
  }

  if (creep.repair(target) === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(target, {
      visualizePathStyle: { stroke: "#ffaa00" },
    });
  }

  return true;
}

export const repairer: Role = {
  run(creep: Creep): void {
    runWorkRefuelLoop(creep, repairMostDamagedTarget);
  },
};
