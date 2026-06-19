import { getPrimarySpawnBuildPlan } from "../managers/buildPlanManager";
import type { Role } from "../types";

function moveToTargetRoom(creep: Creep, targetRoom: string): boolean {
  if (creep.room.name === targetRoom) {
    return false;
  }

  creep.moveToAvoidingRoomEdges(new RoomPosition(25, 25, targetRoom), {
    visualizePathStyle: { stroke: "#34d399" },
  });
  return true;
}

function getPlannedSpawnSite(
  creep: Creep,
): ConstructionSite<STRUCTURE_SPAWN> | null {
  const plan = getPrimarySpawnBuildPlan(creep.room);
  if (!plan) {
    return null;
  }

  const sites = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES, plan.x, plan.y);
  return (
    sites.find(
      (site): site is ConstructionSite<STRUCTURE_SPAWN> =>
        site.my && site.structureType === STRUCTURE_SPAWN,
    ) ?? null
  );
}

function buildPlannedSpawn(creep: Creep): boolean {
  const spawnSite = getPlannedSpawnSite(creep);
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

export const settler: Role = {
  run(creep: Creep): void {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) {
      creep.moveOffRoad();
      return;
    }

    if (moveToTargetRoom(creep, targetRoom)) {
      return;
    }

    if (creep.memory.working && !creep.hasEnergy()) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }

    if (creep.memory.working) {
      if (buildPlannedSpawn(creep)) {
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

      creep.moveOffRoad();
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
