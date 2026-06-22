import {
  bodyCost,
  buildBodyFromMaxPattern,
  CREEP_BODY,
  minimumBodyCost,
} from "../creepBodies";
import { canTowersOverpowerHostile } from "../hostileTargeting";
import { findBestRepairTarget, getRepairPriority } from "../repairPolicy";
import { CREEP_ROLE, type CreepRole, type SpawnRequest } from "../types";
import { getControllerDeliveryContainer } from "./buildPlanManager";
import { expansionManager } from "./expansionManager";

const MAX_DESIRED_CARRIER_CAPACITY = 1600;
const HAULABLE_ENERGY_BUFFER = 1.25;

// Controller-container energy that marks the economy as having spare throughput.
// The upgrader holds this near the threshold in equilibrium, so we treat it as a
// feedback setpoint: while it stays above, the economy can absorb another sink.
const SURPLUS_CONTROLLER_CONTAINER_ENERGY = 2000;
// Ticks between probe adjustments, long enough for the last added worker to reach
// steady consumption and show up in the setpoint before we nudge the count again.
const DISCRETIONARY_PROBE_INTERVAL = 100;
// Count caps. Builders saturate a queued site fast, so they cap low; upgraders are
// the deeper surplus sink.
const BUILDER_CAP = 3;
const UPGRADER_CAP = 3;

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
    expansionManager.reconcileAttempts();

    for (const spawn of getOwnedSpawns()) {
      if (spawn.spawning) {
        continue;
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
        continue;
      }

      const newName = `${request.role}-${spawn.name}-${Game.time}`;
      const result = spawn.spawnCreep(request.body, newName, {
        memory: { role: request.role, ...request.memory },
      });

      if (result === OK) {
        console.log(
          `Spawning new ${request.role} at ${spawn.name}: ${newName}`,
        );
        expansionManager.recordSpawn(newName, request);
      }
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

    const haulableEnergy = getHaulableEnergy(room);
    const minimumCarriers = sources.length > 1 || haulableEnergy > 0 ? 2 : 1;
    const desiredCarrierCapacity = getDesiredCarrierCapacity(haulableEnergy);
    const needsMoreCarrierCapacity =
      getCarrierCapacity(carriers) < desiredCarrierCapacity;
    if (
      harvesters.length > 0 &&
      (carriers.length < minimumCarriers || needsMoreCarrierCapacity)
    ) {
      return {
        role: CREEP_ROLE.CARRIER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.CARRIER,
          energyBudget: capacityEnergy,
        }),
        memory: { working: false },
      };
    }

    const expansionRequest = expansionManager.getSpawnRequest(
      room,
      capacityEnergy,
    );
    if (expansionRequest) {
      return expansionRequest;
    }

    const { desiredBuilders, desiredUpgraders } = getDiscretionaryPlan(
      room,
      builders,
      upgraders,
    );

    if (hasConstructionWork(room) && builders.length < desiredBuilders) {
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

function getOwnedSpawns(): StructureSpawn[] {
  return Object.values(Game.spawns).sort((left, right) => {
    if (left.room.name !== right.room.name) {
      return left.room.name.localeCompare(right.room.name);
    }

    return left.name.localeCompare(right.name);
  });
}

function groupCreepsByRole(creeps: Creep[]): CreepsByRole {
  const creepsByRole = new Map<CreepRole, Creep[]>();

  for (const creep of creeps) {
    const group = creepsByRole.get(creep.memory.role) ?? [];
    group.push(creep);
    creepsByRole.set(creep.memory.role, group);
  }

  return (role) => creepsByRole.get(role) ?? [];
}

function canAfford(spawn: StructureSpawn, body: BodyPartConstant[]): boolean {
  return spawn.room.energyAvailable >= bodyCost(body);
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

function getHaulableEnergy(room: Room): number {
  const controllerDeliveryContainer = getControllerDeliveryContainer(room);
  const droppedEnergy = room
    .find(FIND_DROPPED_RESOURCES, {
      filter: (resource) =>
        resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50,
    })
    .reduce((total, resource) => total + resource.amount, 0);
  const containerEnergy = room
    .find(FIND_STRUCTURES, {
      filter: (structure): structure is StructureContainer =>
        structure.structureType === STRUCTURE_CONTAINER &&
        structure.id !== controllerDeliveryContainer?.id &&
        structure.store[RESOURCE_ENERGY] >= 50,
    })
    .reduce((total, container) => total + container.store[RESOURCE_ENERGY], 0);
  const tombstoneEnergy = room
    .find(FIND_TOMBSTONES)
    .reduce((total, tombstone) => total + tombstone.store[RESOURCE_ENERGY], 0);
  const ruinEnergy = room
    .find(FIND_RUINS)
    .reduce((total, ruin) => total + ruin.store[RESOURCE_ENERGY], 0);

  return droppedEnergy + containerEnergy + tombstoneEnergy + ruinEnergy;
}

function getCarrierCapacity(carriers: Creep[]): number {
  return carriers.reduce(
    (total, carrier) => total + carrier.store.getCapacity(RESOURCE_ENERGY),
    0,
  );
}

function getDesiredCarrierCapacity(haulableEnergy: number): number {
  return Math.min(
    MAX_DESIRED_CARRIER_CAPACITY,
    Math.ceil(haulableEnergy * HAULABLE_ENERGY_BUFFER),
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

interface DiscretionaryPlan {
  desiredBuilders: number;
  desiredUpgraders: number;
}

// Builder/upgrader counts are surplus-funded "probes" stored in room memory.
// On a fixed cadence we nudge them: grow by one while the economy has spare
// throughput (controller container above the setpoint), shrink toward baseline
// when it doesn't. Construction work gets first claim when growing; upgraders
// give way first when shrinking. Growing only past a filled target keeps small
// early-game bodies from running the count ahead of the spawns.
function getDiscretionaryPlan(
  room: Room,
  builders: Creep[],
  upgraders: Creep[],
): DiscretionaryPlan {
  let desiredBuilders = room.memory.desiredBuilders ?? 1;
  let desiredUpgraders = room.memory.desiredUpgraders ?? 1;

  if (Game.time % DISCRETIONARY_PROBE_INTERVAL === 0) {
    const hasWork = hasConstructionWork(room);

    if (isSurplusEconomy(room)) {
      if (
        hasWork &&
        desiredBuilders < BUILDER_CAP &&
        builders.length >= desiredBuilders
      ) {
        desiredBuilders += 1;
      } else if (
        desiredUpgraders < UPGRADER_CAP &&
        upgraders.length >= desiredUpgraders
      ) {
        desiredUpgraders += 1;
      }
    } else if (desiredUpgraders > 1) {
      desiredUpgraders -= 1;
    } else if (desiredBuilders > 1) {
      desiredBuilders -= 1;
    }

    room.memory.desiredBuilders = desiredBuilders;
    room.memory.desiredUpgraders = desiredUpgraders;
  }

  return { desiredBuilders, desiredUpgraders };
}

function isSurplusEconomy(room: Room): boolean {
  return (
    getControllerContainerEnergy(room) >= SURPLUS_CONTROLLER_CONTAINER_ENERGY
  );
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
