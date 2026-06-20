import { DEFAULT_BUILD_PLANS } from "../buildPlans";
import { bodyCost, buildBodyFromMaxPattern, CREEP_BODY } from "../creepBodies";
import { CREEP_ROLE, type SpawnRequest } from "../types";

const EXPANSION_FAILURE_COOLDOWN_TICKS = CREEP_LIFE_TIME * 10;

function getSpawnRequest(
  room: Room,
  energyBudget: number,
): SpawnRequest | null {
  const targetRoom = findTargetRoom(room);
  if (!targetRoom) {
    return null;
  }

  const expansionRoom = Game.rooms[targetRoom];
  const expansionCreeps = Object.values(Game.creeps).filter(
    (creep) => creep.memory.targetRoom === targetRoom,
  );
  const hasClaimer = expansionCreeps.some(
    (creep) => creep.memory.role === CREEP_ROLE.CLAIMER,
  );

  if (!expansionRoom?.controller?.my) {
    if (hasClaimer || energyBudget < bodyCost(CREEP_BODY.CLAIMER)) {
      return null;
    }

    return {
      role: CREEP_ROLE.CLAIMER,
      body: CREEP_BODY.CLAIMER,
      memory: { targetRoom },
    };
  }

  const hasSettler = expansionCreeps.some(
    (creep) => creep.memory.role === CREEP_ROLE.SETTLER,
  );
  if (hasSettler) {
    return null;
  }

  return {
    role: CREEP_ROLE.SETTLER,
    body: buildBodyFromMaxPattern({
      maxBody: CREEP_BODY.PIONEER,
      energyBudget,
    }),
    memory: { targetRoom, working: false },
  };
}

function findTargetRoom(room: Room): string | null {
  if (!room.controller?.my || room.controller.level <= 3) {
    return null;
  }

  return getAdjacentRoomNames(room.name).filter(isCandidate).sort()[0] ?? null;
}

function isCandidate(roomName: string): boolean {
  if (!hasNonEmptyDefaultBuildPlan(roomName) || isTargetCoolingDown(roomName)) {
    return false;
  }

  const room = Game.rooms[roomName];
  return !room || (hasInspectableExpansionState(room) && !hasMySpawn(room));
}

function hasInspectableExpansionState(room: Room): boolean {
  const controller = room.controller;
  if (!controller) {
    return false;
  }

  if (controller.owner && !controller.my) {
    return false;
  }

  if (
    controller.reservation &&
    controller.reservation.username !== getMyUsername()
  ) {
    return false;
  }

  return (
    room.find(FIND_HOSTILE_CREEPS).length === 0 &&
    room.find(FIND_HOSTILE_STRUCTURES).length === 0
  );
}

function hasNonEmptyDefaultBuildPlan(roomName: string): boolean {
  return (DEFAULT_BUILD_PLANS[roomName]?.plan.length ?? 0) > 0;
}

function hasMySpawn(room: Room): boolean {
  return (
    room.find(FIND_MY_STRUCTURES, {
      filter: (structure): structure is StructureSpawn =>
        structure.structureType === STRUCTURE_SPAWN,
    }).length > 0
  );
}

function getMemory(
  roomName: string,
): NonNullable<Memory["expansionTargets"]>[string] {
  Memory.expansionTargets ??= {};
  Memory.expansionTargets[roomName] ??= {};
  return Memory.expansionTargets[roomName];
}

function isTargetCoolingDown(roomName: string): boolean {
  const failedUntilTick = Memory.expansionTargets?.[roomName]?.failedUntilTick;
  return failedUntilTick !== undefined && failedUntilTick > Game.time;
}

function recordSpawn(creepName: string, request: SpawnRequest): void {
  const targetRoom = request.memory?.targetRoom;
  if (
    !targetRoom ||
    (request.role !== CREEP_ROLE.CLAIMER && request.role !== CREEP_ROLE.SETTLER)
  ) {
    return;
  }

  const memory = getMemory(targetRoom);
  memory.lastAttemptTick = Game.time;
  delete memory.failedUntilTick;

  if (request.role === CREEP_ROLE.CLAIMER) {
    memory.claimerName = creepName;
  } else {
    memory.settlerName = creepName;
  }
}

function reconcileAttempts(): void {
  if (!Memory.expansionTargets) {
    return;
  }

  for (const roomName in Memory.expansionTargets) {
    reconcileAttempt(roomName, Memory.expansionTargets[roomName]);
  }
}

function reconcileAttempt(
  roomName: string,
  memory: NonNullable<Memory["expansionTargets"]>[string],
): void {
  const room = Game.rooms[roomName];
  if (room && hasMySpawn(room)) {
    delete Memory.expansionTargets?.[roomName];
    return;
  }

  if (isTargetCoolingDown(roomName)) {
    return;
  }

  const controllerMine = room?.controller?.my ?? false;
  const claimerMissing =
    memory.claimerName !== undefined && !Game.creeps[memory.claimerName];
  const settlerMissing =
    memory.settlerName !== undefined && !Game.creeps[memory.settlerName];

  if (claimerMissing && !controllerMine) {
    memory.failedUntilTick = Game.time + EXPANSION_FAILURE_COOLDOWN_TICKS;
    delete memory.claimerName;
    delete memory.settlerName;
    console.log(
      `Expansion attempt for ${roomName} failed; cooling down until tick ${memory.failedUntilTick}`,
    );
  } else if (claimerMissing && controllerMine) {
    delete memory.claimerName;
  } else if (settlerMissing && controllerMine) {
    delete memory.settlerName;
  }
}

function getMyUsername(): string | null {
  return (
    Game.spawns.Spawn1?.owner.username ??
    Object.values(Game.creeps)[0]?.owner.username ??
    null
  );
}

function getAdjacentRoomNames(roomName: string): string[] {
  const position = parseRoomName(roomName);
  if (!position) {
    return [];
  }

  const roomNames: string[] = [];
  for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      if (xOffset !== 0 || yOffset !== 0) {
        roomNames.push(
          serializeRoomName(position.x + xOffset, position.y + yOffset),
        );
      }
    }
  }

  return roomNames;
}

function parseRoomName(roomName: string): { x: number; y: number } | null {
  const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
  if (!match) {
    return null;
  }

  const [
    ,
    horizontalDirection,
    horizontalDistance,
    verticalDirection,
    verticalDistance,
  ] = match;
  return {
    x:
      horizontalDirection === "E"
        ? Number(horizontalDistance)
        : -Number(horizontalDistance) - 1,
    y:
      verticalDirection === "S"
        ? Number(verticalDistance)
        : -Number(verticalDistance) - 1,
  };
}

function serializeRoomName(x: number, y: number): string {
  const horizontal = x >= 0 ? `E${x}` : `W${-x - 1}`;
  const vertical = y >= 0 ? `S${y}` : `N${-y - 1}`;
  return `${horizontal}${vertical}`;
}

export const expansionManager = {
  getSpawnRequest,
  reconcileAttempts,
  recordSpawn,
};
