import {
  getRepairPriority,
  isRepairTarget,
  type RepairTarget,
} from "./repairPolicy";

const SWAP_STUCK_THRESHOLD = 2;
const SWAP_REQUEST_TTL = 1;

function toMoveToOpts(
  opts?: MoveToAvoidingRoomEdgesOpts,
): MoveToOpts | undefined {
  if (!opts) {
    return undefined;
  }

  const { requestSwap: _requestSwap, ...moveToOpts } = opts;
  return moveToOpts;
}

function getTargetPosition(
  target: Parameters<Creep["moveTo"]>[0],
): RoomPosition {
  return target instanceof RoomPosition ? target : target.pos;
}

function shouldAvoidRoomEdges(
  creep: Creep,
  target: Parameters<Creep["moveTo"]>[0],
): boolean {
  return getTargetPosition(target).roomName === creep.room.name;
}

function withRoomEdgeAvoidance(
  creep: Creep,
  target: Parameters<Creep["moveTo"]>[0],
  opts?: MoveToAvoidingRoomEdgesOpts,
): MoveToOpts {
  const moveToOpts = toMoveToOpts(opts);

  if (!shouldAvoidRoomEdges(creep, target)) {
    return moveToOpts ?? {};
  }

  const existingCostCallback = opts?.costCallback;

  return {
    ignoreCreeps: true,
    ...moveToOpts,
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

function positionMatches(
  pos: RoomPosition,
  x: number | undefined,
  y: number | undefined,
  roomName: string | undefined,
): boolean {
  return pos.x === x && pos.y === y && pos.roomName === roomName;
}

function updateMoveStuckCount(creep: Creep): number {
  if (creep.memory.moveLastTick === Game.time) {
    return creep.memory.moveStuckCount ?? 0;
  }

  const stayedInPlace =
    creep.memory.moveLastTick === Game.time - 1 &&
    positionMatches(
      creep.pos,
      creep.memory.moveLastX,
      creep.memory.moveLastY,
      creep.memory.moveLastRoomName,
    );

  creep.memory.moveStuckCount = stayedInPlace
    ? (creep.memory.moveStuckCount ?? 0) + 1
    : 0;
  creep.memory.moveLastX = creep.pos.x;
  creep.memory.moveLastY = creep.pos.y;
  creep.memory.moveLastRoomName = creep.pos.roomName;
  creep.memory.moveLastTick = Game.time;

  return creep.memory.moveStuckCount;
}

function findNextStep(
  creep: Creep,
  target: Parameters<Creep["moveTo"]>[0],
  opts?: MoveToAvoidingRoomEdgesOpts,
): RoomPosition | null {
  const targetPos = getTargetPosition(target);
  if (targetPos.roomName !== creep.room.name) {
    return null;
  }

  const path = creep.pos.findPathTo(
    targetPos,
    withRoomEdgeAvoidance(creep, target, opts),
  );
  const nextStep = path[0];
  if (!nextStep) {
    return null;
  }

  return new RoomPosition(nextStep.x, nextStep.y, creep.room.name);
}

function swappedWithLastTick(creep: Creep, otherCreep: Creep): boolean {
  return (
    creep.memory.lastSwapCreepName === otherCreep.name &&
    creep.memory.lastSwapTick === Game.time - 1
  );
}

function rememberSwap(creep: Creep, otherCreep: Creep): void {
  creep.memory.lastSwapCreepName = otherCreep.name;
  creep.memory.lastSwapTick = Game.time;
}

function requestSwapWithBlockingCreep(
  creep: Creep,
  nextStep: RoomPosition | null,
): void {
  if (creep.fatigue > 0 || updateMoveStuckCount(creep) < SWAP_STUCK_THRESHOLD) {
    return;
  }

  if (!nextStep || !creep.pos.isNearTo(nextStep)) {
    return;
  }

  const blocker = nextStep
    .lookFor(LOOK_CREEPS)
    .find(
      (blockingCreep) =>
        blockingCreep.my &&
        blockingCreep.name !== creep.name &&
        blockingCreep.fatigue === 0,
    );
  if (!blocker) {
    return;
  }

  blocker.memory.swapRequest = {
    requesterName: creep.name,
    requesterX: creep.pos.x,
    requesterY: creep.pos.y,
    requesterRoomName: creep.pos.roomName,
    tick: Game.time,
  };
}

function isDroppedEnergy(
  target: EnergyRefillTarget,
): target is Resource<RESOURCE_ENERGY> {
  return "amount" in target;
}

function getRefillEnergyAmount(target: EnergyRefillTarget): number {
  if (isDroppedEnergy(target)) {
    return target.resourceType === RESOURCE_ENERGY ? target.amount : 0;
  }

  return target.store[RESOURCE_ENERGY];
}

function hasRefillEnergy(target: EnergyRefillTarget): boolean {
  return getRefillEnergyAmount(target) > 0;
}

function getReservedEnergyCapacity(
  creep: Creep,
  target: EnergyRefillTarget,
): number {
  return Object.values(Game.creeps)
    .filter(
      (otherCreep) =>
        otherCreep.name !== creep.name &&
        otherCreep.memory.energyTargetId === target.id,
    )
    .reduce(
      (total, otherCreep) =>
        total + otherCreep.store.getFreeCapacity(RESOURCE_ENERGY),
      0,
    );
}

function isEnergyTargetReservedByOtherCreep(
  creep: Creep,
  target: EnergyRefillTarget,
): boolean {
  return (
    getReservedEnergyCapacity(creep, target) >= getRefillEnergyAmount(target)
  );
}

function findAdjacentSourceContainer(
  source: Source,
): StructureContainer | null {
  const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: (structure): structure is StructureContainer =>
      structure.structureType === STRUCTURE_CONTAINER,
  });

  return containers[0] ?? null;
}

