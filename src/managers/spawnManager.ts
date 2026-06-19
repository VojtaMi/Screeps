import { DEFAULT_BUILD_PLANS } from "../buildPlans";
import { CREEP_BODY } from "../creepBodies";
import { canTowersOverpowerHostile } from "../hostileTargeting";
import { findBestRepairTarget, getRepairPriority } from "../repairPolicy";
import { CREEP_ROLE, type CreepRole } from "../types";
import { getControllerDeliveryContainer } from "./buildPlanManager";

const CONTROLLER_CONTAINER_UPGRADER_THRESHOLDS = [
  { energy: 2000, upgraders: 2 },
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
  sortBody?: (body: BodyPartConstant[]) => BodyPartConstant[];
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

    const hasUnsafeHostiles = hostiles.some(
      (hostile) => !canTowersOverpowerHostile(room, hostile, hostiles),
    );
    if (hasUnsafeHostiles) {
      const defenderEnergyBudget =
        harvesters.length > 0 && carriers.length === 0
          ? availableEnergy - minimumBodyCost(CREEP_BODY.CARRIER)
          : availableEnergy;

      if (defenderEnergyBudget >= minimumBodyCost(CREEP_BODY.DEFENDER)) {
        return {
          role: CREEP_ROLE.DEFENDER,
          body: buildBodyFromMaxPattern({
            maxBody: CREEP_BODY.DEFENDER,
            energyBudget: defenderEnergyBudget,
            sortBody: sortCombatBody,
          }),
        };
      }
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

    const expansionRequest = getExpansionSpawnRequest(room, capacityEnergy);
    if (expansionRequest) {
      return expansionRequest;
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

function minimumBodyCost(body: BodyPartConstant[]): number {
  return bodyCost(body.slice(0, 3));
}

function canAfford(spawn: StructureSpawn, body: BodyPartConstant[]): boolean {
  return spawn.room.energyAvailable >= bodyCost(body);
}

function getExpansionSpawnRequest(
  room: Room,
  energyBudget: number,
): SpawnRequest | null {
  const targetRoom = findExpansionTargetRoom(room);
  if (!targetRoom) {
    return null;
  }

  const expansionCreeps = Object.values(Game.creeps).filter(
    (creep) => creep.memory.targetRoom === targetRoom,
  );
  const hasClaimer = expansionCreeps.some(
    (creep) => creep.memory.role === CREEP_ROLE.CLAIMER,
  );
  if (!hasClaimer) {
    return {
      role: CREEP_ROLE.CLAIMER,
      body: CREEP_BODY.CLAIMER,
      memory: { targetRoom },
    };
  }

  const hasSettler = expansionCreeps.some(
    (creep) => creep.memory.role === CREEP_ROLE.SETTLER,
  );
  if (!hasSettler) {
    return {
      role: CREEP_ROLE.SETTLER,
      body: buildBodyFromMaxPattern({
        maxBody: CREEP_BODY.PIONEER,
        energyBudget,
      }),
      memory: { targetRoom, working: false },
    };
  }

  return null;
}

function findExpansionTargetRoom(room: Room): string | null {
  if (!room.controller?.my || room.controller.level <= 3) {
    return null;
  }

  return (
    getAdjacentRoomNames(room.name)
      .filter((roomName) => isExpansionCandidate(Game.rooms[roomName]))
      .sort()[0] ?? null
  );
}

function isExpansionCandidate(room: Room | undefined): boolean {
  if (!room || !hasNonEmptyDefaultBuildPlan(room.name)) {
    return false;
  }

  const controller = room.controller;
  if (!controller) {
    return false;
  }

  if (controller.owner && !controller.my) {
    return false;
  }

  if (
    controller.reservation &&
    controller.reservation.username !== getMyUsername()
  ) {
    return false;
  }

  if (
    room.find(FIND_HOSTILE_CREEPS).length > 0 ||
    room.find(FIND_HOSTILE_STRUCTURES).length > 0
  ) {
    return false;
  }

  return !hasMySpawnOrSpawnSite(room);
}

function hasNonEmptyDefaultBuildPlan(roomName: string): boolean {
  return (DEFAULT_BUILD_PLANS[roomName]?.plan.length ?? 0) > 0;
}

function hasMySpawnOrSpawnSite(room: Room): boolean {
  const spawns = room.find(FIND_MY_STRUCTURES, {
    filter: (structure): structure is StructureSpawn =>
      structure.structureType === STRUCTURE_SPAWN,
  });
  if (spawns.length > 0) {
    return true;
  }

  return (
    room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: (site) => site.structureType === STRUCTURE_SPAWN,
    }).length > 0
  );
}

function getMyUsername(): string | null {
  return (
    Game.spawns.Spawn1?.owner.username ??
    Object.values(Game.creeps)[0]?.owner.username ??
    null
  );
}

function getAdjacentRoomNames(roomName: string): string[] {
  const position = parseRoomName(roomName);
  if (!position) {
    return [];
  }

  const roomNames: string[] = [];
  for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      if (xOffset === 0 && yOffset === 0) {
        continue;
      }

      roomNames.push(
        serializeRoomName(position.x + xOffset, position.y + yOffset),
      );
    }
  }

  return roomNames;
}

