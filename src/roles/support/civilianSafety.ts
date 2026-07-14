import { isRoomUnderUnsafeAttack } from "../../hostileTargeting";
import { findSameRoomSpawn } from "./spawns";

const SHELTER_RANGE = 3;
const PATH_STYLE: PolyStyle = { stroke: "#ffaa00" };

/**
 * Soft workers stand down for the whole attack, not just when a hostile is
 * already breathing on them.
 *
 * A proximity rule looks cheaper but is not: the worker still paths toward its
 * job, so it walks into the kill zone, backs off at the boundary, and walks in
 * again. Standing the room's civilians down wholesale costs some building and
 * repair that would have been safe, and buys the guarantee that no civilian ever
 * routes itself through a hostile's weapon range. Towers cover repairs under
 * fire, and the spawn manager is already refusing to build new civilians on the
 * same signal, so this only parks the ones already alive.
 *
 * Carriers are deliberately excluded: they are what keeps the towers and
 * extensions loaded, and the defense collapses without them.
 */
export function shelterIfUnderAttack(creep: Creep): boolean {
  if (!isRoomUnderUnsafeAttack(creep.room)) {
    return false;
  }

  const spawn = findSameRoomSpawn(creep);
  if (spawn && !creep.pos.inRangeTo(spawn, SHELTER_RANGE)) {
    creep.moveToAvoidingRoomEdges(spawn, { visualizePathStyle: PATH_STYLE });
    return true;
  }

  creep.moveOffRoad();
  return true;
}
