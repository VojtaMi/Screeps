import { getDesiredDefenseSquadSize } from "../defenseSquad";
import { findPriorityHostile } from "../hostileTargeting";
import { CREEP_ROLE, type Role } from "../types";
import { seekBoost } from "./support/boost";
import {
  findDefensiveRampart,
  findSafeGuardRampart,
  findSafeRampartOnPath,
  pickAttackTarget,
} from "./support/defense";
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
    const attackTarget = pickAttackTarget(inRange);
    if (attackTarget) {
      creep.rangedAttack(attackTarget);
    }

    const target =
      pickAttackTarget(hostiles) ?? findPriorityHostile(creep.room, creep.pos);
    const spawn = findSameRoomSpawn(creep);

    const squadSize = getDesiredDefenseSquadSize(hostiles);
    const squadMembers = creep.room.find(FIND_MY_CREEPS, {
      filter: (other) => other.memory.role === CREEP_ROLE.RANGED_DEFENDER,
    });
    if (squadSize > 0 && squadMembers.length < squadSize) {
      const stagingRampart = target
        ? (findSafeRampartOnPath(spawn?.pos ?? creep.pos, target.pos, creep) ??
          findSafeGuardRampart(
            creep.room,
            spawn?.pos ?? creep.pos,
            spawn?.pos ?? creep.pos,
            creep,
          ))
        : null;
      if (stagingRampart && !creep.pos.isEqualTo(stagingRampart.pos)) {
        creep.moveToAvoidingRoomEdges(stagingRampart, {
          visualizePathStyle: PATH_STYLE,
        });
      } else if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
        creep.moveToAvoidingRoomEdges(spawn, {
          visualizePathStyle: PATH_STYLE,
          range: 3,
        });
      } else {
        creep.moveOffRoad();
      }
      return;
    }

    // Hold the defensive rampart and focus fire alongside the towers.
    const rampart = target
      ? findDefensiveRampart({
          origin: spawn?.pos ?? creep.pos,
          target: target.pos,
          self: creep,
          attackRange: RANGED_RANGE,
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

    // No ramparts available: kite at range instead of diving into melee.
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
