import type { Role } from "../types";

export const pioneer: Role = {
  run(creep: Creep): void {
    if (creep.memory.working && !creep.hasEnergy()) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
    }

    if (creep.memory.working) {
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

    const energyStore = creep.findWithdrawableEnergy();
    if (energyStore) {
      creep.withdrawEnergyFrom(energyStore);
      return;
    }

    creep.goToSource();
  },
};
