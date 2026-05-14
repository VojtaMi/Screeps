import type { Role } from "../types";
import { collectLocalEnergy } from "./localEnergy";

interface BuilderRole extends Role {
  work(creep: Creep): void;
}

export const builder: BuilderRole = {
  run(creep: Creep): void {
    if (creep.memory.working && !creep.hasEnergy()) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }

    if (creep.memory.working) {
      this.work(creep);
      return;
    }

    if (collectLocalEnergy(creep)) {
      return;
    }

    if (creep.hasEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      this.work(creep);
    }
  },

  work(creep: Creep): void {
    if (creep.findAndBuild()) {
      return;
    }
    if (creep.findAndRepair()) {
      return;
    }
  },
};
