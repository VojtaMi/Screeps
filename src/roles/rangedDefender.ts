import { findPriorityHostile } from "../hostileTargeting";
import type { Role } from "../types";
import { findDefensiveRampart, pickAttackTarget } from "./support/defense";
import { findSameRoomSpawn } from "./support/spawns";

const PATH_STYLE: PolyStyle = { stroke: "#ff8800" };
const RANGED_RANGE = 3;

export const rangedDefender: Role = {
  run(creep: Creep): void {
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

    // Self-heal alongside ranged fire; keeps us alive when towers can't.
    if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL) > 0) {
      creep.heal(creep);
    }

    // Fire every tick: mass attack when several are clustered in range,
    // otherwise focus the highest-priority hostile we can reach.
    const inRange = creep.pos.findInRange(hostiles, RANGED_RANGE);
    if (inRange.length >= 2) {
      creep.rangedMassAttack();
    } else if (inRange.length === 1) {
      creep.rangedAttack(inRange[0]);
    }

    const target =
      pickAttackTarget(hostiles) ?? findPriorityHostile(creep.room, creep.pos);
    const spawn = findSameRoomSpawn(creep);

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
