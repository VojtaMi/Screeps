import { getHostilePriority } from "../../hostileTargeting";

// Structures that occupy their tile so a creep cannot share it. A rampart over
// any of these is not a valid place for a defender to stand.
const BLOCKING_STRUCTURE_TYPES = new Set<StructureConstant>([
  STRUCTURE_SPAWN,
  STRUCTURE_EXTENSION,
  STRUCTURE_LINK,
  STRUCTURE_STORAGE,
  STRUCTURE_TOWER,
  STRUCTURE_OBSERVER,
  STRUCTURE_POWER_SPAWN,
  STRUCTURE_LAB,
  STRUCTURE_TERMINAL,
  STRUCTURE_NUKER,
  STRUCTURE_FACTORY,
  STRUCTURE_WALL,
]);

interface DefensiveRampartOptions {
  origin: RoomPosition;
  target: RoomPosition;
  self: Creep;
  attackRange: number;
}

/** A rampart a defender can actually stand on (no blocking structure beneath). */
export function isStandableRampart(rampart: StructureRampart): boolean {
  return !rampart.pos
    .lookFor(LOOK_STRUCTURES)
    .some((structure) => BLOCKING_STRUCTURE_TYPES.has(structure.structureType));
}

export function findDefensiveRampart({
  origin,
  target,
  self,
  attackRange,
}: DefensiveRampartOptions): StructureRampart | null {
  const hadGuardRampart = self.memory.guardRampartX !== undefined;
  const cached = getCachedGuardRampart(self);
  if (cached) {
    return cached;
  }

  if (hadGuardRampart) {
    const adjacentRampart = findAdjacentFreeRampart(origin, self);
    if (adjacentRampart) {
      rememberGuardRampart(self, adjacentRampart);
      return adjacentRampart;
    }
  }

  const pathRampart = findDoubleRampartOnPath(
    origin,
    target,
    self,
    attackRange,
  );
  if (pathRampart) {
    rememberGuardRampart(self, pathRampart);
    return pathRampart;
  }

  const fallbackRampart = findGuardRampart(self.room, origin, self);
  if (fallbackRampart) {
    rememberGuardRampart(self, fallbackRampart);
  }
  return fallbackRampart;
}

/**
 * Pick the best rampart for this defender to hold, closest to `anchor`.
 * If `maxAnchorRange` is set, only use ramparts where this defender can affect
 * that anchor. Occupied ramparts are skipped unless none are free, so two
 * defenders spread across breach points instead of stacking on one tile.
 */
function findGuardRampart(
  room: Room,
  anchor: RoomPosition,
  self: Creep,
  maxAnchorRange?: number,
): StructureRampart | null {
  const ramparts = room.find(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureRampart =>
      structure.structureType === STRUCTURE_RAMPART &&
      isStandableRampart(structure) &&
      (maxAnchorRange === undefined ||
        structure.pos.inRangeTo(anchor, maxAnchorRange)),
  });
  if (ramparts.length === 0) {
    return null;
  }

  const free = ramparts.filter((rampart) => {
    return isRampartFreeForCreep(rampart, self);
  });
  return anchor.findClosestByRange(free);
}

function findDoubleRampartOnPath(
  origin: RoomPosition,
  target: RoomPosition,
  self: Creep,
  maxTargetRange?: number,
): StructureRampart | null {
  if (
    origin.roomName !== self.room.name ||
    target.roomName !== self.room.name
  ) {
    return null;
  }

  const path = origin.findPathTo(target, {
    ignoreCreeps: true,
    maxRooms: 1,
  });

  for (let index = path.length - 1; index > 0; index -= 1) {
    const step = path[index];
    const position = new RoomPosition(step.x, step.y, self.room.name);
    if (
      maxTargetRange !== undefined &&
      !position.inRangeTo(target, maxTargetRange)
    ) {
      continue;
    }

    const rampart = findStandableRampart(position, self, true);
    const backingPosition = new RoomPosition(
      path[index - 1].x,
      path[index - 1].y,
      self.room.name,
    );
    const backingRampart = findStandableRampart(backingPosition, self, false);

    if (rampart && backingRampart) {
      return rampart;
    }
  }

  return null;
}

function getCachedGuardRampart(self: Creep): StructureRampart | null {
  if (
    self.memory.guardRampartX === undefined ||
    self.memory.guardRampartY === undefined ||
    self.memory.guardRampartRoomName !== self.room.name
  ) {
    clearGuardRampart(self);
    return null;
  }

  const rampart = findStandableRampart(
    new RoomPosition(
      self.memory.guardRampartX,
      self.memory.guardRampartY,
      self.memory.guardRampartRoomName,
    ),
    self,
    true,
  );

  if (!rampart) {
    clearGuardRampart(self);
    return null;
  }

  return rampart;
}

function rememberGuardRampart(self: Creep, rampart: StructureRampart): void {
  self.memory.guardRampartX = rampart.pos.x;
  self.memory.guardRampartY = rampart.pos.y;
  self.memory.guardRampartRoomName = rampart.pos.roomName;
}

function clearGuardRampart(self: Creep): void {
  delete self.memory.guardRampartX;
  delete self.memory.guardRampartY;
  delete self.memory.guardRampartRoomName;
}

function findAdjacentFreeRampart(
  origin: RoomPosition,
  self: Creep,
): StructureRampart | null {
  const ramparts = self.pos.findInRange(FIND_MY_STRUCTURES, 1, {
    filter: (structure): structure is StructureRampart =>
      structure.structureType === STRUCTURE_RAMPART &&
      isStandableRampart(structure) &&
      isRampartFreeForCreep(structure, self),
  });

  return origin.findClosestByRange(ramparts);
}

function findStandableRampart(
  position: RoomPosition,
  self: Creep,
  requireFree: boolean,
): StructureRampart | null {
  return (
    position
      .lookFor(LOOK_STRUCTURES)
      .find(
        (structure): structure is StructureRampart =>
          structure.structureType === STRUCTURE_RAMPART &&
          structure.my &&
          isStandableRampart(structure) &&
          (!requireFree || isRampartFreeForCreep(structure, self)),
      ) ?? null
  );
}

function isRampartFreeForCreep(
  rampart: StructureRampart,
  self: Creep,
): boolean {
  const occupant = rampart.pos.lookFor(LOOK_CREEPS)[0];
  return !occupant || occupant.name === self.name;
}

/** Choose which hostile to swing at: healers first, then the weakest. */
export function pickAttackTarget(hostiles: Creep[]): Creep | null {
  if (hostiles.length === 0) {
    return null;
  }

  return [...hostiles].sort((a, b) => {
    const priorityDifference = getHostilePriority(a) - getHostilePriority(b);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return a.hits - b.hits;
  })[0];
}
