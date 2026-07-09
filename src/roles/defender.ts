import {
  findPriorityHostile,
  isHostileThreateningCore,
} from "../hostileTargeting";
import type { Role } from "../types";
import { findDefensiveRampart, pickAttackTarget } from "./support/defense";
import { findSameRoomSpawn } from "./support/spawns";

const PATH_STYLE: PolyStyle = { stroke: "#ff0000" };

export const defender: Role = {
  run(creep: Creep): void {
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

    // Self-heal alongside any other action; keeps us alive when towers can't.
    if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL) > 0) {
      creep.heal(creep);
    }

    // Always swing at anything adjacent, whatever our posture is.
    const adjacent = pickAttackTarget(creep.pos.findInRange(hostiles, 1));
    if (adjacent) {
      creep.attack(adjacent);
    }

    const spawn = findSameRoomSpawn(creep);
    // Engage hostiles that have committed into the defended area; ignore
    // edge-drainers and let towers handle them instead of chasing into the open.
    const threat = hostiles.find(isHostileThreateningCore) ?? null;
    const target = threat ?? findPriorityHostile(creep.room, creep.pos);

    const rampart = target
      ? findDefensiveRampart({
          origin: spawn?.pos ?? creep.pos,
          target: target.pos,
          self: creep,
          attackRange: 1,
        })
      : null;
    if (rampart) {
      if (!creep.pos.isEqualTo(rampart.pos)) {
        creep.moveToAvoidingRoomEdges(rampart, {
          visualizePathStyle: PATH_STYLE,
        });
      }
      return;
    }

    // No ramparts to hold. Block a committed threat directly, but still refuse
    // to chase edge-drainers across open ground.
    if (threat) {
      if (!creep.pos.isNearTo(threat)) {
        creep.moveToAvoidingRoomEdges(threat, {
          visualizePathStyle: PATH_STYLE,
        });
      }
      return;
    }

    holdNearSpawn(creep, spawn);
  },
};

function holdNearSpawn(creep: Creep, spawn: StructureSpawn | null): void {
  if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
    creep.moveToAvoidingRoomEdges(spawn, { visualizePathStyle: PATH_STYLE });
    return;
  }
  creep.moveOffRoad();
}
