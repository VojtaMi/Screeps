import {
  findBestRepairTarget,
  getRepairPriority,
  type RepairTarget,
} from "../repairPolicy";
import type { Role } from "../types";
import { runWorkRefuelLoop } from "./support/workRefuelLoop";

function clearRepairTarget(creep: Creep): void {
  delete creep.memory.repairTargetId;
}

function getSavedRepairTarget(creep: Creep): RepairTarget | null {
  if (!creep.memory.repairTargetId) {
    return null;
  }

  const target = Game.getObjectById(creep.memory.repairTargetId);
  if (target && getRepairPriority(target) !== null) {
    return target;
  }

  clearRepairTarget(creep);
  return null;
}

function findRepairTarget(creep: Creep): RepairTarget | null {
  const savedTarget = getSavedRepairTarget(creep);
  const bestTarget = findBestRepairTarget(creep.room);

  if (
    savedTarget &&
    (!bestTarget ||
      (getRepairPriority(savedTarget) ?? Number.MAX_SAFE_INTEGER) <=
        (getRepairPriority(bestTarget) ?? Number.MAX_SAFE_INTEGER))
  ) {
    return savedTarget;
  }

  if (bestTarget) {
    creep.memory.repairTargetId = bestTarget.id;
  }

  return bestTarget;
}

function repairBestTarget(creep: Creep): boolean {
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

    runWorkRefuelLoop(creep, repairBestTarget);
  },
};
