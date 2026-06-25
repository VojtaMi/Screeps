import { isHostileCombatCreep } from "../hostileTargeting";
import {
  findBestRepairTargetForCreep,
  isRepairTargetContested,
  REPAIR_DANGER_RANGE,
  type RepairTarget,
} from "../repairPolicy";
import type { Role } from "../types";
import { findSameRoomSpawn } from "./support/spawns";
import { runWorkRefuelLoop } from "./support/workRefuelLoop";

function clearRepairTarget(creep: Creep): void {
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

function repairBestTarget(creep: Creep): boolean {
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

function moveToBestRepairTargetForCreep(creep: Creep): boolean {
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

function idleRepairer(creep: Creep): void {
  if (!moveToBestRepairTargetForCreep(creep)) {
    creep.moveOffRoad();
  }
}

function retreatToSpawn(creep: Creep): void {
  const spawn = findSameRoomSpawn(creep);
  if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
    creep.moveToAvoidingRoomEdges(spawn, {
      visualizePathStyle: { stroke: "#ffaa00" },
    });
    return;
  }
  creep.moveOffRoad();
}

export const repairer: Role = {
  run(creep: Creep): void {
    if (!creep.hasEnergy()) {
      clearRepairTarget(creep);
    }

    // A repairer is a soft target. If a combat hostile closes in, abandon the
    // job and fall back toward the spawn instead of dying at the breach; towers
    // handle rampart repair under fire.
    const threatened =
      creep.pos.findInRange(FIND_HOSTILE_CREEPS, REPAIR_DANGER_RANGE, {
        filter: isHostileCombatCreep,
      }).length > 0;
    if (threatened) {
      clearRepairTarget(creep);
      retreatToSpawn(creep);
      return;
    }

    runWorkRefuelLoop(creep, repairBestTarget, idleRepairer);
  },
};
