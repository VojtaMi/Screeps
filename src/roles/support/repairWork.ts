import {
  findBestRepairTargetForCreep,
  isRepairTargetContested,
  type RepairTarget,
} from "../../repairPolicy";

export function clearRepairTarget(creep: Creep): void {
  delete creep.memory.repairTargetId;
}

function getSavedRepairTarget(creep: Creep): RepairTarget | null {
  if (!creep.memory.repairTargetId) {
    return null;
  }

  const target = Game.getObjectById(creep.memory.repairTargetId);
  if (
    target &&
    target.hits < target.hitsMax &&
    !isRepairTargetContested(target, creep.room)
  ) {
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

  const bestTarget = findBestRepairTargetForCreep(creep);
  if (bestTarget) {
    creep.memory.repairTargetId = bestTarget.id;
  }

  return bestTarget;
}

export function moveToBestRepairTargetForCreep(creep: Creep): boolean {
  const target = findBestRepairTargetForCreep(creep);
  if (!target) {
    return false;
  }

  creep.memory.repairTargetId = target.id;
  creep.moveToWorkTarget(target, ERR_NOT_IN_RANGE, 3, {
    visualizePathStyle: { stroke: "#ffaa00" },
  });

  return true;
}

export function repairBestTarget(creep: Creep): boolean {
  const target = findRepairTarget(creep);
  if (!target) {
    if (!moveToBestRepairTargetForCreep(creep)) {
      creep.moveOffRoad();
    }
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
