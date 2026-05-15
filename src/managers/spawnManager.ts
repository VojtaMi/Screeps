import type { CreepRole } from "../types";

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

  while (remainingEnergy >= bodyCost(MINIMUM_CARRIER_BODY) && body.length <= MAX_CREEP_SIZE - 3) {
    body.push(CARRY, CARRY, MOVE);
    remainingEnergy -= bodyCost(MINIMUM_CARRIER_BODY);
  }

  return body.length > 0 ? body : MINIMUM_CARRIER_BODY;
}

function buildDefenderBody(energyCapacity: number): BodyPartConstant[] {
  const body: BodyPartConstant[] = [];
  let remainingEnergy = energyCapacity;

  while (remainingEnergy >= bodyCost(MINIMUM_DEFENDER_BODY) && body.length <= MAX_CREEP_SIZE - 4) {
    body.push(TOUGH, ATTACK, MOVE, MOVE);
    remainingEnergy -= bodyCost(MINIMUM_DEFENDER_BODY);
  }

  return body.length > 0 ? body : MINIMUM_DEFENDER_BODY;
}

function buildWorkerBody(energyCapacity: number): BodyPartConstant[] {
  return buildBodyFromPattern(energyCapacity, MINIMUM_WORKER_BODY, [WORK, CARRY, WORK, MOVE]);
}

function buildPioneerBody(energyAvailable: number): BodyPartConstant[] {
  return energyAvailable >= bodyCost(PIONEER_BODY) ? PIONEER_BODY : MINIMUM_WORKER_BODY;
}

function hasConstructionWork(room: Room): boolean {
  return room.find(FIND_CONSTRUCTION_SITES).length > 0;
}

function hasCriticalRepairWork(room: Room): boolean {
  return (
    room.find(FIND_STRUCTURES, {
      filter: (structure): structure is StructureRoad | StructureContainer | StructureRampart =>
        (structure.structureType === STRUCTURE_ROAD ||
          structure.structureType === STRUCTURE_CONTAINER ||
          structure.structureType === STRUCTURE_RAMPART) &&
        structure.hits < structure.hitsMax * 0.5,
    }).length > 0
  );
}

function hasAvailableEnergyForCarriers(room: Room): boolean {
  const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
    filter: resource => resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50,
  });

  if (droppedEnergy.length > 0) {
    return true;
  }

  return (
    room.find(FIND_STRUCTURES, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER && structure.store[RESOURCE_ENERGY] >= 50,
    }).length > 0
  );
}

function findMissingHarvesterSource(room: Room, harvesters: Creep[]): Source | null {
  const sources = room.find(FIND_SOURCES);

  for (const source of sources) {
    const assignedHarvester = harvesters.find(creep => creep.memory.sourceId === source.id);
    if (!assignedHarvester) {
      return source;
    }
  }

  return null;
}

export const spawnManager = {
  manageSpawning(): void {
    const spawn = Game.spawns.Spawn1;
    if (!spawn || spawn.spawning) {
      return;
    }

    const room = spawn.room;
    const creeps = Object.values(Game.creeps).filter(creep => creep.room.name === room.name);
    const harvesters = creeps.filter(creep => creep.memory.role === "harvester");
    const carriers = creeps.filter(creep => creep.memory.role === "carrier");
    const builders = creeps.filter(creep => creep.memory.role === "builder");
    const repairers = creeps.filter(creep => creep.memory.role === "repairer");
    const upgraders = creeps.filter(creep => creep.memory.role === "upgrader");
    const defenders = creeps.filter(creep => creep.memory.role === "defender");
    const sources = room.find(FIND_SOURCES);
    const hostiles = room.find(FIND_HOSTILE_CREEPS);

    const request = this.getSpawnRequest({
      room,
      creeps,
      harvesters,
      carriers,
      builders,
      repairers,
      upgraders,
      defenders,
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

  getSpawnRequest(context: {
    room: Room;
    creeps: Creep[];
    harvesters: Creep[];
    carriers: Creep[];
    builders: Creep[];
    repairers: Creep[];
    upgraders: Creep[];
    defenders: Creep[];
    sources: Source[];
    hostiles: Creep[];
  }): SpawnRequest | null {
    const { room, creeps, harvesters, carriers, builders, repairers, upgraders, defenders, sources, hostiles } = context;
    const energyCapacity = room.energyCapacityAvailable;

    if (creeps.length === 0) {
      return { role: "pioneer", body: buildPioneerBody(room.energyAvailable) };
    }

    if (hostiles.length > 0 && defenders.length === 0) {
      return { role: "defender", body: buildDefenderBody(energyCapacity) };
    }

    if (harvesters.length > 0 && carriers.length === 0) {
      return { role: "carrier", body: buildCarrierBody(room.energyAvailable), memory: { working: false } };
    }

    const missingSource = findMissingHarvesterSource(room, harvesters);
    if (missingSource) {
      return {
        role: "harvester",
        body: buildHarvesterBody(energyCapacity),
        memory: { sourceId: missingSource.id },
      };
    }

    const desiredCarriers = sources.length > 1 || hasAvailableEnergyForCarriers(room) ? 2 : 1;
    if (harvesters.length > 0 && carriers.length < desiredCarriers) {
      return { role: "carrier", body: buildCarrierBody(energyCapacity), memory: { working: false } };
    }

    if (hasConstructionWork(room) && builders.length === 0) {
      return { role: "builder", body: buildWorkerBody(energyCapacity) };
    }

    if (hasCriticalRepairWork(room) && repairers.length === 0) {
      return { role: "repairer", body: buildWorkerBody(energyCapacity) };
    }

    if (harvesters.length >= sources.length && carriers.length > 0 && upgraders.length < 1) {
      return { role: "upgrader", body: buildWorkerBody(energyCapacity) };
    }

    return null;
  },
};
