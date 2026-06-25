import { isHostileCombatCreep } from "../hostileTargeting";
import { REPAIR_DANGER_RANGE } from "../repairPolicy";
import type { Role } from "../types";
import {
  clearRepairTarget,
  moveToBestRepairTargetForCreep,
  repairBestTarget,
} from "./support/repairWork";
import { findSameRoomSpawn } from "./support/spawns";
import { runWorkRefuelLoop } from "./support/workRefuelLoop";

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
