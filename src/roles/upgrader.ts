import type { Role } from "../types";
import { runWorkRefuelLoop } from "./support/workRefuelLoop";

function upgradeController(creep: Creep): void {
  creep.goUpgradeController();
}

export const upgrader: Role = {
  run(creep: Creep): void {
    runWorkRefuelLoop(creep, upgradeController);
  },
};
