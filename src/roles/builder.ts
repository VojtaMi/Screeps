import type { Role } from "../types";
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
    runWorkRefuelLoop(creep, build);
  },
};
