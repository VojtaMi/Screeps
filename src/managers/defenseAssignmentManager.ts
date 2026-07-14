import { findPriorityHostile } from "../hostileTargeting";
import { isStandableRampart } from "../roles/support/defense";
import { CREEP_ROLE } from "../types";

// The target is considered to have moved "materially" once it steps this far
// from where the plan was built, forcing a fresh path and rampart selection.
const MATERIAL_TARGET_MOVE = 3;
// Periodic full rebuild so slower changes (fortification, terrain edits, a
// backing rampart lost while no hostile was adjacent) are re-evaluated.
const PLAN_REFRESH_INTERVAL = 7;
// A held rampart only needs its double-width backing re-checked while a hostile
// is close enough to exploit an exposed flank.
const SAFETY_FRONTIER_RANGE = 4;

/**
 * Room-level defender positioning. Once per room we choose the priority hostile,
 * path from the spawn to it, and hand each defender a distinct rampart to hold.
 * Defenders only consume `room.memory.defensePlan`; they never pathfind or pick
 * a rampart themselves.
 */
export const defenseAssignmentManager = {
  manage(): void {
    for (const roomName in Game.rooms) {
      this.manageRoom(Game.rooms[roomName]);
    }
  },

  manageRoom(room: Room): void {
    if (!room.controller?.my) {
      return;
    }

    const origin = room.find(FIND_MY_SPAWNS)[0]?.pos;
    const hostile = origin ? findPriorityHostile(room, origin) : null;
    const defenders = origin
      ? room.find(FIND_MY_CREEPS, {
          filter: (creep) => creep.memory.role === CREEP_ROLE.RANGED_DEFENDER,
        })
      : [];

    if (!origin || !hostile || defenders.length === 0) {
      delete room.memory.defensePlan;
      return;
    }

    if (
      room.memory.defensePlan &&
      isDefensePlanValid(room, room.memory.defensePlan, hostile, defenders)
    ) {
      return;
    }

    room.memory.defensePlan = buildDefensePlan(
      room,
      origin,
      hostile,
      defenders,
    );
  },
};

/** The rampart position a defender was assigned, or null if it must fight open. */
export function getDefenseAssignment(creep: Creep): RoomPosition | null {
  const assignment = creep.room.memory.defensePlan?.assignments[creep.name];
  if (!assignment) {
    return null;
  }

  return new RoomPosition(assignment.x, assignment.y, creep.room.name);
}

export function buildDefensePlan(
  room: Room,
  origin: RoomPosition,
  hostile: Creep,
  defenders: Creep[],
): RoomDefensePlan {
  const target = new RoomPosition(hostile.pos.x, hostile.pos.y, room.name);
  const pathRamparts = collectPathRamparts(room, origin, target);
  const used = new Set<string>();
  const assignments: Record<string, DefenseAssignment> = {};

  // Deterministic order so the same roster always produces the same layout and
  // no two defenders can race for one tile.
  for (const defender of [...defenders].sort((left, right) =>
    left.name.localeCompare(right.name),
  )) {
    const spot = assignDefender(
      room,
      origin,
      target,
      pathRamparts,
      used,
      defender,
    );
    if (spot) {
      assignments[defender.name] = { x: spot.x, y: spot.y };
      used.add(tileKey(spot.x, spot.y));
    }
  }

  return {
    targetId: hostile.id,
    targetX: hostile.pos.x,
    targetY: hostile.pos.y,
    updatedAt: Game.time,
    roster: defenders.map((defender) => defender.name).sort(),
    assignments,
  };
}

