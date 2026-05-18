import { CREEP_BODY } from "../creepBodies";
import { CREEP_ROLE, type CreepRole } from "../types";
import { getControllerDeliveryContainer } from "./buildPlanManager";

const CONTROLLER_CONTAINER_UPGRADER_THRESHOLDS = [
  { energy: 1800, upgraders: 4 },
  { energy: 1500, upgraders: 3 },
  { energy: 1000, upgraders: 2 },
] as const;

const REPAIRER_DAMAGE_THRESHOLDS = [
  { damageRatio: 0.5, repairers: 2 },
  { damageRatio: 0.9, repairers: 1 },
] as const;

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
  energyBudget: number;
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
    const availableEnergy = room.energyAvailable;
    const capacityEnergy = room.energyCapacityAvailable;
    const harvesterEnergyBudget =
      harvesters.length === 0 ? availableEnergy : capacityEnergy;

    if (creeps.length === 0) {
      return {
        role: CREEP_ROLE.PIONEER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.PIONEER,
          energyBudget: availableEnergy,
        }),
      };
    }

    if (hostiles.length > 0) {
      return {
        role: CREEP_ROLE.DEFENDER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.DEFENDER,
          energyBudget: availableEnergy,
        }),
      };
    }

    if (harvesters.length > 0 && carriers.length === 0) {
      return {
        role: CREEP_ROLE.CARRIER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.CARRIER,
          energyBudget: availableEnergy,
        }),
        memory: { working: false },
      };
    }

    const unclaimedSource = findUnclaimedHarvesterSource(room, harvesters);
    if (unclaimedSource) {
      return {
        role: CREEP_ROLE.HARVESTER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.HARVESTER,
          energyBudget: harvesterEnergyBudget,
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
          energyBudget: capacityEnergy,
        }),
        memory: { working: false },
      };
    }

    if (hasConstructionWork(room) && builders.length === 0) {
      return {
        role: CREEP_ROLE.BUILDER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.WORKER,
          energyBudget: capacityEnergy,
        }),
      };
    }

    const desiredRepairers = getDesiredRepairerCount(room);
    if (repairers.length < desiredRepairers) {
      return {
        role: CREEP_ROLE.REPAIRER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.WORKER,
          energyBudget: capacityEnergy,
        }),
      };
    }

    const desiredUpgraders = getDesiredUpgraderCount(room);
    if (
      harvesters.length >= sources.length &&
      carriers.length > 0 &&
      upgraders.length < desiredUpgraders
    ) {
      return {
        role: CREEP_ROLE.UPGRADER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.UPGRADER,
          energyBudget: capacityEnergy,
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
  energyBudget,
  minimumSize = 3,
}: BodyBuildOptions): BodyPartConstant[] {
  const minimumBody = maxBody.slice(0, minimumSize);
  if (energyBudget < bodyCost(minimumBody)) {
    return minimumBody;
  }

  const body = [...minimumBody];

  for (const part of maxBody.slice(minimumBody.length)) {
    const nextBody = [...body, part];
    if (nextBody.length > MAX_CREEP_SIZE || bodyCost(nextBody) > energyBudget) {
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

function getDesiredRepairerCount(room: Room): number {
  const worstDamageRatio = getWorstRepairDamageRatio(room);
  if (worstDamageRatio === null) {
    return 0;
  }

  for (const threshold of REPAIRER_DAMAGE_THRESHOLDS) {
    if (worstDamageRatio < threshold.damageRatio) {
      return threshold.repairers;
    }
  }

  return 0;
}

function getWorstRepairDamageRatio(room: Room): number | null {
  const repairTargets = room.find(FIND_STRUCTURES, {
    filter: (
      structure,
    ): structure is StructureRoad | StructureContainer | StructureRampart =>
      (structure.structureType === STRUCTURE_ROAD ||
        structure.structureType === STRUCTURE_CONTAINER ||
        structure.structureType === STRUCTURE_RAMPART) &&
      structure.hits < structure.hitsMax,
  });

  return repairTargets.reduce<number | null>((worstDamageRatio, target) => {
    const damageRatio = target.hits / target.hitsMax;

    if (worstDamageRatio === null || damageRatio < worstDamageRatio) {
      return damageRatio;
    }

    return worstDamageRatio;
  }, null);
}

function getDesiredUpgraderCount(room: Room): number {
  const controllerContainerEnergy = getControllerContainerEnergy(room);

  for (const threshold of CONTROLLER_CONTAINER_UPGRADER_THRESHOLDS) {
    if (controllerContainerEnergy >= threshold.energy) {
      return threshold.upgraders;
    }
  }

  return 1;
}

function getControllerContainerEnergy(room: Room): number {
  return getControllerDeliveryContainer(room)?.store[RESOURCE_ENERGY] ?? 0;
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
