import type { Role } from "../types";

export const upgrader: Role = {
  run(creep: Creep): void {
    if (creep.hasEnergy()) {
      creep.goUpgradeController();
    } else if (creep.needsEnergy()) {
      creep.goToSource();
    }
  },
};
