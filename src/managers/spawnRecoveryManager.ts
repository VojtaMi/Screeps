import { CREEP_ROLE } from "../types";
import { getPrimarySpawnBuildPlan } from "./buildPlanManager";

export function getPrimarySpawnSite(
  room: Room,
): ConstructionSite<STRUCTURE_SPAWN> | null {
  const plan = getPrimarySpawnBuildPlan(room);
  if (!plan) {
    return null;
  }

  const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, plan.x, plan.y);

  return (
    sites.find(
      (site): site is ConstructionSite<STRUCTURE_SPAWN> =>
        site.my && site.structureType === STRUCTURE_SPAWN,
    ) ?? null
  );
}

export function isPrimarySpawnMissing(room: Room): boolean {
  const plan = getPrimarySpawnBuildPlan(room);
  if (!room.controller?.my || !plan) {
    return false;
  }

  const plannedSpawn = room
    .lookForAt(LOOK_STRUCTURES, plan.x, plan.y)
    .find(
      (structure): structure is StructureSpawn =>
        structure.structureType === STRUCTURE_SPAWN && structure.my,
    );

  return !plannedSpawn;
}

function canRebuildSpawn(creep: Creep): boolean {
  return (
    creep.getActiveBodyparts(WORK) > 0 &&
    creep.getActiveBodyparts(CARRY) > 0 &&
    creep.getActiveBodyparts(MOVE) > 0
  );
}

function createPrimarySpawnSite(room: Room): void {
  const plan = getPrimarySpawnBuildPlan(room);
  if (!plan) {
    return;
  }

  if (getPrimarySpawnSite(room)) {
    return;
  }

  const result = room.createConstructionSite(
    plan.x,
    plan.y,
    plan.structureType,
  );

  if (result === OK) {
    console.log(
      `Spawn recovery placed ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}`,
    );
  } else if (result !== ERR_FULL) {
    console.log(
      `Spawn recovery failed for ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}: ${result}`,
    );
  }
}

function convertRebuildersToPioneers(room: Room): void {
  for (const creep of room.find(FIND_MY_CREEPS)) {
    if (creep.memory.role === CREEP_ROLE.PIONEER || !canRebuildSpawn(creep)) {
      continue;
    }

    creep.memory.role = CREEP_ROLE.PIONEER;
    creep.memory.working = creep.hasEnergy();
    delete creep.memory.sourceId;
    delete creep.memory.energyTargetId;
    delete creep.memory.deliveryTargetId;
    console.log(
      `Spawn recovery reassigned ${creep.name} to ${CREEP_ROLE.PIONEER}`,
    );
  }
}

export const spawnRecoveryManager = {
  manageSpawnRecovery(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!isPrimarySpawnMissing(room)) {
        continue;
      }

      createPrimarySpawnSite(room);
      convertRebuildersToPioneers(room);
    }
  },
};
