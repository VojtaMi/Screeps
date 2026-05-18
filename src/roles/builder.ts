import type { Role } from "../types";
import { runWorkRefuelLoop } from "./support/workRefuelLoop";

function build(creep: Creep): void {
  if (creep.findAndBuild()) {
    return;
  }
  if (creep.findAndRepair()) {
    return;
  }
  creep.moveOffRoad();
}

export const builder: Role = {
  run(creep: Creep): void {
    runWorkRefuelLoop(creep, build);
  },
};
