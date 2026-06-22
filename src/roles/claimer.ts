import type { Role } from "../types";
import { moveToTargetRoom } from "./support/targetRoom";

function getMyUsername(): string {
  return creepOwnerName() ?? "";
}

function creepOwnerName(): string | null {
  return (
    Game.spawns.Spawn1?.owner.username ??
    Object.values(Game.creeps)[0]?.owner.username ??
    null
  );
}

function canClaimRoom(creep: Creep, controller: StructureController): boolean {
  if (creep.room.find(FIND_HOSTILE_CREEPS).length > 0) {
    return false;
  }

  if (creep.room.find(FIND_HOSTILE_STRUCTURES).length > 0) {
    return false;
  }

  if (controller.owner && !controller.my) {
    return false;
  }

  return (
    !controller.reservation ||
    controller.reservation.username === getMyUsername()
  );
}

export const claimer: Role = {
  run(creep: Creep): void {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) {
      creep.moveOffRoad();
      return;
    }

    if (moveToTargetRoom(creep, targetRoom, { stroke: "#a78bfa" })) {
      return;
    }

    const controller = creep.room.controller;
    if (!controller) {
      creep.moveOffRoad();
      return;
    }

    if (controller.my) {
      creep.moveOffRoad();
      return;
    }

    if (!canClaimRoom(creep, controller)) {
      creep.moveOffRoad();
      return;
    }

    if (creep.claimController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(controller, {
        visualizePathStyle: { stroke: "#a78bfa" },
      });
    }
  },
};
