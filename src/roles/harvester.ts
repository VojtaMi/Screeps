import type { Role } from "../types";

export const harvester: Role = {
  run(creep: Creep): void {
    if (creep.needsEnergy()) {
      creep.goToSource();
    } else {
      const target = creep.findRefuelStructure();
      if (target) {
        creep.transferEnergyTo(target);
      }
    }
  },
};
