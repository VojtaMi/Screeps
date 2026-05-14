function getTargetPosition(target: Parameters<Creep["moveTo"]>[0]): RoomPosition {
  return target instanceof RoomPosition ? target : target.pos;
}

function shouldAvoidRoomEdges(creep: Creep, target: Parameters<Creep["moveTo"]>[0]): boolean {
  return getTargetPosition(target).roomName === creep.room.name;
}

function withRoomEdgeAvoidance(creep: Creep, target: Parameters<Creep["moveTo"]>[0], opts?: MoveToOpts): MoveToOpts {
  if (!shouldAvoidRoomEdges(creep, target)) {
    return opts ?? {};
  }

  const existingCostCallback = opts?.costCallback;

  return {
    ...opts,
    maxRooms: 1,
    costCallback(roomName, matrix) {
      const costs = existingCostCallback?.(roomName, matrix) ?? matrix;

      if (roomName !== creep.room.name) {
        return costs;
      }

      for (let coord = 0; coord < 50; coord += 1) {
        costs.set(coord, 0, 255);
        costs.set(coord, 49, 255);
        costs.set(0, coord, 255);
        costs.set(49, coord, 255);
      }

      return costs;
    },
  };
}

function hasRefillEnergy(target: EnergyRefillTarget): boolean {
  if (target instanceof Resource) {
    return target.resourceType === RESOURCE_ENERGY && target.amount > 0;
  }

  return target.store[RESOURCE_ENERGY] > 0;
}

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

  Creep.prototype.moveToAvoidingRoomEdges = function (
    target: Parameters<Creep["moveTo"]>[0],
    opts?: Parameters<Creep["moveTo"]>[1]
  ): ReturnType<Creep["moveTo"]> {
    return this.moveTo(target, withRoomEdgeAvoidance(this, target, opts));
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
        this.moveToAvoidingRoomEdges(source, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  };

  Creep.prototype.transferEnergyTo = function (target: Structure | AnyCreep | null): void {
    if (target) {
      if (this.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(target, { visualizePathStyle: { stroke: "#ffffff" } });
      }
    }
  };

  Creep.prototype.withdrawEnergyFrom = function (target: EnergyWithdrawTarget | null): void {
    if (target) {
      if (this.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(target, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  };

  Creep.prototype.pickUpEnergy = function (target: Resource<RESOURCE_ENERGY> | null): void {
    if (target) {
      if (this.pickup(target) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(target, { visualizePathStyle: { stroke: "#ffaa00" } });
      }
    }
  };

  Creep.prototype.clearEnergyTarget = function (): void {
    delete this.memory.energyTargetId;
  };

  Creep.prototype.findEnergyRefillTarget = function (): EnergyRefillTarget | null {
    if (this.memory.energyTargetId) {
      const savedTarget = Game.getObjectById(this.memory.energyTargetId);
      if (savedTarget && hasRefillEnergy(savedTarget)) {
        return savedTarget;
      }

      this.clearEnergyTarget();
    }

    const target = this.findDroppedEnergy() ?? this.findWithdrawableEnergy();
    if (target) {
      this.memory.energyTargetId = target.id;
    }

    return target;
  };

  Creep.prototype.goUpgradeController = function (): void {
    const controller = this.room.controller;
    if (!controller) {
      return;
    }

    if (this.upgradeController(controller) === ERR_NOT_IN_RANGE) {
      this.moveToAvoidingRoomEdges(controller, { visualizePathStyle: { stroke: "#ffffff" } });
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
        this.moveToAvoidingRoomEdges(target, { visualizePathStyle: { stroke: "#ffaa00" } });
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
        this.moveToAvoidingRoomEdges(target, { visualizePathStyle: { stroke: "#ffffff" } });
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
        this.moveToAvoidingRoomEdges(flag, { visualizePathStyle: pathStyle });
      }
    } else {
      this.say(`No flag: ${flagName}`);
    }
  };

  Creep.prototype.findDroppedEnergy = function (): Resource<RESOURCE_ENERGY> | null {
    return this.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: (resource): resource is Resource<RESOURCE_ENERGY> =>
        resource.resourceType === RESOURCE_ENERGY && resource.amount > 0,
    });
  };

  Creep.prototype.findAdjacentSourceContainer = function (source: Source): StructureContainer | null {
    const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
      filter: (structure): structure is StructureContainer => structure.structureType === STRUCTURE_CONTAINER,
    });

    return containers[0] ?? null;
  };

  Creep.prototype.findEnergyContainer = function (): StructureContainer | null {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER && structure.store[RESOURCE_ENERGY] > 0,
    });
  };

  Creep.prototype.findWithdrawableEnergy = function (): EnergyWithdrawTarget | null {
    const container = this.findEnergyContainer();
    const ruin = this.pos.findClosestByPath(FIND_RUINS, {
      filter: target => target.store[RESOURCE_ENERGY] > 0,
    });
    const tombstone = this.pos.findClosestByPath(FIND_TOMBSTONES, {
      filter: target => target.store[RESOURCE_ENERGY] > 0,
    });

    const targets = [container, ruin, tombstone].filter((target): target is EnergyWithdrawTarget => !!target);
    return this.pos.findClosestByPath(targets);
  };

  Creep.prototype.findControllerContainer = function (): StructureContainer | null {
    const controller = this.room.controller;
    if (!controller) {
      return null;
    }

    const containers = controller.pos.findInRange(FIND_STRUCTURES, 3, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });

    return containers[0] ?? null;
  };

  Creep.prototype.findRefuelStructure = function (): StructureSpawn | StructureExtension | null {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure): structure is StructureSpawn | StructureExtension =>
        (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });
  };
}
