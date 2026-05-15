import { CREEP_ROLE, type CreepRole } from "../types";

const PIONEER_BODY: BodyPartConstant[] = [WORK, CARRY, CARRY, MOVE, MOVE];
const MINIMUM_WORKER_BODY: BodyPartConstant[] = [WORK, CARRY, MOVE];
const MINIMUM_CARRIER_BODY: BodyPartConstant[] = [CARRY, CARRY, MOVE];
const MINIMUM_DEFENDER_BODY: BodyPartConstant[] = [TOUGH, ATTACK, MOVE, MOVE];
const MAX_HARVESTER_WORK_PARTS = 5;

interface SpawnRequest {
  role: CreepRole;
  body: BodyPartConstant[];
  memory?: Partial<CreepMemory>;
}

type CreepsByRole = (role: CreepRole) => Creep[];

interface SpawnContext {
  room: Room;
  creeps: Creep[];
  creepsByRole: CreepsByRole;
  sources: Source[];
  hostiles: Creep[];
}

// Main spawning coordinator: gather room state, choose the next role, then spawn it.
export const spawnManager = {
  manageSpawning(): void {
    const spawn = Game.spawns.Spawn1;
    if (!spawn || spawn.spawning) {
      return;
    }

    const room = spawn.room;
    const creeps = Object.values(Game.creeps).filter(
      (creep) => creep.room.name === room.name,
    );
    const creepsByRole = groupCreepsByRole(creeps);
    const sources = room.find(FIND_SOURCES);
    const hostiles = room.find(FIND_HOSTILE_CREEPS);

    const request = this.getSpawnRequest({
      room,
      creeps,
      creepsByRole,
      sources,
      hostiles,
    });

    if (!request || !canAfford(spawn, request.body)) {
      return;
    }

    const newName = `${request.role}${Game.time}`;
    const result = spawn.spawnCreep(request.body, newName, {
      memory: { role: request.role, ...request.memory },
    });

    if (result === OK) {
      console.log(`Spawning new ${request.role}: ${newName}`);
    }
  },

  getSpawnRequest(context: SpawnContext): SpawnRequest | null {
    const { room, creeps, creepsByRole, sources, hostiles } = context;

    const harvesters = creepsByRole(CREEP_ROLE.HARVESTER);
    const carriers = creepsByRole(CREEP_ROLE.CARRIER);
    const builders = creepsByRole(CREEP_ROLE.BUILDER);
    const repairers = creepsByRole(CREEP_ROLE.REPAIRER);
    const upgraders = creepsByRole(CREEP_ROLE.UPGRADER);
    const defenders = creepsByRole(CREEP_ROLE.DEFENDER);

    const energyCapacity = room.energyCapacityAvailable;

    if (creeps.length === 0) {
      return {
        role: CREEP_ROLE.PIONEER,
        body: buildPioneerBody(room.energyAvailable),
      };
    }

    if (hostiles.length > 0 && defenders.length === 0) {
      return {
        role: CREEP_ROLE.DEFENDER,
        body: buildDefenderBody(energyCapacity),
      };
    }

    if (harvesters.length > 0 && carriers.length === 0) {
      return {
        role: CREEP_ROLE.CARRIER,
        body: buildCarrierBody(room.energyAvailable),
        memory: { working: false },
      };
    }

    const unclaimedSource = findUnclaimedHarvesterSource(room, harvesters);
    if (unclaimedSource) {
      return {
        role: CREEP_ROLE.HARVESTER,
        body: buildHarvesterBody(energyCapacity),
        memory: { sourceId: unclaimedSource.id },
      };
    }

    const desiredCarriers =
      sources.length > 1 || hasAvailableEnergyForCarriers(room) ? 2 : 1;
    if (harvesters.length > 0 && carriers.length < desiredCarriers) {
      return {
        role: CREEP_ROLE.CARRIER,
        body: buildCarrierBody(energyCapacity),
        memory: { working: false },
      };
    }

    if (hasConstructionWork(room) && builders.length === 0) {
      return {
        role: CREEP_ROLE.BUILDER,
        body: buildWorkerBody(energyCapacity),
      };
    }

    if (hasCriticalRepairWork(room) && repairers.length === 0) {
      return {
        role: CREEP_ROLE.REPAIRER,
        body: buildWorkerBody(energyCapacity),
      };
    }

    if (
      harvesters.length >= sources.length &&
      carriers.length > 0 &&
      upgraders.length < 1
    ) {
      return {
        role: CREEP_ROLE.UPGRADER,
        body: buildWorkerBody(energyCapacity),
      };
    }

    return null;
  },
};

function groupCreepsByRole(creeps: Creep[]): CreepsByRole {
  const creepsByRole = new Map<CreepRole, Creep[]>();

  for (const creep of creeps) {
    const group = creepsByRole.get(creep.memory.role) ?? [];
    group.push(creep);
    creepsByRole.set(creep.memory.role, group);
  }

  return (role) => creepsByRole.get(role) ?? [];
}

