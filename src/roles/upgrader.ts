import type { Role } from "../types";
import { runWorkRefuelLoop } from "./support/workRefuelLoop";

function upgradeController(creep: Creep): void {
  creep.goUpgradeController();
}

function moveToController(creep: Creep): void {
  const controller = creep.room.controller;
  if (!controller) {
    creep.moveOffRoad();
    return;
  }

  if (creep.pos.inRangeTo(controller, 3)) {
    creep.moveOffRoad();
    return;
  }

  creep.moveToAvoidingRoomEdges(controller, {
    visualizePathStyle: { stroke: "#ffffff" },
  });
}

export const upgrader: Role = {
  run(creep: Creep): void {
    runWorkRefuelLoop(creep, upgradeController, moveToController);
  },
};
