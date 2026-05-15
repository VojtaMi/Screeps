import type { Role } from "../types";

function getHostilePriority(hostile: Creep): number {
  if (hostile.getActiveBodyparts(HEAL) > 0) {
    return 0;
  }

  if (hostile.getActiveBodyparts(ATTACK) > 0 || hostile.getActiveBodyparts(RANGED_ATTACK) > 0) {
    return 1;
  }

  return 2;
}

function findPriorityHostile(creep: Creep): Creep | null {
  const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
  if (hostiles.length === 0) {
    return null;
  }

  return hostiles.sort((a, b) => {
    const priorityDifference = getHostilePriority(a) - getHostilePriority(b);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b);
  })[0];
}

export const defender: Role = {
  run(creep: Creep): void {
    const hostile = findPriorityHostile(creep);
    if (!hostile) {
      return;
    }

    if (creep.attack(hostile) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(hostile, { visualizePathStyle: { stroke: "#ff0000" } });
    }
  },
};
