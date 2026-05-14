import type { Role } from "../types";
import { collectLocalEnergy } from "./localEnergy";

export const upgrader: Role = {
  run(creep: Creep): void {
    if (creep.memory.working && !creep.hasEnergy()) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }

    if (creep.memory.working) {
      creep.goUpgradeController();
      return;
    }

    if (collectLocalEnergy(creep)) {
      return;
    }

    if (creep.hasEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      creep.goUpgradeController();
    }
  },
};
