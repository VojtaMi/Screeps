import {
  getDesiredSafeModes,
  getStoredAmount,
  SAFE_MODE_GHODIUM_COST,
} from "../empire/resourcePolicy";
import { CREEP_ROLE, type CreepRole, type SpawnRequest } from "../types";

// One safe-mode generator can hold and deliver the full 1000 ghodium in a single
// generateSafeMode call.
const GENERATOR_BODY: BodyPartConstant[] = [
  ...Array<BodyPartConstant>(20).fill(CARRY),
  ...Array<BodyPartConstant>(10).fill(MOVE),
];
const GENERATOR_BODY_COST = 1500;

// Spawns a safe-mode generator when a room is below its desired safe-mode
// reserve and already has enough local ghodium to feed one generation. Kept
// conservative so it never competes with core economy or recovery: it only
// triggers with a built storage/terminal and sufficient spawn capacity.
export const safeModeReplenishManager = {
  getSpawnRequest(
    room: Room,
    creepsByRole: (role: CreepRole) => Creep[],
  ): SpawnRequest | null {
    const controller = room.controller;
    if (!controller?.my) {
      return null;
    }

    if ((controller.safeModeAvailable ?? 0) >= getDesiredSafeModes(room.name)) {
      return null;
    }

    if (creepsByRole(CREEP_ROLE.SAFE_MODE_GENERATOR).length > 0) {
      return null;
    }

    if (room.energyCapacityAvailable < GENERATOR_BODY_COST) {
      return null;
    }

    // Safe-mode recovery consumes ghodium that logistics has already moved into
    // local storage/terminal; do not spawn until it is actually here.
    if (getStoredAmount(room, RESOURCE_GHODIUM) < SAFE_MODE_GHODIUM_COST) {
      return null;
    }

    return {
      role: CREEP_ROLE.SAFE_MODE_GENERATOR,
      body: GENERATOR_BODY,
    };
  },
};
