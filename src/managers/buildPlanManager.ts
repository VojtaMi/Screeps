import { DEFAULT_BUILD_PLANS } from "../buildPlans";

interface BuildPlanItem extends RoomBuildPlanItem {
  priority: number;
}

function getBuildPlanHash(plan: RoomBuildPlanItem[]): string {
  return plan
    .map(
      (item) =>
        `${item.priority ?? ""}:${item.purpose ?? ""}:${item.structureType}:${item.x}:${item.y}`,
    )
    .join("|");
}

export function getControllerDeliveryBuildPlan(
  room: Room,
): RoomBuildPlanItem | null {
  return (
    room.memory.buildPlan?.find(
      (item) => item.purpose === "controllerDelivery",
    ) ?? null
  );
}

export function getPrimarySpawnBuildPlan(room: Room): RoomBuildPlanItem | null {
  syncDefaultBuildPlan(room);

  return (
    room.memory.buildPlan?.find(
      (item) =>
        item.purpose === "primarySpawn" &&
        item.structureType === STRUCTURE_SPAWN,
    ) ?? null
  );
}

export function isControllerDeliveryContainer(
  structure: Structure,
): structure is StructureContainer {
  if (structure.structureType !== STRUCTURE_CONTAINER) {
    return false;
  }

  const plan = getControllerDeliveryBuildPlan(structure.room);
  return !!plan && structure.pos.x === plan.x && structure.pos.y === plan.y;
}

export function getControllerDeliveryContainer(
  room: Room,
): StructureContainer | null {
  const plan = getControllerDeliveryBuildPlan(room);
  if (plan) {
    const plannedContainer = room
      .lookForAt(LOOK_STRUCTURES, plan.x, plan.y)
      .find(
        (structure): structure is StructureContainer =>
          structure.structureType === STRUCTURE_CONTAINER,
      );

    if (plannedContainer) {
      return plannedContainer;
    }
  }

  const controller = room.controller;
  if (!controller) {
    return null;
  }

  return (
    controller.pos.findInRange(FIND_STRUCTURES, 3, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER,
    })[0] ?? null
  );
}

function getBuildPlan(room: Room): BuildPlanItem[] {
  syncDefaultBuildPlan(room);

  return (room.memory.buildPlan ?? []).map((item, index) => ({
    ...item,
    priority: item.priority ?? index,
  }));
}

function syncDefaultBuildPlan(room: Room): void {
  const defaultBuildPlan = DEFAULT_BUILD_PLANS[room.name];
  if (!defaultBuildPlan) {
    return;
  }

  const buildPlanHash = getBuildPlanHash(defaultBuildPlan.plan);
  if (room.memory.buildPlanHash === buildPlanHash) {
    return;
  }

  room.memory.buildPlan = defaultBuildPlan.plan;
  room.memory.buildPlanHash = buildPlanHash;
}

function hasConstructionSite(room: Room): boolean {
  return room.find(FIND_CONSTRUCTION_SITES).length > 0;
}

function isBuilt(room: Room, plan: RoomBuildPlanItem): boolean {
  const structures = room.lookForAt(LOOK_STRUCTURES, plan.x, plan.y);

  return structures.some(
    (structure) => structure.structureType === plan.structureType,
  );
}

function hasConstructionSiteAt(room: Room, plan: RoomBuildPlanItem): boolean {
  const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, plan.x, plan.y);

  return sites.some((site) => site.structureType === plan.structureType);
}

function countStructures(
  room: Room,
  structureType: BuildableStructureConstant,
): number {
  return room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === structureType,
  }).length;
}

function countConstructionSites(
  room: Room,
  structureType: BuildableStructureConstant,
): number {
  return room.find(FIND_CONSTRUCTION_SITES, {
    filter: (site) => site.structureType === structureType,
  }).length;
}

function canBuildAtCurrentControllerLevel(
  room: Room,
  plan: RoomBuildPlanItem,
): boolean {
  const controllerLevel = room.controller?.level ?? 0;
  const allowed =
    CONTROLLER_STRUCTURES[plan.structureType][controllerLevel] ?? 0;

  return (
    countStructures(room, plan.structureType) +
      countConstructionSites(room, plan.structureType) <
    allowed
  );
}

export const buildPlanManager = {
  manageBuildPlans(): void {
    for (const roomName in Game.rooms) {
      this.manageRoomBuildPlan(Game.rooms[roomName]);
    }
  },

  manageRoomBuildPlan(room: Room): void {
    syncDefaultBuildPlan(room);

    if (hasConstructionSite(room)) {
      return;
    }

    const nextPlan = this.getNextBuildPlan(room);
    if (!nextPlan) {
      return;
    }

    const result = room.createConstructionSite(
      nextPlan.x,
      nextPlan.y,
      nextPlan.structureType,
    );
    if (result === OK) {
      console.log(
        `Build plan placed ${nextPlan.structureType} in ${room.name} at ${nextPlan.x},${nextPlan.y}`,
      );
    } else {
      console.log(
        `Build plan failed for ${nextPlan.structureType} in ${room.name} at ${nextPlan.x},${nextPlan.y}: ${result}`,
      );
    }
  },

  getNextBuildPlan(room: Room): RoomBuildPlanItem | null {
    const buildPlan = getBuildPlan(room).sort(
      (a, b) => a.priority - b.priority,
    );

    for (const plan of buildPlan) {
      if (isBuilt(room, plan) || hasConstructionSiteAt(room, plan)) {
        continue;
      }

      if (!canBuildAtCurrentControllerLevel(room, plan)) {
        return null;
      }

      return plan;
    }

    return null;
  },
};
