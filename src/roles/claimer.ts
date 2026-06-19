import type { Role } from "../types";

function moveToTargetRoom(creep: Creep, targetRoom: string): boolean {
  if (creep.room.name === targetRoom) {
    return false;
  }

  creep.moveToAvoidingRoomEdges(new RoomPosition(25, 25, targetRoom), {
    visualizePathStyle: { stroke: "#a78bfa" },
  });
  return true;
}

export const claimer: Role = {
  run(creep: Creep): void {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) {
      creep.moveOffRoad();
      return;
    }

    if (moveToTargetRoom(creep, targetRoom)) {
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

    if (creep.claimController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(controller, {
        visualizePathStyle: { stroke: "#a78bfa" },
      });
    }
  },
};
