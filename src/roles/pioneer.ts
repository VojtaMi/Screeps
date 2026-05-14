import type { Role } from "../types";

export const pioneer: Role = {
  run(creep: Creep): void {
    if (creep.memory.working && !creep.hasEnergy()) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }

    if (creep.memory.working) {
      const target = creep.findRefuelStructure();
      if (target) {
        creep.transferEnergyTo(target);
      }
      return;
    }

    const energyTarget = creep.findEnergyRefillTarget();
    if (energyTarget instanceof Resource) {
      creep.pickUpEnergy(energyTarget);
      return;
    }

    if (energyTarget) {
      creep.withdrawEnergyFrom(energyTarget);
      return;
    }

    creep.goToSource();
  },
};
