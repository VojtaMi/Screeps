export function extendCreep(): void {
  // Properties
  Creep.prototype.needsEnergy = function (): boolean {
    return this.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
  };

  Creep.prototype.hasFullEnergy = function (): boolean {
    return this.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
  };

  Creep.prototype.hasEnergy = function (): boolean {
    return this.store[RESOURCE_ENERGY] > 0;
  };

  Creep.prototype.isAtFlag = function (flagName: string, range = 1): boolean {
    const flag = Game.flags[flagName];
    if (!flag) {
      return false;
    }
    return this.pos.inRangeTo(flag.pos, range);
  };

  // Actions
  Creep.prototype.goToSource = function (): void {
    const source = this.pos.findClosestByPath(FIND_SOURCES);
    if (source) {
      if (this.harvest(source) === ERR_NOT_IN_RANGE) {
        this.moveTo(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  };

  Creep.prototype.transferEnergyTo = function (target: Structure | AnyCreep | null): void {
    if (target) {
      if (this.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  };

  Creep.prototype.goUpgradeController = function (): void {
    const controller = this.room.controller;
    if (!controller) {
      return;
    }

    if (this.upgradeController(controller) === ERR_NOT_IN_RANGE) {
      this.moveTo(controller, { visualizePathStyle: { stroke: "#ffffff" } });
    } else {
      this.upgradeController(controller);
    }
  };

  Creep.prototype.findRepairTarget = function (): StructureRoad | StructureContainer | StructureRampart | null {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure): structure is StructureRoad | StructureContainer | StructureRampart =>
        (structure.structureType === STRUCTURE_ROAD ||
          structure.structureType === STRUCTURE_CONTAINER ||
          structure.structureType === STRUCTURE_RAMPART) &&
        structure.hits < structure.hitsMax,
    });
  };

  Creep.prototype.findAndRepair = function (): boolean {
    const target = this.findRepairTarget();
    if (target) {
      if (this.repair(target) === ERR_NOT_IN_RANGE) {
        this.moveTo(target, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
      return true;
    }
    return false;
  };

  Creep.prototype.findBuildTarget = function (): ConstructionSite | null {
    return this.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
  };

  Creep.prototype.findAndBuild = function (): boolean {
    const target = this.findBuildTarget();
    if (target) {
      if (this.build(target) === ERR_NOT_IN_RANGE) {
        this.moveTo(target, { visualizePathStyle: { stroke: "#ffffff" } });
      }
      return true;
    }
    return false;
  };

  Creep.prototype.goToFlag = function (
    flagName: string,
    range = 0,
    pathStyle: PolyStyle = { stroke: "#ffffff" }
  ): void {
    const flag = Game.flags[flagName];
    if (flag) {
      if (!this.pos.inRangeTo(flag.pos, range)) {
        this.moveTo(flag, { visualizePathStyle: pathStyle });
      }
    } else {
      this.say(`No flag: ${flagName}`);
    }
  };

  Creep.prototype.findRefuelStructure = function (): StructureSpawn | StructureExtension | null {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure): structure is StructureSpawn | StructureExtension =>
        (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });
  };
}
