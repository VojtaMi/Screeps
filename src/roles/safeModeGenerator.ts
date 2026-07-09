import {
  getDesiredSafeModes,
  SAFE_MODE_GHODIUM_COST,
} from "../empire/resourcePolicy";
import type { Role } from "../types";

const PATH_STYLE: PolyStyle = { stroke: "#66ff66" };

// Carries plain ghodium to the controller and adds a safe-mode activation. It
// only ever consumes RESOURCE_GHODIUM (never GO) and pulls from local storage or
// terminal, after the logistics manager has moved ghodium into the room.
export const safeModeGenerator: Role = {
  run(creep: Creep): void {
    const controller = creep.room.controller;
    if (!controller?.my) {
      creep.moveOffRoad();
      return;
    }

    // Job done: the room has its desired safe-mode reserve. Free the slot.
    if (
      (controller.safeModeAvailable ?? 0) >=
        getDesiredSafeModes(creep.room.name) &&
      creep.store[RESOURCE_GHODIUM] === 0
    ) {
      creep.suicide();
      return;
    }

    if (creep.store[RESOURCE_GHODIUM] >= SAFE_MODE_GHODIUM_COST) {
      generateSafeMode(creep, controller);
      return;
    }

    loadGhodium(creep);
  },
};

function generateSafeMode(creep: Creep, controller: StructureController): void {
  const result = creep.generateSafeMode(controller);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(controller, {
      visualizePathStyle: PATH_STYLE,
    });
    return;
  }

  if (result === OK) {
    console.log(
      `Safe-mode generator added a safe mode in ${creep.room.name} (now ${
        (controller.safeModeAvailable ?? 0) + 1
      } available)`,
    );
    return;
  }

  console.log(
    `Safe-mode generator in ${creep.room.name} failed generateSafeMode: ${result}`,
  );
}

function loadGhodium(creep: Creep): void {
  const source = findGhodiumSource(creep.room);
  if (!source) {
    // Ghodium not here yet; wait near the controller for logistics to deliver.
    const controller = creep.room.controller;
    if (controller && !creep.pos.inRangeTo(controller, 3)) {
      creep.moveToAvoidingRoomEdges(controller, {
        visualizePathStyle: PATH_STYLE,
      });
    } else {
      creep.moveOffRoad();
    }
    return;
  }

  const needed = SAFE_MODE_GHODIUM_COST - creep.store[RESOURCE_GHODIUM];
  const amount = Math.min(needed, source.store[RESOURCE_GHODIUM]);
  const result = creep.withdraw(source, RESOURCE_GHODIUM, amount);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(source, { visualizePathStyle: PATH_STYLE });
  }
}

function findGhodiumSource(
  room: Room,
): StructureStorage | StructureTerminal | null {
  if (room.storage && room.storage.store[RESOURCE_GHODIUM] > 0) {
    return room.storage;
  }
  if (room.terminal && room.terminal.store[RESOURCE_GHODIUM] > 0) {
    return room.terminal;
  }
  return null;
}
