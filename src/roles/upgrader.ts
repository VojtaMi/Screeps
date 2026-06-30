import { getControllerDeliveryLink } from "../managers/buildPlanManager";
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
    if (!creep.memory.working && creep.needsEnergy()) {
      const link = getControllerDeliveryLink(creep.room);
      if (link && link.store[RESOURCE_ENERGY] > 0) {
        creep.withdrawEnergyFrom(link);
        return;
      }
    }
    runWorkRefuelLoop(creep, upgradeController, moveToController);
  },
};
