import { CREEP_ROLE } from "../types";

const PRIMARY_SPAWN_NAME = "Spawn1";
const PRIMARY_SPAWN_ROOM = "E59S28";
const PRIMARY_SPAWN_X = 28;
const PRIMARY_SPAWN_Y = 21;

function getPrimarySpawnRoom(): Room | null {
  return (
    Game.spawns[PRIMARY_SPAWN_NAME]?.room ??
    Game.rooms[PRIMARY_SPAWN_ROOM] ??
    null
  );
}

export function getPrimarySpawnSite(
  room: Room,
): ConstructionSite<STRUCTURE_SPAWN> | null {
  const sites = room.lookForAt(
    LOOK_CONSTRUCTION_SITES,
    PRIMARY_SPAWN_X,
    PRIMARY_SPAWN_Y,
  );

  return (
    sites.find(
      (site): site is ConstructionSite<STRUCTURE_SPAWN> =>
        site.structureType === STRUCTURE_SPAWN,
    ) ?? null
  );
}

export function isPrimarySpawnMissing(room: Room): boolean {
  const spawn = Game.spawns[PRIMARY_SPAWN_NAME];
  return !spawn && room.name === PRIMARY_SPAWN_ROOM;
}

function canRebuildSpawn(creep: Creep): boolean {
  return (
    creep.getActiveBodyparts(WORK) > 0 &&
    creep.getActiveBodyparts(CARRY) > 0 &&
    creep.getActiveBodyparts(MOVE) > 0
  );
}

function createPrimarySpawnSite(room: Room): void {
  if (getPrimarySpawnSite(room)) {
    return;
  }

  const result = room.createConstructionSite(
    PRIMARY_SPAWN_X,
    PRIMARY_SPAWN_Y,
    STRUCTURE_SPAWN,
  );

  if (result === OK) {
    console.log(
      `Spawn recovery placed ${STRUCTURE_SPAWN} in ${room.name} at ${PRIMARY_SPAWN_X},${PRIMARY_SPAWN_Y}`,
    );
  } else if (result !== ERR_FULL) {
    console.log(
      `Spawn recovery failed for ${STRUCTURE_SPAWN} in ${room.name} at ${PRIMARY_SPAWN_X},${PRIMARY_SPAWN_Y}: ${result}`,
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
    const room = getPrimarySpawnRoom();
    if (!room || !isPrimarySpawnMissing(room)) {
      return;
    }

    createPrimarySpawnSite(room);
    convertRebuildersToPioneers(room);
  },
};
