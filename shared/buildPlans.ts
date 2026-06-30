export type BuildPlanPurpose =
  | "controllerDelivery"
  | "primarySpawn"
  | (string & {});

export type BuildPlanAction = "destroy";

export interface BuildPlanItemData {
  x: number;
  y: number;
  structureType: string;
  priority?: number;
  purpose?: BuildPlanPurpose;
  action?: BuildPlanAction;
  minRcl?: number;
}

export interface RoomBuildPlanData {
  plan: BuildPlanItemData[];
}

export type BuildPlansData = Record<string, RoomBuildPlanData>;

export const BUILD_SELECTION_CONTROLLER_CONTAINER = "controllerDelivery";
export const MAX_RCL = 8;

// index = RCL level 0..8. Mirrors Screeps' CONTROLLER_STRUCTURES so tooling
// can enforce per-level limits without access to the game globals.
export const RCL_STRUCTURE_LIMITS: Record<string, number[]> = {
  // Diverges from the game table (spawn[0] = 0): the editor treats the primary
  // spawn as the RCL-0 room seed so it appears in the level-0 starting state.
  STRUCTURE_SPAWN: [1, 1, 1, 1, 1, 1, 1, 2, 3],
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

export function resolveLimitType(structureType: string): string {
  return structureType === BUILD_SELECTION_CONTROLLER_CONTAINER
    ? "STRUCTURE_CONTAINER"
    : structureType;
}

export function limitForStructureRcl(
  structureType: string,
  rcl: number,
): number {
  const limits = RCL_STRUCTURE_LIMITS[resolveLimitType(structureType)];
  return limits?.[rcl] ?? 0;
}

export function minRclForStructureType(structureType: string): number {
  for (let rcl = 0; rcl <= MAX_RCL; rcl += 1) {
    if (limitForStructureRcl(structureType, rcl) > 0) {
      return rcl;
    }
  }
  return MAX_RCL;
}

export function withDerivedBuildPlanFields(
  plans: BuildPlansData,
): BuildPlansData {
  return Object.fromEntries(
    Object.entries(plans).map(([roomName, roomPlan]) => [
      roomName,
      {
        plan: roomPlan.plan.map((item, index) => {
          if (item.action !== "destroy") {
            return item;
          }

          const replacement = roomPlan.plan
            .slice(index + 1)
            .find((planItem) => !planItem.action && planItem.x === item.x && planItem.y === item.y);

          return {
            ...item,
            minRcl: replacement
              ? minRclForStructureType(replacement.structureType)
              : item.minRcl,
          };
        }),
      },
    ]),
  );
}

function stableValue(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, stableValue(entryValue)]),
  );
}

export function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function serializeItem(item: BuildPlanItemData): string {
  const entries = Object.entries(item).filter(
    ([, value]) => value !== undefined,
  );

  if (
    entries.length === 3 &&
    "x" in item &&
    "y" in item &&
    "structureType" in item
  ) {
    return `      { x: ${item.x}, y: ${item.y}, structureType: ${item.structureType} },`;
  }

  const lines = [
    "      {",
    `        x: ${item.x},`,
    `        y: ${item.y},`,
    `        structureType: ${item.structureType},`,
  ];

  for (const [key, value] of entries) {
    if (key === "x" || key === "y" || key === "structureType") {
      continue;
    }
    lines.push(`        ${key}: ${JSON.stringify(value)},`);
  }

  lines.push("      },");
  return lines.join("\n");
}

export function serializeBuildPlansToTypeScript(plans: BuildPlansData): string {
  const normalizedPlans = withDerivedBuildPlanFields(plans);
  const header =
    "// Generated from src/buildPlans.json. Do not edit manually.\n\n" +
    "export interface DefaultBuildPlan {\n" +
    "  plan: RoomBuildPlanItem[];\n" +
    "}\n\n" +
    "export const DEFAULT_BUILD_PLANS: Record<string, DefaultBuildPlan> = ";

  const rooms = Object.entries(normalizedPlans).map(([roomName, roomPlan]) => {
    const items = roomPlan.plan.map(serializeItem).join("\n");
    return `  ${roomName}: {\n    plan: [\n${items}\n    ],\n  },`;
  });

  return `${header}{\n${rooms.join("\n")}\n};\n`;
}