// Body builders scale each role from the room's current or maximum energy budget.
function bodyCost(body: BodyPartConstant[]): number {
  return body.reduce((total, part) => total + BODYPART_COST[part], 0);
}

function canAfford(spawn: StructureSpawn, body: BodyPartConstant[]): boolean {
  return spawn.room.energyAvailable >= bodyCost(body);
}

function buildBodyFromPattern(
  energyCapacity: number,
  baseBody: BodyPartConstant[],
  scalingPattern: BodyPartConstant[],
): BodyPartConstant[] {
  const body = [...baseBody];
  let remainingEnergy = energyCapacity - bodyCost(body);
  let nextPartIndex = 0;

  while (body.length < MAX_CREEP_SIZE) {
    const nextPart = scalingPattern[nextPartIndex % scalingPattern.length];

    if (remainingEnergy < BODYPART_COST[nextPart]) {
      break;
    }

    body.push(nextPart);
    remainingEnergy -= BODYPART_COST[nextPart];
    nextPartIndex += 1;
  }

  return body;
}

function buildHarvesterBody(energyCapacity: number): BodyPartConstant[] {
  const body: BodyPartConstant[] = [CARRY, MOVE];
  let remainingEnergy = energyCapacity - bodyCost(body);
  let workParts = 0;

  while (
    workParts < MAX_HARVESTER_WORK_PARTS &&
    remainingEnergy >= BODYPART_COST[WORK] &&
    body.length < MAX_CREEP_SIZE
  ) {
    body.unshift(WORK);
    remainingEnergy -= BODYPART_COST[WORK];
    workParts += 1;
  }

  return body;
}

function buildCarrierBody(energyCapacity: number): BodyPartConstant[] {
  const body: BodyPartConstant[] = [];
  let remainingEnergy = energyCapacity;

  while (
    remainingEnergy >= bodyCost(MINIMUM_CARRIER_BODY) &&
    body.length <= MAX_CREEP_SIZE - 3
  ) {
    body.push(CARRY, CARRY, MOVE);
    remainingEnergy -= bodyCost(MINIMUM_CARRIER_BODY);
  }

  return body.length > 0 ? body : MINIMUM_CARRIER_BODY;
}

function buildDefenderBody(energyCapacity: number): BodyPartConstant[] {
  const body: BodyPartConstant[] = [];
  let remainingEnergy = energyCapacity;

  while (
    remainingEnergy >= bodyCost(MINIMUM_DEFENDER_BODY) &&
    body.length <= MAX_CREEP_SIZE - 4
  ) {
    body.push(TOUGH, ATTACK, MOVE, MOVE);
    remainingEnergy -= bodyCost(MINIMUM_DEFENDER_BODY);
  }

  return body.length > 0 ? body : MINIMUM_DEFENDER_BODY;
}

function buildWorkerBody(energyCapacity: number): BodyPartConstant[] {
  return buildBodyFromPattern(energyCapacity, MINIMUM_WORKER_BODY, [
    WORK,
    CARRY,
    WORK,
    MOVE,
  ]);
}

function buildPioneerBody(energyAvailable: number): BodyPartConstant[] {
  return energyAvailable >= bodyCost(PIONEER_BODY)
    ? PIONEER_BODY
    : MINIMUM_WORKER_BODY;
}

// Room state helpers keep the priority rules in getSpawnRequest readable.
function hasConstructionWork(room: Room): boolean {
  return room.find(FIND_CONSTRUCTION_SITES).length > 0;
}

function hasCriticalRepairWork(room: Room): boolean {
  return (
    room.find(FIND_STRUCTURES, {
      filter: (
        structure,
      ): structure is StructureRoad | StructureContainer | StructureRampart =>
        (structure.structureType === STRUCTURE_ROAD ||
          structure.structureType === STRUCTURE_CONTAINER ||
          structure.structureType === STRUCTURE_RAMPART) &&
        structure.hits < structure.hitsMax * 0.5,
    }).length > 0
  );
}

function hasAvailableEnergyForCarriers(room: Room): boolean {
  const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource) =>
      resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50,
  });

  if (droppedEnergy.length > 0) {
    return true;
  }

  return (
    room.find(FIND_STRUCTURES, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.store[RESOURCE_ENERGY] >= 50,
    }).length > 0
  );
}

function findUnclaimedHarvesterSource(
  room: Room,
  harvesters: Creep[],
): Source | null {
  const sources = room.find(FIND_SOURCES);

  for (const source of sources) {
    const assignedHarvester = harvesters.find(
      (creep) => creep.memory.sourceId === source.id,
    );
    if (!assignedHarvester) {
      return source;
    }
  }

  return null;
}
