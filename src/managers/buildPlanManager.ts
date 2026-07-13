import { DEFAULT_BUILD_PLANS } from "../buildPlans";
import { getConstructionPriority } from "../constructionPriority";

interface BuildPlanItem extends RoomBuildPlanItem {
  priority: number;
}

interface BuildPlanRoomState {
  structureCounts: Partial<Record<BuildableStructureConstant, number>>;
  siteCounts: Partial<Record<BuildableStructureConstant, number>>;
}

const BUILD_PLAN_RECONCILE_INTERVAL = 100;
const MAX_ROOM_CONSTRUCTION_SITES = 10;

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
  if (plan) {
    const plannedLink = room
      .lookForAt(LOOK_STRUCTURES, plan.x, plan.y)
      .find((s): s is StructureLink => s.structureType === STRUCTURE_LINK);
    if (plannedLink) {
      return plannedLink;
    }
  }

  const controller = room.controller;
  if (!controller) {
    return null;
  }

  // Range 4 covers any link a creep can reach while still upgrading: range 3
  // to the controller plus range 1 to withdraw from the link.
  return (
    controller.pos.findInRange(FIND_MY_STRUCTURES, 4, {
      filter: (s): s is StructureLink => s.structureType === STRUCTURE_LINK,
    })[0] ?? null
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

function getRoomReconcileOffset(roomName: string): number {
  let offset = 0;
  for (const character of roomName) {
    offset =
      (offset * 31 + character.charCodeAt(0)) % BUILD_PLAN_RECONCILE_INTERVAL;
  }
  return offset;
}

function shouldReconcileBuildPlan(room: Room): boolean {
  return (
    (Game.time + getRoomReconcileOffset(room.name)) %
      BUILD_PLAN_RECONCILE_INTERVAL ===
    0
  );
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

function getBuildPlanRoomState(room: Room): BuildPlanRoomState {
  const structureCounts: BuildPlanRoomState["structureCounts"] = {};
  const siteCounts: BuildPlanRoomState["siteCounts"] = {};

  for (const structure of room.find(FIND_STRUCTURES)) {
    const structureType = structure.structureType as BuildableStructureConstant;
    structureCounts[structureType] = (structureCounts[structureType] ?? 0) + 1;
  }

  for (const site of room.find(FIND_MY_CONSTRUCTION_SITES)) {
    siteCounts[site.structureType] = (siteCounts[site.structureType] ?? 0) + 1;
  }

  return { structureCounts, siteCounts };
}

function canBuildAtCurrentControllerLevel(
  room: Room,
  plan: RoomBuildPlanItem,
  state?: BuildPlanRoomState,
): boolean {
  const controllerLevel = room.controller?.level ?? 0;
  const allowed =
    CONTROLLER_STRUCTURES[plan.structureType][controllerLevel] ?? 0;

  if (state) {
    return (
      (state.structureCounts[plan.structureType] ?? 0) +
        (state.siteCounts[plan.structureType] ?? 0) <
      allowed
    );
  }

  return (
    room.find(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType === plan.structureType,
    }).length +
      room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: (site) => site.structureType === plan.structureType,
      }).length <
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

function isForeignOwnedStructure(room: Room, structure: Structure): boolean {
  if (!("owner" in structure)) {
    return false;
  }

  const ownedStructure = structure as Structure & { owner: Owner };
  return ownedStructure.owner.username !== room.controller?.owner?.username;
}

function canCoexistWithPlannedStructure(
  structure: Structure,
  plan: RoomBuildPlanItem,
): boolean {
  if (structure.structureType === plan.structureType) {
    return true;
  }

  if (structure.structureType === STRUCTURE_RAMPART) {
    return true;
  }

  if (plan.structureType === STRUCTURE_RAMPART) {
    return structure.structureType !== STRUCTURE_WALL;
  }

  return false;
}

function findBuildPlanBlocker(
  room: Room,
  plan: RoomBuildPlanItem,
): Structure | null {
  if (!room.controller?.my) {
    return null;
  }

  return (
    room
      .lookForAt(LOOK_STRUCTURES, plan.x, plan.y)
      .find(
        (structure) =>
          !isForeignOwnedStructure(room, structure) &&
          !canCoexistWithPlannedStructure(structure, plan),
      ) ?? null
  );
}

function destroyBuildPlanBlocker(room: Room, plan: RoomBuildPlanItem): boolean {
  const blocker = findBuildPlanBlocker(room, plan);
  if (!blocker) {
    return false;
  }

  const result = blocker.destroy();
  if (result === OK) {
    console.log(
      `Build plan destroyed blocking ${blocker.structureType} in ${room.name} at ${plan.x},${plan.y} for planned ${plan.structureType}`,
    );
  } else {
    console.log(
      `Build plan failed to destroy blocking ${blocker.structureType} in ${room.name} at ${plan.x},${plan.y} for planned ${plan.structureType}: ${result}`,
    );
  }

  return true;
}

function placeBuildPlanSite(room: Room, plan: RoomBuildPlanItem): boolean {
  const result = room.createConstructionSite(
    plan.x,
    plan.y,
    plan.structureType,
  );
  if (result === OK) {
    console.log(
      `Build plan placed ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}`,
    );
    return true;
  }

  if (result !== ERR_FULL) {
    console.log(
      `Build plan failed for ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}: ${result}`,
    );
  }
  return false;
}

function prepareBuildPlanSite(room: Room, plan: RoomBuildPlanItem): boolean {
  if (destroyBuildPlanBlocker(room, plan)) {
    return false;
  }

  return placeBuildPlanSite(room, plan);
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
      prepareBuildPlanSite(room, primarySpawnPlan);
    }

    if (!shouldReconcileBuildPlan(room)) {
      return;
    }

    const buildPlan = getBuildPlan(room).sort(
      (a, b) => a.priority - b.priority,
    );
    const currentRcl = room.controller?.level ?? 0;
    const state = getBuildPlanRoomState(room);
    let globalSiteCount = Object.keys(Game.constructionSites).length;
    let roomSiteCount = Object.values(state.siteCounts).reduce(
      (count, typeCount) => count + (typeCount ?? 0),
      0,
    );

    const supersededByDestroy = new Set<string>();
    for (const plan of buildPlan) {
      if (plan.action === "destroy") {
        const rclMet = plan.minRcl === undefined || currentRcl >= plan.minRcl;
        if (rclMet) {
          supersededByDestroy.add(`${plan.x},${plan.y},${plan.structureType}`);
        }
      }
    }

    for (const plan of buildPlan) {
      if (plan.action === "destroy") {
        if (plan.minRcl !== undefined && currentRcl < plan.minRcl) {
          continue;
        }
        executeDestroyPlan(room, plan);
      }
    }

    const candidates = buildPlan.filter(
      (plan) =>
        plan.action !== "destroy" &&
        !(
          plan.purpose === "primarySpawn" &&
          plan.structureType === STRUCTURE_SPAWN
        ) &&
        !supersededByDestroy.has(`${plan.x},${plan.y},${plan.structureType}`) &&
        !isBuilt(room, plan) &&
        !hasConstructionSiteAt(room, plan) &&
        canBuildAtCurrentControllerLevel(room, plan, state),
    );

    while (
      candidates.length > 0 &&
      roomSiteCount < MAX_ROOM_CONSTRUCTION_SITES &&
      globalSiteCount < MAX_CONSTRUCTION_SITES
    ) {
      const establishedExtensionCount =
        (state.structureCounts[STRUCTURE_EXTENSION] ?? 0) +
        (state.siteCounts[STRUCTURE_EXTENSION] ?? 0);
      let bestCandidateIndex = 0;

      for (let index = 1; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const bestCandidate = candidates[bestCandidateIndex];
        const candidatePriority = getConstructionPriority(
          candidate.structureType,
          establishedExtensionCount,
        );
        const bestPriority = getConstructionPriority(
          bestCandidate.structureType,
          establishedExtensionCount,
        );

        if (
          candidatePriority < bestPriority ||
          (candidatePriority === bestPriority &&
            candidate.priority < bestCandidate.priority)
        ) {
          bestCandidateIndex = index;
        }
      }

      const [plan] = candidates.splice(bestCandidateIndex, 1);

      if (!canBuildAtCurrentControllerLevel(room, plan, state)) {
        continue;
      }

      if (prepareBuildPlanSite(room, plan)) {
        state.siteCounts[plan.structureType] =
          (state.siteCounts[plan.structureType] ?? 0) + 1;
        roomSiteCount += 1;
        globalSiteCount += 1;
      }
    }
  },
};
