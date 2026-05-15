import { CREEP_BODY } from "../creepBodies";
import { CREEP_ROLE, type CreepRole } from "../types";

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

interface BodyBuildOptions {
  maxBody: BodyPartConstant[];
  availableEnergy: number;
  minimumSize?: number;
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

    const availableEnergy = room.energyAvailable;

    if (creeps.length === 0) {
      return {
        role: CREEP_ROLE.PIONEER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.PIONEER,
          availableEnergy,
        }),
      };
    }

    if (hostiles.length > 0 && defenders.length === 0) {
      return {
        role: CREEP_ROLE.DEFENDER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.DEFENDER,
          availableEnergy,
        }),
      };
    }

    if (harvesters.length > 0 && carriers.length === 0) {
      return {
        role: CREEP_ROLE.CARRIER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.CARRIER,
          availableEnergy,
        }),
        memory: { working: false },
      };
    }

    const unclaimedSource = findUnclaimedHarvesterSource(room, harvesters);
    if (unclaimedSource) {
      return {
        role: CREEP_ROLE.HARVESTER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.STATIONARY_WORKER,
          availableEnergy,
        }),
        memory: { sourceId: unclaimedSource.id },
      };
    }

    const desiredCarriers =
      sources.length > 1 || hasAvailableEnergyForCarriers(room) ? 2 : 1;
    if (harvesters.length > 0 && carriers.length < desiredCarriers) {
      return {
        role: CREEP_ROLE.CARRIER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.CARRIER,
          availableEnergy,
        }),
        memory: { working: false },
      };
    }

    if (hasConstructionWork(room) && builders.length === 0) {
      return {
        role: CREEP_ROLE.BUILDER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.WORKER,
          availableEnergy,
        }),
      };
    }

    if (hasCriticalRepairWork(room) && repairers.length === 0) {
      return {
        role: CREEP_ROLE.REPAIRER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.WORKER,
          availableEnergy,
        }),
      };
    }

    if (
      harvesters.length >= sources.length &&
      carriers.length > 0 &&
      upgraders.length < 1
    ) {
      return {
        role: CREEP_ROLE.UPGRADER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.STATIONARY_WORKER,
          availableEnergy,
        }),
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

function buildBodyFromMaxPattern({
  maxBody,
  availableEnergy,
  minimumSize = 3,
}: BodyBuildOptions): BodyPartConstant[] {
  const minimumBody = maxBody.slice(0, minimumSize);
  if (availableEnergy < bodyCost(minimumBody)) {
    return minimumBody;
  }

  const body = [...minimumBody];

  for (const part of maxBody.slice(minimumBody.length)) {
    const nextBody = [...body, part];
    if (
      nextBody.length > MAX_CREEP_SIZE ||
      bodyCost(nextBody) > availableEnergy
    ) {
      break;
    }

    body.push(part);
  }

  return body;
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
