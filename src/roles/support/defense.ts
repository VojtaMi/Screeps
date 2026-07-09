import { getHostilePriority } from "../../hostileTargeting";

const GUARD_RAMPART_MEMORY_TTL = 75;

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
  const cached = getCachedGuardRampart(self);
  if (cached) {
    return cached;
  }

  const pathRampart = findLastFreeRampartOnPath(origin, target, self);
  if (pathRampart) {
    rememberGuardRampart(self, pathRampart);
    return pathRampart;
  }

  const attackRampart = findGuardRampart(self.room, target, self, attackRange);
  if (attackRampart) {
    rememberGuardRampart(self, attackRampart);
    return attackRampart;
  }

  const fallbackRampart = findGuardRampart(self.room, target, self);
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
  const candidates = free.length > 0 ? free : ramparts;

  return anchor.findClosestByRange(candidates);
}

function findLastFreeRampartOnPath(
  origin: RoomPosition,
  target: RoomPosition,
  self: Creep,
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

  for (let index = path.length - 1; index >= 0; index -= 1) {
    const step = path[index];
    const rampart = new RoomPosition(step.x, step.y, self.room.name)
      .lookFor(LOOK_STRUCTURES)
      .find(
        (structure): structure is StructureRampart =>
          structure.structureType === STRUCTURE_RAMPART &&
          structure.my &&
          isStandableRampart(structure) &&
          isRampartFreeForCreep(structure, self),
      );

    if (rampart) {
      return rampart;
    }
  }

  return null;
}

function getCachedGuardRampart(self: Creep): StructureRampart | null {
  if (
    self.memory.guardRampartUntil === undefined ||
    self.memory.guardRampartUntil < Game.time ||
    self.memory.guardRampartX === undefined ||
    self.memory.guardRampartY === undefined ||
    self.memory.guardRampartRoomName !== self.room.name
  ) {
    clearGuardRampart(self);
    return null;
  }

  const rampart = new RoomPosition(
    self.memory.guardRampartX,
    self.memory.guardRampartY,
    self.memory.guardRampartRoomName,
  )
    .lookFor(LOOK_STRUCTURES)
    .find(
      (structure): structure is StructureRampart =>
        structure.structureType === STRUCTURE_RAMPART &&
        structure.my &&
        isStandableRampart(structure) &&
        isRampartFreeForCreep(structure, self),
    );

  if (!rampart) {
    clearGuardRampart(self);
    return null;
  }

  self.memory.guardRampartUntil = Game.time + GUARD_RAMPART_MEMORY_TTL;
  return rampart;
}

function rememberGuardRampart(self: Creep, rampart: StructureRampart): void {
  self.memory.guardRampartX = rampart.pos.x;
  self.memory.guardRampartY = rampart.pos.y;
  self.memory.guardRampartRoomName = rampart.pos.roomName;
  self.memory.guardRampartUntil = Game.time + GUARD_RAMPART_MEMORY_TTL;
}

function clearGuardRampart(self: Creep): void {
  delete self.memory.guardRampartX;
  delete self.memory.guardRampartY;
  delete self.memory.guardRampartRoomName;
  delete self.memory.guardRampartUntil;
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
