import { findPriorityHostile } from "../hostileTargeting";
import type { Role } from "../types";

export const defender: Role = {
  run(creep: Creep): void {
    const hostile = findPriorityHostile(creep.room, creep.pos);
    if (!hostile) {
      const spawn = Game.spawns.Spawn1;
      if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
        creep.moveToAvoidingRoomEdges(spawn, {
          visualizePathStyle: { stroke: "#ff0000" },
        });
      }
      return;
    }

    if (creep.attack(hostile) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(hostile, {
        visualizePathStyle: { stroke: "#ff0000" },
      });
    }
  },
};
