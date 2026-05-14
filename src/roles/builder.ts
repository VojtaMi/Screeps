import type { Role } from "../types";

interface BuilderRole extends Role {
  work(creep: Creep): void;
}

function collectEnergy(creep: Creep): boolean {
  const energyTarget = creep.findEnergyRefillTarget();
  if (energyTarget && "amount" in energyTarget) {
    creep.pickUpEnergy(energyTarget);
    return true;
  }

  if (energyTarget) {
    creep.withdrawEnergyFrom(energyTarget);
    return true;
  }

  return false;
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

    if (collectEnergy(creep)) {
      return;
    }

    creep.goToSource();
  },

  work(creep: Creep): void {
    if (creep.findAndRepair()) {
      return;
    }
    if (creep.findAndBuild()) {
      return;
    }
  },
};
