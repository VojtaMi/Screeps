import { isHostileThreateningCore } from "../hostileTargeting";
import { getDefenseAssignment } from "../managers/defenseAssignmentManager";
import type { Role } from "../types";
import { seekBoost } from "./support/boost";
import { pickAttackTarget } from "./support/defense";
import { findSameRoomSpawn } from "./support/spawns";

const PATH_STYLE: PolyStyle = { stroke: "#ff0000" };

export const defender: Role = {
  run(creep: Creep): void {
    // Grab a defensive boost first if one is ready; never stall waiting for it.
    if (seekBoost(creep)) {
      return;
    }

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

    // Hold the rampart the room-level plan assigned us. Positioning is decided
    // once per room, never per creep here.
    const assignment = getDefenseAssignment(creep);
    if (assignment) {
      if (!creep.pos.isEqualTo(assignment)) {
        creep.moveToAvoidingRoomEdges(assignment, {
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
