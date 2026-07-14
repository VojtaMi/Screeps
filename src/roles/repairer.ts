import type { Role } from "../types";
import { standDownIfUnderAttack } from "./support/civilianSafety";
import {
  clearRepairTarget,
  moveToBestRepairTargetForCreep,
  repairBestTarget,
} from "./support/repairWork";
import { runWorkRefuelLoop } from "./support/workRefuelLoop";

function idleRepairer(creep: Creep): void {
  if (!moveToBestRepairTargetForCreep(creep)) {
    creep.moveOffRoad();
  }
}

export const repairer: Role = {
  run(creep: Creep): void {
    if (!creep.hasEnergy()) {
      clearRepairTarget(creep);
    }

    // A repairer is a soft target whose work sits exactly where the fighting is.
    // Towers cover repair under fire, so it drops the job and recycles instead
    // of shuttling in and out of the breach.
    if (standDownIfUnderAttack(creep)) {
      clearRepairTarget(creep);
      return;
    }

    runWorkRefuelLoop(creep, repairBestTarget, idleRepairer);
  },
};
