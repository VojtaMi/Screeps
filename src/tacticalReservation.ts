import { hasHostileCombatCreeps } from "./hostileTargeting";
import { getDefenseAssignment } from "./managers/defenseAssignmentManager";

function isHoldingDefenseAssignment(creep: Creep): boolean {
  const assignment = getDefenseAssignment(creep);

  return assignment !== null && creep.pos.isEqualTo(assignment);
}

/**
 * Whether a creep may be pushed off its tile to unblock traffic.
 *
 * A ranged defender standing on the rampart the room defense plan handed it is
 * tactically reserved: the tile *is* the plan. Stepping aside for a civilian
 * both opens the rampart the plan is built around and spends the tick the
 * defender needed to shoot, so while combat hostiles are in the room the
 * reservation outranks traffic flow. Everywhere else — peaceful rooms, a
 * defender still walking to its rampart, an unassigned defender — swaps stay on
 * so blocked creeps can still untangle themselves.
 */
export function canYieldPosition(creep: Creep): boolean {
  return (
    !isHoldingDefenseAssignment(creep) || !hasHostileCombatCreeps(creep.room)
  );
}

/**
 * Make a held defense position agree with its swap behavior: if the defender
 * cannot yield the tile, pathfinding must route other creeps around it too.
 * The reservation is derived from current room state and never persisted.
 */
export function applyTacticalReservations(room: Room, costs: CostMatrix): void {
  if (!room.memory.defensePlan || !hasHostileCombatCreeps(room)) {
    return;
  }

  for (const creep of room.find(FIND_MY_CREEPS)) {
    if (isHoldingDefenseAssignment(creep)) {
      costs.set(creep.pos.x, creep.pos.y, 255);
    }
  }
}
