import { findReadyBoostLab, MIN_BOOST_PARTS } from "../../empire/labPlans";

const PATH_STYLE: PolyStyle = { stroke: "#00ffcc" };

// Conservative boost step for combat creeps. Returns true only while the creep
// is actively travelling to a ready boost lab, so the caller should skip its
// normal behavior that tick. In every other case it returns false and lets the
// creep act unboosted, so a defender is never stranded waiting for a boost:
//
// - No boost requested, already boosted, or no TOUGH parts -> proceed.
// - Past the boost deadline -> give up and proceed (logged).
// - No lab ready right now -> proceed unboosted this tick (may still boost later
//   if a lab becomes ready before the deadline).
export function seekBoost(creep: Creep): boolean {
  if (!creep.memory.wantsBoost) {
    return false;
  }

  if (creep.memory.boosted) {
    delete creep.memory.wantsBoost;
    return false;
  }

  const toughParts = creep.getActiveBodyparts(TOUGH);
  if (toughParts === 0) {
    delete creep.memory.wantsBoost;
    return false;
  }

  if (
    creep.memory.boostDeadline !== undefined &&
    Game.time > creep.memory.boostDeadline
  ) {
    console.log(
      `Boost fallback: ${creep.name} gave up waiting for a boost, defending unboosted`,
    );
    delete creep.memory.wantsBoost;
    return false;
  }

  const lab =
    findReadyBoostLab(creep.room, toughParts) ??
    findReadyBoostLab(creep.room, MIN_BOOST_PARTS);
  if (!lab) {
    return false; // not ready; fight unboosted rather than stall
  }

  if (!creep.pos.isNearTo(lab)) {
    creep.moveToAvoidingRoomEdges(lab, { visualizePathStyle: PATH_STYLE });
    return true;
  }

  const result = lab.boostCreep(creep);
  if (result === OK) {
    creep.memory.boosted = true;
    delete creep.memory.wantsBoost;
    console.log(`Boost success: ${creep.name} boosted with ${lab.mineralType}`);
    return false;
  }

  console.log(
    `Boost fallback: ${creep.name} boostCreep failed (${result}), defending unboosted`,
  );
  delete creep.memory.wantsBoost;
  return false;
}
