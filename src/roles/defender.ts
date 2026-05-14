import type { Role } from "../types";

export const defender: Role = {
  run(creep: Creep): void {
    const hostile = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
    if (!hostile) {
      return;
    }

    if (creep.attack(hostile) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(hostile, { visualizePathStyle: { stroke: "#ff0000" } });
    }
  },
};
