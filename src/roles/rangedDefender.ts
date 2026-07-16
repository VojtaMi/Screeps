import { findPriorityHostile, pickHostileTarget } from "../hostileTargeting";
import { getDefenseAssignment } from "../managers/defenseAssignmentManager";
import type { Role } from "../types";
import { seekBoost } from "./support/boost";
import { findSameRoomSpawn } from "./support/spawns";

const PATH_STYLE: PolyStyle = { stroke: "#ff8800" };
const RANGED_RANGE = 3;

export const rangedDefender: Role = {
  run(creep: Creep): void {
    // Grab a defensive boost first if one is ready; never stall waiting for it.
    if (seekBoost(creep)) {
      return;
    }

    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

    // Self-heal alongside ranged fire; keeps us alive when towers can't.
    if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL) > 0) {
      creep.heal(creep);
    }

    // Focus one target so defenders and towers can remove a healer instead of
    // spreading damage that the hostile squad immediately restores.
    const inRange = creep.pos.findInRange(hostiles, RANGED_RANGE);
    const attackTarget = pickHostileTarget(inRange);
    if (attackTarget) {
      creep.rangedAttack(attackTarget);
    }

    // Hold the rampart the room-level plan assigned us and focus fire alongside
    // the towers. Positioning is decided once per room, never per creep here.
    const assignment = getDefenseAssignment(creep);
    if (assignment) {
      if (!creep.pos.isEqualTo(assignment)) {
        creep.moveToAvoidingRoomEdges(assignment, {
          visualizePathStyle: PATH_STYLE,
        });
      }
      return;
    }

    // No rampart available: kite at range instead of diving into melee.
    const target =
      pickHostileTarget(hostiles) ?? findPriorityHostile(creep.room, creep.pos);
    const spawn = findSameRoomSpawn(creep);
    if (target) {
      const range = creep.pos.getRangeTo(target);
      if (range < RANGED_RANGE && spawn) {
        creep.moveToAvoidingRoomEdges(spawn, {
          visualizePathStyle: PATH_STYLE,
        });
      } else if (range > RANGED_RANGE) {
        creep.moveToAvoidingRoomEdges(target, {
          visualizePathStyle: PATH_STYLE,
          range: RANGED_RANGE,
        });
      }
      return;
    }

    if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
      creep.moveToAvoidingRoomEdges(spawn, { visualizePathStyle: PATH_STYLE });
      return;
    }
    creep.moveOffRoad();
  },
};
