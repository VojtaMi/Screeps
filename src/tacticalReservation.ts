import { hasHostileCombatCreeps } from "./hostileTargeting";
import { getDefenseAssignment } from "./managers/defenseAssignmentManager";

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
  const assignment = getDefenseAssignment(creep);

  return (
    assignment === null ||
    !creep.pos.isEqualTo(assignment) ||
    !hasHostileCombatCreeps(creep.room)
  );
}
