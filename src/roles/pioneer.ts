import type { Role } from "../types";

export const pioneer: Role = {
  run(creep: Creep): void {
    if (creep.hasEnergy()) {
      const target = creep.findRefuelStructure();
      if (target) {
        creep.transferEnergyTo(target);
      }
      return;
    }

    const droppedEnergy = creep.findDroppedEnergy();
    if (droppedEnergy) {
      creep.pickUpEnergy(droppedEnergy);
      return;
    }

    const container = creep.findEnergyContainer();
    if (container) {
      creep.withdrawEnergyFrom(container);
      return;
    }

    creep.goToSource();
  },
};