function isRoomEdge(pos: RoomPosition): boolean {
  return pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49;
}

function isRoadPosition(pos: RoomPosition): boolean {
  return pos
    .lookFor(LOOK_STRUCTURES)
    .some((structure) => structure.structureType === STRUCTURE_ROAD);
}

function isBlockingStructure(structure: Structure): boolean {
  return (
    structure.structureType !== STRUCTURE_ROAD &&
    structure.structureType !== STRUCTURE_CONTAINER &&
    structure.structureType !== STRUCTURE_RAMPART
  );
}

function isSafeNonRoadPosition(creep: Creep, pos: RoomPosition): boolean {
  if (pos.roomName !== creep.room.name || isRoomEdge(pos)) {
    return false;
  }

  const terrain = creep.room.getTerrain();
  if (terrain.get(pos.x, pos.y) === TERRAIN_MASK_WALL) {
    return false;
  }

  if (pos.lookFor(LOOK_CREEPS).length > 0) {
    return false;
  }

  if (pos.lookFor(LOOK_CONSTRUCTION_SITES).length > 0) {
    return false;
  }

  const structures = pos.lookFor(LOOK_STRUCTURES);
  return (
    !structures.some(
      (structure) => structure.structureType === STRUCTURE_ROAD,
    ) && !structures.some(isBlockingStructure)
  );
}

function getPositionsInRange(pos: RoomPosition, range: number): RoomPosition[] {
  const positions: RoomPosition[] = [];

  for (
    let x = Math.max(1, pos.x - range);
    x <= Math.min(48, pos.x + range);
    x += 1
  ) {
    for (
      let y = Math.max(1, pos.y - range);
      y <= Math.min(48, pos.y + range);
      y += 1
    ) {
      const candidate = new RoomPosition(x, y, pos.roomName);
      if (candidate.inRangeTo(pos, range)) {
        positions.push(candidate);
      }
    }
  }

  return positions;
}

function findSafeNonRoadPositionInRange(
  creep: Creep,
  pos: RoomPosition,
  range: number,
): RoomPosition | null {
  const candidates = getPositionsInRange(pos, range).filter((candidate) =>
    isSafeNonRoadPosition(creep, candidate),
  );

  return creep.pos.findClosestByPath(candidates);
}

