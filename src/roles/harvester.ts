import { isPositionInHostileWeaponRange } from "../hostileTargeting";
import type { Role } from "../types";
import { findSameRoomSpawn } from "./support/spawns";
import { moveToTargetRoom } from "./support/targetRoom";

export const harvester: Role = {
  run(creep: Creep): void {
    const source = creep.memory.sourceId
      ? Game.getObjectById(creep.memory.sourceId)
      : null;

    if (!source) {
      const { targetRoom } = creep.memory;
      if (targetRoom && creep.room.name !== targetRoom) {
        moveToTargetRoom(creep, targetRoom, { stroke: "#ffaa00" });
        return;
      }
      creep.goToSource();
      return;
    }

    delete creep.memory.targetRoom;

    const container = creep.findAdjacentSourceContainer(source);
    const link =
      source.pos.findInRange(FIND_MY_STRUCTURES, 1, {
        filter: (s): s is StructureLink => s.structureType === STRUCTURE_LINK,
      })[0] ?? null;

    if (creep.hasFullEnergy()) {
      const depositTarget = link ?? container;
      if (
        depositTarget &&
        depositTarget.store.getFreeCapacity(RESOURCE_ENERGY) > 0
      ) {
        creep.transferEnergyTo(depositTarget);
      } else {
        creep.drop(RESOURCE_ENERGY);
      }
      return;
    }

    const target = link ?? container ?? source;
    if (isPositionInHostileWeaponRange(target.pos)) {
      const spawn = findSameRoomSpawn(creep);
      if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
        creep.moveToAvoidingRoomEdges(spawn, {
          visualizePathStyle: { stroke: "#ffaa00" },
        });
        return;
      }

      creep.moveOffRoad();
      return;
    }

    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(target, {
        visualizePathStyle: { stroke: "#ffaa00" },
      });
    }
  },
};
