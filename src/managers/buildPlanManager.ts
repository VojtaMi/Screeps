interface BuildPlanItem extends RoomBuildPlanItem {
  priority: number;
}

interface DefaultBuildPlan {
  plan: RoomBuildPlanItem[];
}

const DEFAULT_BUILD_PLANS: Record<string, DefaultBuildPlan> = {
  E59S28: {
    plan: [
      { x: 42, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 30, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 18, structureType: STRUCTURE_EXTENSION },
      { x: 39, y: 23, structureType: STRUCTURE_CONTAINER },
      { x: 29, y: 27, structureType: STRUCTURE_CONTAINER },
      { x: 40, y: 12, structureType: STRUCTURE_CONTAINER },
      { x: 34, y: 24, structureType: STRUCTURE_ROAD },
    ],
  },
};

function getBuildPlanHash(plan: RoomBuildPlanItem[]): string {
  return plan
    .map(item => `${item.priority ?? ""}:${item.structureType}:${item.x}:${item.y}`)
    .join("|");
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

  return structures.some(structure => structure.structureType === plan.structureType);
}

function hasConstructionSiteAt(room: Room, plan: RoomBuildPlanItem): boolean {
  const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, plan.x, plan.y);

  return sites.some(site => site.structureType === plan.structureType);
}

function countStructures(room: Room, structureType: BuildableStructureConstant): number {
  return room.find(FIND_STRUCTURES, {
    filter: structure => structure.structureType === structureType,
  }).length;
}

function countConstructionSites(room: Room, structureType: BuildableStructureConstant): number {
  return room.find(FIND_CONSTRUCTION_SITES, {
    filter: site => site.structureType === structureType,
  }).length;
}

function canBuildAtCurrentControllerLevel(room: Room, plan: RoomBuildPlanItem): boolean {
  const controllerLevel = room.controller?.level ?? 0;
  const allowed = CONTROLLER_STRUCTURES[plan.structureType][controllerLevel] ?? 0;

  return countStructures(room, plan.structureType) + countConstructionSites(room, plan.structureType) < allowed;
}

export const buildPlanManager = {
  manageBuildPlans(): void {
    for (const roomName in Game.rooms) {
      this.manageRoomBuildPlan(Game.rooms[roomName]);
    }
  },

  manageRoomBuildPlan(room: Room): void {
    if (hasConstructionSite(room)) {
      return;
    }

    const nextPlan = this.getNextBuildPlan(room);
    if (!nextPlan) {
      return;
    }

    const result = room.createConstructionSite(nextPlan.x, nextPlan.y, nextPlan.structureType);
    if (result === OK) {
      console.log(
        `Build plan placed ${nextPlan.structureType} in ${room.name} at ${nextPlan.x},${nextPlan.y}`
      );
    } else {
      console.log(
        `Build plan failed for ${nextPlan.structureType} in ${room.name} at ${nextPlan.x},${nextPlan.y}: ${result}`
      );
    }
  },

  getNextBuildPlan(room: Room): RoomBuildPlanItem | null {
    const buildPlan = getBuildPlan(room).sort((a, b) => a.priority - b.priority);

    return (
      buildPlan.find(
        plan =>
          !isBuilt(room, plan) &&
          !hasConstructionSiteAt(room, plan) &&
          canBuildAtCurrentControllerLevel(room, plan)
      ) ?? null
    );
  },
};
