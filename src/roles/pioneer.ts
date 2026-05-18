import {
  getPrimarySpawnSite,
  isPrimarySpawnMissing,
} from "../managers/spawnRecoveryManager";
import type { Role } from "../types";

function buildPrimarySpawn(creep: Creep): boolean {
  if (!isPrimarySpawnMissing(creep.room)) {
    return false;
  }

  const spawnSite = getPrimarySpawnSite(creep.room);
  if (!spawnSite) {
    return false;
  }

  if (creep.build(spawnSite) === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(spawnSite, {
      visualizePathStyle: { stroke: "#ffffff" },
    });
  }
  return true;
}

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
      if (buildPrimarySpawn(creep)) {
        return;
      }

      const target = creep.findRefuelStructure();
      if (target) {
        creep.transferEnergyTo(target);
        return;
      }

      if (creep.findAndBuild()) {
        return;
      }

      if (creep.findAndRepair()) {
        return;
      }
      return;
    }

    const energyTarget = creep.findEnergyRefillTarget();
    if (energyTarget && "amount" in energyTarget) {
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
