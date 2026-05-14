import type { Role } from "../types";

interface BuilderRole extends Role {
  work(creep: Creep): void;
}

export const builder: BuilderRole = {
  run(creep: Creep): void {
    if (creep.hasEnergy()) {
      this.work(creep);
    } else if (creep.needsEnergy()) {
      creep.goToSource();
    }
  },

  work(creep: Creep): void {
    if (creep.findAndRepair()) {
      return;
    }
    if (creep.findAndBuild()) {
      return;
    }
    creep.memory.role = "upgrader";
  },
};
