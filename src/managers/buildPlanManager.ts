interface BuildPlanItem extends RoomBuildPlanItem {
  priority: number;
}

function getBuildPlan(room: Room): BuildPlanItem[] {
  return (room.memory.buildPlan ?? []).map((item, index) => ({
    ...item,
    priority: item.priority ?? index,
  }));
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
      buildPlan.find(plan => !isBuilt(room, plan) && !hasConstructionSiteAt(room, plan)) ?? null
    );
  },
};
