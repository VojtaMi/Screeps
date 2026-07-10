import {
  getHostilePriority,
  isPositionInHostileWeaponRange,
} from "../../hostileTargeting";

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
const CORE_STAGING_MIN_RANGE = 8;

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

  const fallbackRampart =
    findSafeRampartOnPath(origin, target, self) ??
    findSafeGuardRampart(self.room, origin, origin, self);
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
export function findSafeGuardRampart(
  room: Room,
  anchor: RoomPosition,
  origin: RoomPosition,
  self: Creep,
): StructureRampart | null {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  const ramparts = room.find(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureRampart =>
      structure.structureType === STRUCTURE_RAMPART &&
      isStandableRampart(structure) &&
      structure.pos.getRangeTo(origin) >= CORE_STAGING_MIN_RANGE &&
      !isPositionInHostileWeaponRange(structure.pos, hostiles),
  });
  if (ramparts.length === 0) {
    return null;
  }

  const free = ramparts.filter((rampart) => {
    return isRampartFreeForCreep(rampart, self);
  });
  return (
    [...free].sort((left, right) => {
      const originDifference =
        origin.getRangeTo(left) - origin.getRangeTo(right);
      if (originDifference !== 0) {
        return originDifference;
      }

      return anchor.getRangeTo(left) - anchor.getRangeTo(right);
    })[0] ?? null
  );
}

export function findSafeRampartOnPath(
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

  const hostiles = self.room.find(FIND_HOSTILE_CREEPS);
  const path = origin.findPathTo(target, { ignoreCreeps: true, maxRooms: 1 });
  for (let index = path.length - 1; index >= 0; index -= 1) {
    const position = new RoomPosition(
      path[index].x,
      path[index].y,
      self.room.name,
    );
    const rampart = findStandableRampart(position, self, true);
    if (rampart && !isPositionInHostileWeaponRange(rampart.pos, hostiles)) {
      return rampart;
    }
  }

  return null;
}

/**
 * Reserve a safe staging rampart for an incomplete squad. The reservation is
 * stored on the creep rather than in RoomMemory so it naturally disappears
 * when the creep dies and is visible to defenders later in the same tick.
 */
export function findStagingRampart(
  origin: RoomPosition,
  target: RoomPosition,
  self: Creep,
): StructureRampart | null {
  const cached = getCachedStagingRampart(self);
  if (cached) {
    return cached;
  }

  const rampart =
    findSafeRampartOnPath(origin, target, self) ??
    findSafeGuardRampart(self.room, origin, origin, self);
  if (rampart) {
    rememberStagingRampart(self, rampart);
  }
  return rampart;
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

  if (!rampart || !isRampartFreeForCreep(rampart, self)) {
    clearGuardRampart(self);
    return null;
  }

  return rampart;
}

function getCachedStagingRampart(self: Creep): StructureRampart | null {
  if (
    self.memory.stagingRampartX === undefined ||
    self.memory.stagingRampartY === undefined ||
    self.memory.stagingRampartRoomName !== self.room.name
  ) {
    clearStagingRampart(self);
    return null;
  }

  const rampart = findStandableRampart(
    new RoomPosition(
      self.memory.stagingRampartX,
      self.memory.stagingRampartY,
      self.memory.stagingRampartRoomName,
    ),
    self,
    true,
  );
  if (
    !rampart ||
    isPositionInHostileWeaponRange(
      rampart.pos,
      self.room.find(FIND_HOSTILE_CREEPS),
    )
  ) {
    clearStagingRampart(self);
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

function rememberStagingRampart(self: Creep, rampart: StructureRampart): void {
  self.memory.stagingRampartX = rampart.pos.x;
  self.memory.stagingRampartY = rampart.pos.y;
  self.memory.stagingRampartRoomName = rampart.pos.roomName;
}

export function clearStagingRampart(self: Creep): void {
  delete self.memory.stagingRampartX;
  delete self.memory.stagingRampartY;
  delete self.memory.stagingRampartRoomName;
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
  return (
    (!occupant || occupant.name === self.name) &&
    !isRampartReservedByOtherDefender(rampart.pos, self)
  );
}

function isRampartReservedByOtherDefender(
  position: RoomPosition,
  self: Creep,
): boolean {
  return (
    self.room.find(FIND_MY_CREEPS, {
      filter: (other) =>
        other.name !== self.name &&
        other.memory.role === "rangedDefender" &&
        (positionMatchesMemory(
          position,
          other.memory.guardRampartX,
          other.memory.guardRampartY,
          other.memory.guardRampartRoomName,
        ) ||
          positionMatchesMemory(
            position,
            other.memory.stagingRampartX,
            other.memory.stagingRampartY,
            other.memory.stagingRampartRoomName,
          )),
    }).length > 0
  );
}

function positionMatchesMemory(
  position: RoomPosition,
  x: number | undefined,
  y: number | undefined,
  roomName: string | undefined,
): boolean {
  return position.x === x && position.y === y && position.roomName === roomName;
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