function moveToNonRoadWorkPosition(
  creep: Creep,
  target: Parameters<Creep["moveTo"]>[0],
  range: number,
  opts?: MoveToAvoidingRoomEdgesOpts,
): boolean {
  const targetPos = getTargetPosition(target);
  if (targetPos.roomName !== creep.room.name) {
    return false;
  }

  const workPosition = findSafeNonRoadPositionInRange(creep, targetPos, range);
  if (!workPosition || creep.pos.isEqualTo(workPosition)) {
    return false;
  }

  creep.moveToAvoidingRoomEdges(workPosition, opts);
  return true;
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
    opts?: MoveToAvoidingRoomEdgesOpts,
  ): ReturnType<Creep["moveTo"]> {
    const nextStep = findNextStep(this, target, opts);
    if (opts?.requestSwap !== false) {
      requestSwapWithBlockingCreep(this, nextStep);
    }
    return this.moveTo(target, withRoomEdgeAvoidance(this, target, opts));
  };

  Creep.prototype.handleSwapRequest = function (): boolean {
    const request = this.memory.swapRequest;
    delete this.memory.swapRequest;

    if (!request || Game.time - request.tick > SWAP_REQUEST_TTL) {
      return false;
    }

    const requester = Game.creeps[request.requesterName];
    if (
      !requester ||
      this.fatigue > 0 ||
      requester.fatigue > 0 ||
      !positionMatches(
        requester.pos,
        request.requesterX,
        request.requesterY,
        request.requesterRoomName,
      ) ||
      this.pos.roomName !== requester.pos.roomName ||
      !this.pos.isNearTo(requester) ||
      swappedWithLastTick(this, requester) ||
      swappedWithLastTick(requester, this)
    ) {
      return false;
    }

    if (this.move(this.pos.getDirectionTo(requester)) !== OK) {
      return false;
    }

    rememberSwap(this, requester);
    rememberSwap(requester, this);
    return true;
  };

  Creep.prototype.moveOffRoad = function (): boolean {
    if (!isRoadPosition(this.pos)) {
      return false;
    }

    const parkingPosition = findSafeNonRoadPositionInRange(this, this.pos, 5);
    if (!parkingPosition) {
      return false;
    }

    this.moveToAvoidingRoomEdges(parkingPosition, {
      visualizePathStyle: { stroke: "#888888" },
    });
    return true;
  };

  Creep.prototype.moveToWorkTarget = function (
    target: Parameters<Creep["moveTo"]>[0],
    actionResult:
      | ReturnType<Creep["build"]>
      | ReturnType<Creep["repair"]>
      | ReturnType<Creep["upgradeController"]>,
    range = 3,
    opts?: Parameters<Creep["moveTo"]>[1],
  ): boolean {
    if (actionResult === ERR_NOT_IN_RANGE) {
      if (moveToNonRoadWorkPosition(this, target, range, opts)) {
        return true;
      }

      this.moveToAvoidingRoomEdges(target, opts);
      return true;
    }

    if (actionResult === OK && isRoadPosition(this.pos)) {
      return moveToNonRoadWorkPosition(this, target, range, opts);
    }

    return false;
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
        this.moveToAvoidingRoomEdges(source, {
          visualizePathStyle: { stroke: "#ffaa00" },
        });
      }
    }
  };

  Creep.prototype.transferEnergyTo = function (
    target: Structure | AnyCreep | null,
  ): void {
    if (target) {
      if (this.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(target, {
          visualizePathStyle: { stroke: "#ffffff" },
        });
      }
    }
  };

  Creep.prototype.withdrawEnergyFrom = function (
    target: EnergyWithdrawTarget | null,
  ): void {
    if (target) {
      if (this.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(target, {
          visualizePathStyle: { stroke: "#ffaa00" },
        });
      }
    }
  };

  Creep.prototype.pickUpEnergy = function (
    target: Resource<RESOURCE_ENERGY> | null,
  ): void {
    if (target) {
      if (this.pickup(target) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(target, {
          visualizePathStyle: { stroke: "#ffaa00" },
        });
      }
    }
  };

  Creep.prototype.clearEnergyTarget = function (): void {
    delete this.memory.energyTargetId;
  };

  Creep.prototype.findEnergyRefillTarget =
    function (): EnergyRefillTarget | null {
      if (this.memory.energyTargetId) {
        const savedTarget = Game.getObjectById(this.memory.energyTargetId);
        if (
          savedTarget &&
          hasRefillEnergy(savedTarget) &&
          !isEnergyTargetReservedByOtherCreep(this, savedTarget)
        ) {
          return savedTarget;
        }

        this.clearEnergyTarget();
      }

      const target = this.findDecayingEnergy() ?? this.findEnergyContainer();
      if (target) {
        this.memory.energyTargetId = target.id;
      }

      return target;
    };

  Creep.prototype.goUpgradeController = function (): void {
    const controller = this.room.controller;
    if (!controller) {
      this.moveOffRoad();
      return;
    }

    this.moveToWorkTarget(controller, this.upgradeController(controller), 3, {
      visualizePathStyle: { stroke: "#ffffff" },
    });
  };

  Creep.prototype.findRepairTarget = function ():
    | StructureRoad
    | StructureContainer
    | StructureRampart
    | StructureWall
    | null {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure): structure is RepairTarget =>
        isRepairTarget(structure) && getRepairPriority(structure) !== null,
    });
  };

  Creep.prototype.findAndRepair = function (): boolean {
    const target = this.findRepairTarget();
    if (target) {
      this.moveToWorkTarget(target, this.repair(target), 3, {
        visualizePathStyle: { stroke: "#ffaa00" },
      });
      return true;
    }
    return false;
  };

  Creep.prototype.findBuildTarget = function (): ConstructionSite | null {
    return this.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, {
      ignoreCreeps: true,
    });
  };

  Creep.prototype.findAndBuild = function (): boolean {
    const target = this.findBuildTarget();
    if (target) {
      this.moveToWorkTarget(target, this.build(target), 3, {
        visualizePathStyle: { stroke: "#ffffff" },
      });
      return true;
    }
    return false;
  };

  Creep.prototype.goToFlag = function (
    flagName: string,
    range = 0,
    pathStyle: PolyStyle = { stroke: "#ffffff" },
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

  Creep.prototype.findDroppedEnergy =
    function (): Resource<RESOURCE_ENERGY> | null {
      return this.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
        filter: (resource): resource is Resource<RESOURCE_ENERGY> =>
          resource.resourceType === RESOURCE_ENERGY &&
          resource.amount > 0 &&
          !isEnergyTargetReservedByOtherCreep(
            this,
            resource as Resource<RESOURCE_ENERGY>,
          ),
      });
    };

  Creep.prototype.findDecayingEnergy =
    function (): DecayingEnergyTarget | null {
      const droppedEnergy = this.room.find(FIND_DROPPED_RESOURCES, {
        filter: (resource): resource is Resource<RESOURCE_ENERGY> =>
          resource.resourceType === RESOURCE_ENERGY &&
          resource.amount > 0 &&
          !isEnergyTargetReservedByOtherCreep(
            this,
            resource as Resource<RESOURCE_ENERGY>,
          ),
      });
      const ruins = this.room.find(FIND_RUINS, {
        filter: (target) =>
          target.store[RESOURCE_ENERGY] > 0 &&
          !isEnergyTargetReservedByOtherCreep(this, target),
      });
      const tombstones = this.room.find(FIND_TOMBSTONES, {
        filter: (target) =>
          target.store[RESOURCE_ENERGY] > 0 &&
          !isEnergyTargetReservedByOtherCreep(this, target),
      });

      return this.pos.findClosestByPath([
        ...droppedEnergy,
        ...ruins,
        ...tombstones,
      ]);
    };

  Creep.prototype.findAdjacentSourceContainer = findAdjacentSourceContainer;

  Creep.prototype.findEnergyContainer = function (): StructureContainer | null {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.store[RESOURCE_ENERGY] > 0 &&
        !isEnergyTargetReservedByOtherCreep(this, structure),
    });
  };

  Creep.prototype.findWithdrawableEnergy =
    function (): EnergyWithdrawTarget | null {
      const container = this.findEnergyContainer();
      const ruin = this.pos.findClosestByPath(FIND_RUINS, {
        filter: (target) =>
          target.store[RESOURCE_ENERGY] > 0 &&
          !isEnergyTargetReservedByOtherCreep(this, target),
      });
      const tombstone = this.pos.findClosestByPath(FIND_TOMBSTONES, {
        filter: (target) =>
          target.store[RESOURCE_ENERGY] > 0 &&
          !isEnergyTargetReservedByOtherCreep(this, target),
      });

      const targets = [container, ruin, tombstone].filter(
        (target): target is StructureContainer | Ruin | Tombstone => !!target,
      );
      return this.pos.findClosestByPath(targets);
    };

  Creep.prototype.findControllerContainer =
    function (): StructureContainer | null {
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

  Creep.prototype.findRefuelStructure = function ():
    | StructureSpawn
    | StructureExtension
    | null {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure): structure is StructureSpawn | StructureExtension =>
        (structure.structureType === STRUCTURE_SPAWN ||
          structure.structureType === STRUCTURE_EXTENSION) &&
        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0,
    });
  };
}