export function isDefensePlanValid(
  room: Room,
  plan: RoomDefensePlan,
  hostile: Creep,
  defenders: Creep[],
): boolean {
  if (plan.targetId !== hostile.id) {
    return false;
  }
  if (
    Math.max(
      Math.abs(plan.targetX - hostile.pos.x),
      Math.abs(plan.targetY - hostile.pos.y),
    ) > MATERIAL_TARGET_MOVE
  ) {
    return false;
  }
  if (Game.time - plan.updatedAt >= PLAN_REFRESH_INTERVAL) {
    return false;
  }

  const roster = defenders.map((defender) => defender.name).sort();
  if (!sameNames(roster, plan.roster)) {
    return false;
  }

  const target = new RoomPosition(hostile.pos.x, hostile.pos.y, room.name);
  for (const name in plan.assignments) {
    const assignment = plan.assignments[name];
    const position = new RoomPosition(assignment.x, assignment.y, room.name);

    if (!standableOwnedRampartAt(position)) {
      return false;
    }
    if (position.lookFor(LOOK_CREEPS).some((creep) => creep.name !== name)) {
      return false;
    }
    if (
      hostile.pos.inRangeTo(position, SAFETY_FRONTIER_RANGE) &&
      !isRampartBacked(room, position, target)
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Standable ramparts sitting on the spawn→hostile path, ordered enemy-most
 * first, keeping only those that pass the double-width rule: the immediately
 * previous path tile toward spawn must also be a standable rampart.
 */
function collectPathRamparts(
  room: Room,
  origin: RoomPosition,
  target: RoomPosition,
): RoomPosition[] {
  const path = origin.findPathTo(target, { ignoreCreeps: true, maxRooms: 1 });
  const ramparts: RoomPosition[] = [];

  for (let index = path.length - 1; index >= 1; index -= 1) {
    const position = new RoomPosition(path[index].x, path[index].y, room.name);
    if (!standableOwnedRampartAt(position)) {
      continue;
    }

    const backing = new RoomPosition(
      path[index - 1].x,
      path[index - 1].y,
      room.name,
    );
    if (standableOwnedRampartAt(backing)) {
      ramparts.push(position);
    }
  }

  return ramparts;
}

function assignDefender(
  room: Room,
  origin: RoomPosition,
  target: RoomPosition,
  pathRamparts: RoomPosition[],
  used: Set<string>,
  defender: Creep,
): RoomPosition | null {
  for (const rampart of pathRamparts) {
    // Prefer the enemy-most valid path rampart when it is still free.
    if (isAvailable(rampart, used, defender)) {
      return rampart;
    }

    // Already taken: slot in beside it on a backed rampart before falling back
    // toward spawn on the path.
    const adjacent = findFreeAdjacentBackedRampart(
      room,
      rampart,
      target,
      used,
      defender,
    );
    if (adjacent) {
      return adjacent;
    }
  }

  return findFreeCoreRampart(room, origin, used, defender);
}

function findFreeAdjacentBackedRampart(
  room: Room,
  center: RoomPosition,
  target: RoomPosition,
  used: Set<string>,
  defender: Creep,
): RoomPosition | null {
  const candidates = ownedStandableRamparts(room)
    .filter(
      (rampart) =>
        center.getRangeTo(rampart) === 1 &&
        isAvailable(rampart.pos, used, defender) &&
        isRampartBacked(room, rampart.pos, target),
    )
    .map((rampart) => rampart.pos);

  return closestToTarget(candidates, target);
}

/** A free standable rampart closest to the core, ignoring exposure cutoffs so
 * the innermost line stays usable once hostiles have committed inward. */
function findFreeCoreRampart(
  room: Room,
  origin: RoomPosition,
  used: Set<string>,
  defender: Creep,
): RoomPosition | null {
  const candidates = ownedStandableRamparts(room)
    .filter((rampart) => isAvailable(rampart.pos, used, defender))
    .map((rampart) => rampart.pos);

  return (
    [...candidates].sort((left, right) => {
      const byOrigin = origin.getRangeTo(left) - origin.getRangeTo(right);
      if (byOrigin !== 0) {
        return byOrigin;
      }
      return compareTiles(left, right);
    })[0] ?? null
  );
}

/** A rampart is backed when an adjacent standable rampart is no closer to the
 * hostile, giving the defender a fallback tile without stepping toward it. */
function isRampartBacked(
  room: Room,
  position: RoomPosition,
  target: RoomPosition,
): boolean {
  const ownRange = position.getRangeTo(target);
  return ownedStandableRamparts(room).some(
    (rampart) =>
      position.getRangeTo(rampart) === 1 &&
      rampart.pos.getRangeTo(target) >= ownRange,
  );
}

function isAvailable(
  position: RoomPosition,
  used: Set<string>,
  defender: Creep,
): boolean {
  if (used.has(tileKey(position.x, position.y))) {
    return false;
  }
  return position
    .lookFor(LOOK_CREEPS)
    .every((creep) => creep.name === defender.name);
}

function ownedStandableRamparts(room: Room): StructureRampart[] {
  return room.find(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureRampart =>
      structure.structureType === STRUCTURE_RAMPART &&
      isStandableRampart(structure),
  });
}

function standableOwnedRampartAt(
  position: RoomPosition,
): StructureRampart | null {
  return (
    position
      .lookFor(LOOK_STRUCTURES)
      .find(
        (structure): structure is StructureRampart =>
          structure.structureType === STRUCTURE_RAMPART &&
          structure.my &&
          isStandableRampart(structure),
      ) ?? null
  );
}

function closestToTarget(
  positions: RoomPosition[],
  target: RoomPosition,
): RoomPosition | null {
  return (
    [...positions].sort((left, right) => {
      const byTarget = left.getRangeTo(target) - right.getRangeTo(target);
      if (byTarget !== 0) {
        return byTarget;
      }
      return compareTiles(left, right);
    })[0] ?? null
  );
}

function compareTiles(left: RoomPosition, right: RoomPosition): number {
  return left.x - right.x || left.y - right.y;
}

function sameNames(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((name, index) => name === right[index])
  );
}

function tileKey(x: number, y: number): string {
  return `${x}:${y}`;
}
