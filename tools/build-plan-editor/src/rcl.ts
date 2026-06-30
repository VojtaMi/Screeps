import {
  MAX_RCL,
  limitForStructureRcl,
  resolveLimitType,
} from "../../../shared/buildPlans";
import type { BuildPlanItem } from "./types";

export { MAX_RCL };

// Structures bounded only by room tiles, not by an RCL count. They are offered
// without a remaining counter whenever they are buildable at the current level.
export const UNLIMITED_STRUCTURE_TYPES = new Set([
  "STRUCTURE_ROAD",
  "STRUCTURE_WALL",
  "STRUCTURE_RAMPART",
]);

export function isUnlimitedStructure(structureType: string): boolean {
  return UNLIMITED_STRUCTURE_TYPES.has(structureType);
}

export function limitFor(structureType: string, rcl: number): number {
  return limitForStructureRcl(structureType, rcl);
}

// Smallest RCL whose limit can accommodate `count` of this type. Falls back to
// MAX_RCL if the count exceeds even the level-8 cap (over-placed plan).
function minRclForCount(structureType: string, count: number): number {
  for (let rcl = 0; rcl <= MAX_RCL; rcl++) {
    if (limitFor(structureType, rcl) >= count) {
      return rcl;
    }
  }
  return MAX_RCL;
}

// Forward pass over the ordered plan. Element k = the RCL reached after building
// item k (the running max over all types of the level required by their counts
// so far). Non-decreasing because per-type counts only grow.
export function computeStepRcls(plan: BuildPlanItem[]): number[] {
  const counts: Record<string, number> = {};
  let rclSoFar = 0;
  return plan.map((item) => {
    const type = resolveLimitType(item.structureType);
    counts[type] = (counts[type] ?? 0) + 1;
    rclSoFar = Math.max(rclSoFar, minRclForCount(type, counts[type]));
    return rclSoFar;
  });
}

export function planMaxRcl(plan: BuildPlanItem[]): number {
  const stepRcls = computeStepRcls(plan);
  return stepRcls.length > 0 ? stepRcls[stepRcls.length - 1] : 0;
}

// RCL of the most recently built item given the current step (0 when nothing
// is built yet).
export function rclForStep(plan: BuildPlanItem[], currentStep: number): number {
  if (currentStep <= 0) return 0;
  const stepRcls = computeStepRcls(plan);
  return stepRcls[currentStep - 1] ?? 0;
}

// Step value representing "the last state of level `rcl`": the number of leading
// items whose step-RCL is <= rcl (a prefix length, since step-RCLs are sorted).
export function endStepForRcl(plan: BuildPlanItem[], rcl: number): number {
  return computeStepRcls(plan).filter((stepRcl) => stepRcl <= rcl).length;
}

// How many more of `structureType` may be placed at `rcl`, given what is already
// placed in the plan prefix [0, currentStep).
export function remainingForRcl(
  plan: BuildPlanItem[],
  currentStep: number,
  structureType: string,
  rcl: number,
): number {
  const type = resolveLimitType(structureType);
  const placed = plan
    .slice(0, currentStep)
    .filter((item) => resolveLimitType(item.structureType) === type).length;
  return limitFor(structureType, rcl) - placed;
}