function parseRoomName(roomName: string): { x: number; y: number } | null {
  const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
  if (!match) {
    return null;
  }

  const [
    ,
    horizontalDirection,
    horizontalDistance,
    verticalDirection,
    verticalDistance,
  ] = match;
  const xDistance = Number(horizontalDistance);
  const yDistance = Number(verticalDistance);

  return {
    x: horizontalDirection === "E" ? xDistance : -xDistance - 1,
    y: verticalDirection === "S" ? yDistance : -yDistance - 1,
  };
}

function serializeRoomName(x: number, y: number): string {
  const horizontal = x >= 0 ? `E${x}` : `W${-x - 1}`;
  const vertical = y >= 0 ? `S${y}` : `N${-y - 1}`;
  return `${horizontal}${vertical}`;
}

function buildBodyFromMaxPattern({
  maxBody,
  energyBudget,
  minimumSize = 3,
  sortBody,
}: BodyBuildOptions): BodyPartConstant[] {
  const minimumBody = maxBody.slice(0, minimumSize);
  if (energyBudget < bodyCost(minimumBody)) {
    return sortBody ? sortBody(minimumBody) : minimumBody;
  }

  const body = [...minimumBody];

  for (const part of maxBody.slice(minimumBody.length)) {
    const nextBody = [...body, part];
    if (nextBody.length > MAX_CREEP_SIZE || bodyCost(nextBody) > energyBudget) {
      break;
    }

    body.push(part);
  }

  return sortBody ? sortBody(body) : body;
}

function sortCombatBody(body: BodyPartConstant[]): BodyPartConstant[] {
  const bodyPartOrder: BodyPartConstant[] = [
    TOUGH,
    MOVE,
    ATTACK,
    RANGED_ATTACK,
    HEAL,
    WORK,
    CARRY,
    CLAIM,
  ];
  const bodyPartCounts: Record<BodyPartConstant, number> = {
    [TOUGH]: 0,
    [ATTACK]: 0,
    [RANGED_ATTACK]: 0,
    [HEAL]: 0,
    [WORK]: 0,
    [CARRY]: 0,
    [CLAIM]: 0,
    [MOVE]: 0,
  };

  for (const part of body) {
    bodyPartCounts[part] += 1;
  }

  bodyPartCounts[MOVE] -= 1;

  return [
    ...bodyPartOrder.flatMap((part) => Array(bodyPartCounts[part]).fill(part)),
    MOVE,
  ];
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
  const target = findBestRepairTarget(room);
  if (!target) return 0;

  const priority = getRepairPriority(target);
  if (priority === 1) return 2;
  if (priority < 5) return 1; // damage worth a dedicated repairer
  return 0;
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
