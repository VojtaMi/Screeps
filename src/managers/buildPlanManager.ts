import { DEFAULT_BUILD_PLANS } from "../buildPlans";

interface BuildPlanItem extends RoomBuildPlanItem {
  priority: number;
}

function stableBuildPlanValue(value: unknown): unknown {
  if (!value || typeof value !== "object") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(stableBuildPlanValue);
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entryValue]) => [key, stableBuildPlanValue(entryValue)]),
  );
}

function getBuildPlanHash(plan: RoomBuildPlanItem[]): string {
  return JSON.stringify(stableBuildPlanValue(plan));
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

export function getControllerDeliveryLink(room: Room): StructureLink | null {
  const plan = getControllerDeliveryBuildPlan(room);
  if (!plan) {
    return null;
  }

  return (
    room
      .lookForAt(LOOK_STRUCTURES, plan.x, plan.y)
      .find((s): s is StructureLink => s.structureType === STRUCTURE_LINK) ??
    null
  );
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
  return room.find(FIND_MY_CONSTRUCTION_SITES).length > 0;
}

function removeForeignConstructionSites(room: Room): void {
  if (!room.controller?.my) {
    return;
  }

  const foreignSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: (site) => !site.my,
  });
  let removedCount = 0;

  for (const site of foreignSites) {
    const result = site.remove();
    if (result === OK) {
      removedCount += 1;
    } else {
      console.log(
        `Failed to remove foreign ${site.structureType} construction site in ${room.name} at ${site.pos.x},${site.pos.y}: ${result}`,
      );
    }
  }

  if (removedCount > 0) {
    console.log(
      `Removed ${removedCount} foreign construction site(s) in ${room.name}`,
    );
  }
}

function isBuilt(room: Room, plan: RoomBuildPlanItem): boolean {
  const structures = room.lookForAt(LOOK_STRUCTURES, plan.x, plan.y);

  return structures.some(
    (structure) => structure.structureType === plan.structureType,
  );
}

function hasConstructionSiteAt(room: Room, plan: RoomBuildPlanItem): boolean {
  const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, plan.x, plan.y);

  return sites.some(
    (site) => site.my && site.structureType === plan.structureType,
  );
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
  return room.find(FIND_MY_CONSTRUCTION_SITES, {
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

function shouldPlaceBuildPlanSite(
  room: Room,
  plan: RoomBuildPlanItem,
): boolean {
  return (
    !isBuilt(room, plan) &&
    !hasConstructionSiteAt(room, plan) &&
    canBuildAtCurrentControllerLevel(room, plan)
  );
}

function placeBuildPlanSite(room: Room, plan: RoomBuildPlanItem): void {
  const result = room.createConstructionSite(
    plan.x,
    plan.y,
    plan.structureType,
  );
  if (result === OK) {
    console.log(
      `Build plan placed ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}`,
    );
  } else {
    console.log(
      `Build plan failed for ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}: ${result}`,
    );
  }
}

function executeDestroyPlan(room: Room, plan: RoomBuildPlanItem): void {
  const structure = room
    .lookForAt(LOOK_STRUCTURES, plan.x, plan.y)
    .find((s) => s.structureType === plan.structureType);

  if (!structure) return;

  const result = structure.destroy();
  if (result === OK) {
    console.log(
      `Build plan destroyed ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}`,
    );
  } else {
    console.log(
      `Build plan failed to destroy ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}: ${result}`,
    );
  }
}

export const buildPlanManager = {
  manageBuildPlans(): void {
    for (const roomName in Game.rooms) {
      this.manageRoomBuildPlan(Game.rooms[roomName]);
    }
  },

  manageRoomBuildPlan(room: Room): void {
    syncDefaultBuildPlan(room);
    removeForeignConstructionSites(room);

    const primarySpawnPlan = getPrimarySpawnBuildPlan(room);
    if (primarySpawnPlan && shouldPlaceBuildPlanSite(room, primarySpawnPlan)) {
      placeBuildPlanSite(room, primarySpawnPlan);
      return;
    }

    if (hasConstructionSite(room)) {
      return;
    }

    const nextPlan = this.getNextBuildPlan(room);
    if (!nextPlan) {
      return;
    }

    if (nextPlan.action === "destroy") {
      executeDestroyPlan(room, nextPlan);
    } else {
      placeBuildPlanSite(room, nextPlan);
    }
  },

  getNextBuildPlan(room: Room): RoomBuildPlanItem | null {
    const buildPlan = getBuildPlan(room).sort(
      (a, b) => a.priority - b.priority,
    );

    const currentRcl = room.controller?.level ?? 0;

    // Any build plan superseded by an active destroy plan should be skipped —
    // otherwise the bot rebuilds the structure immediately after destroying it.
    const supersededByDestroy = new Set<string>();
    for (const plan of buildPlan) {
      if (plan.action === "destroy") {
        const rclMet = plan.minRcl === undefined || currentRcl >= plan.minRcl;
        if (rclMet) {
          supersededByDestroy.add(`${plan.x},${plan.y},${plan.structureType}`);
        }
      }
    }

    for (let i = 0; i < buildPlan.length; i++) {
      const plan = buildPlan[i];

      if (plan.action === "destroy") {
        if (plan.minRcl !== undefined && currentRcl < plan.minRcl) {
          return null;
        }

        const structureExists = room
          .lookForAt(LOOK_STRUCTURES, plan.x, plan.y)
          .some((s) => s.structureType === plan.structureType);
        if (structureExists) return plan;
        continue;
      }

      if (
        supersededByDestroy.has(`${plan.x},${plan.y},${plan.structureType}`)
      ) {
        continue;
      }

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
