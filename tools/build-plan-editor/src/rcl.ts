import {
  BUILD_SELECTION_CONTROLLER_CONTAINER,
  BuildPlanItem,
} from "./types";

export const MAX_RCL = 8;

// index = RCL level 0..8. Mirrors Screeps' CONTROLLER_STRUCTURES so the editor
// can enforce per-level limits without access to the game globals.
export const RCL_STRUCTURE_LIMITS: Record<string, number[]> = {
  STRUCTURE_SPAWN: [0, 1, 1, 1, 1, 1, 1, 2, 3],
  STRUCTURE_EXTENSION: [0, 0, 5, 10, 20, 30, 40, 50, 60],
  STRUCTURE_CONTAINER: [5, 5, 5, 5, 5, 5, 5, 5, 5],
  STRUCTURE_ROAD: [2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500, 2500],
  STRUCTURE_WALL: [0, 0, 2500, 2500, 2500, 2500, 2500, 2500, 2500],
  STRUCTURE_RAMPART: [0, 0, 2500, 2500, 2500, 2500, 2500, 2500, 2500],
  STRUCTURE_TOWER: [0, 0, 0, 1, 1, 2, 2, 3, 6],
  STRUCTURE_STORAGE: [0, 0, 0, 0, 1, 1, 1, 1, 1],
  STRUCTURE_LINK: [0, 0, 0, 0, 0, 2, 3, 4, 6],
  STRUCTURE_EXTRACTOR: [0, 0, 0, 0, 0, 0, 1, 1, 1],
  STRUCTURE_TERMINAL: [0, 0, 0, 0, 0, 0, 1, 1, 1],
  STRUCTURE_LAB: [0, 0, 0, 0, 0, 0, 3, 6, 10],
  STRUCTURE_FACTORY: [0, 0, 0, 0, 0, 0, 0, 1, 1],
  STRUCTURE_OBSERVER: [0, 0, 0, 0, 0, 0, 0, 0, 1],
  STRUCTURE_POWER_SPAWN: [0, 0, 0, 0, 0, 0, 0, 0, 1],
  STRUCTURE_NUKER: [0, 0, 0, 0, 0, 0, 0, 0, 1],
};

// The controller-container pseudo-type is a real container for limit purposes.
function resolveLimitType(structureType: string): string {
  return structureType === BUILD_SELECTION_CONTROLLER_CONTAINER
    ? "STRUCTURE_CONTAINER"
    : structureType;
}

export function limitFor(structureType: string, rcl: number): number {
  const limits = RCL_STRUCTURE_LIMITS[resolveLimitType(structureType)];
  return limits?.[rcl] ?? 0;
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
