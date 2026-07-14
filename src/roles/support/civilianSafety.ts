import { isRoomUnderUnsafeAttack } from "../../hostileTargeting";
import { findSameRoomSpawn } from "./spawns";

const PATH_STYLE: PolyStyle = { stroke: "#ffaa00" };

/**
 * Soft workers stand down for the whole attack and hand their bodies back.
 *
 * Sheltering them in a corner is not free: an idle worker still occupies tiles,
 * and the tiles it drifts to are the ones the carriers need to keep the towers
 * loaded and the defenders need to reach their ramparts. Recycling removes the
 * creep, returns most of its energy, and does both at the spawn the carriers
 * already serve, so a stood-down worker turns into defender parts instead of
 * traffic. The rebuild afterwards is handled on its own by the discretionary
 * builder probe and the desired-repairer count.
 *
 * It also settles the danger question for free: a creep that stops working
 * cannot path toward a construction site that sits past a hostile.
 *
 * Carriers are deliberately excluded: they are what keeps the towers and
 * extensions loaded, and the defense collapses without them.
 */
export function standDownIfUnderAttack(creep: Creep): boolean {
  if (!isRoomUnderUnsafeAttack(creep.room)) {
    return false;
  }

  const spawn = findSameRoomSpawn(creep);
  if (!spawn) {
    // Nothing to recycle into (spawn destroyed, or a room we do not own yet):
    // at least stay off the roads.
    creep.moveOffRoad();
    return true;
  }

  if (!creep.pos.isNearTo(spawn)) {
    creep.moveToAvoidingRoomEdges(spawn, { visualizePathStyle: PATH_STYLE });
    return true;
  }

  // The energy drops next to the spawn rather than landing in it, which suits
  // us: picking dropped energy up beside the spawn is already the carriers' job.
  spawn.recycleCreep(creep);
  return true;
}
