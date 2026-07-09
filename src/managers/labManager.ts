import { buildBodyFromMaxPattern, CREEP_BODY } from "../creepBodies";
import { getLabAt, PRODUCTION_LAB_PLANS } from "../empire/labPlans";
import { roomHasLabWork } from "../roles/labTech";
import { CREEP_ROLE, type CreepRole, type SpawnRequest } from "../types";

// Runs the reverse reactions for production lab hubs (currently GO -> G + O in
// E59S28). Reaction logic only: filling the source lab and emptying the output
// labs is handled by the labTech role. Everything degrades gracefully when labs
// are missing or hold the wrong minerals.
const REACTION_ERROR_LOG_INTERVAL = 50;

export const labManager = {
  manageLabs(): void {
    for (const plan of PRODUCTION_LAB_PLANS) {
      const room = Game.rooms[plan.roomName];
      if (!room?.controller?.my) {
        continue;
      }

      const source = getLabAt(room, plan.sourceLab);
      const outputA = getLabAt(room, plan.outputLabs[0]);
      const outputB = getLabAt(room, plan.outputLabs[1]);
      if (!source || !outputA || !outputB) {
        continue; // cluster not built yet
      }

      if (source.cooldown > 0) {
        continue;
      }

      // Only react when the source holds the intended compound. A wrong mineral
      // is left for the labTech to clear rather than reacted on.
      if (
        source.mineralType !== plan.compound ||
        source.store[plan.compound] < LAB_REACTION_AMOUNT
      ) {
        continue;
      }

      const result = source.reverseReaction(outputA, outputB);
      if (
        result !== OK &&
        result !== ERR_NOT_ENOUGH_RESOURCES &&
        result !== ERR_FULL &&
        Game.time % REACTION_ERROR_LOG_INTERVAL === 0
      ) {
        console.log(
          `Lab hub ${room.name} reverseReaction ${plan.compound} failed: ${result}`,
        );
      }
    }
  },

  // Keeps one labTech per room that has production or boost lab servicing work.
  getSpawnRequest(
    room: Room,
    creepsByRole: (role: CreepRole) => Creep[],
  ): SpawnRequest | null {
    if (creepsByRole(CREEP_ROLE.LAB_TECH).length > 0) {
      return null;
    }

    if (!roomHasLabWork(room)) {
      return null;
    }

    return {
      role: CREEP_ROLE.LAB_TECH,
      body: buildBodyFromMaxPattern({
        maxBody: CREEP_BODY.LAB_TECH,
        energyBudget: room.energyCapacityAvailable,
      }),
    };
  },
};
