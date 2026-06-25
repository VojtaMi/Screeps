import {
  canTowersOverpowerHostile,
  hasHostileCombatCreeps,
  isHostileNearCriticalStructure,
} from "../hostileTargeting";

// Structures whose loss ends the room. If one of these is already taking
// damage we treat the base as at clear risk regardless of tower math.
const CRITICAL_STRUCTURE_TYPES = new Set<StructureConstant>([
  STRUCTURE_SPAWN,
  STRUCTURE_STORAGE,
  STRUCTURE_TOWER,
  STRUCTURE_TERMINAL,
]);

export const safeModeManager = {
  manageSafeMode(): void {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!shouldActivateSafeMode(room)) {
        continue;
      }

      const result = room.controller?.activateSafeMode();
      if (result === OK) {
        console.log(
          `Safe mode activated in ${room.name}: base under serious threat`,
        );
      } else {
        console.log(`Safe mode activation in ${room.name} failed: ${result}`);
      }
    }
  },
};

/**
 * Conservative automated safe-mode trigger. Fires only when a base-kill is
 * plausibly underway, never for pure edge-draining:
 *
 * - We own the controller and a safe mode is available, not active, off cooldown.
 * - Hostile combat creeps are present.
 * - At least one hostile has committed next to a critical structure, OR a
 *   critical structure is already taking damage.
 * - The towers cannot out-heal the attackers, OR a critical structure is
 *   already being chewed down (towers clearly are not holding the line).
 */
function shouldActivateSafeMode(room: Room): boolean {
  const controller = room.controller;
  if (!controller?.my) {
    return false;
  }
  if (controller.safeMode || controller.safeModeCooldown) {
    return false;
  }
  if ((controller.safeModeAvailable ?? 0) === 0) {
    return false;
  }

  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  if (!hasHostileCombatCreeps(room, hostiles)) {
    return false;
  }

  const committed = hostiles.some(isHostileNearCriticalStructure);
  const criticalDamaged = isCriticalStructureDamaged(room);
  if (!committed && !criticalDamaged) {
    return false; // pure edge-drain or skirmish away from the core
  }

  const towersHandleIt = hostiles.every((hostile) =>
    canTowersOverpowerHostile(room, hostile, hostiles),
  );
  if (towersHandleIt && !criticalDamaged) {
    return false; // towers are out-damaging healing and nothing is hurt yet
  }

  return true;
}

function isCriticalStructureDamaged(room: Room): boolean {
  return (
    room.find(FIND_MY_STRUCTURES, {
      filter: (structure) =>
        CRITICAL_STRUCTURE_TYPES.has(structure.structureType) &&
        structure.hits < structure.hitsMax,
    }).length > 0
  );
}
