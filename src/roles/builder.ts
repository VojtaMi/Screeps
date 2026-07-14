import type { Role } from "../types";
import { shelterIfUnderAttack } from "./support/civilianSafety";
import { repairBestTarget, repairFreshDefense } from "./support/repairWork";
import { runWorkRefuelLoop } from "./support/workRefuelLoop";

function build(creep: Creep): void {
  if (repairFreshDefense(creep)) {
    return;
  }
  if (creep.findAndBuild()) {
    return;
  }
  if (repairBestTarget(creep)) {
    return;
  }
  creep.moveOffRoad();
}

export const builder: Role = {
  run(creep: Creep): void {
    // A builder has no weapons and no armor. Once the room is under a real
    // attack it stops working entirely rather than pathing toward a site that
    // happens to sit past a hostile.
    if (shelterIfUnderAttack(creep)) {
      return;
    }

    runWorkRefuelLoop(creep, build);
  },
};
