import { bodyCost, buildBodyFromMaxPattern, CREEP_BODY } from "../creepBodies";
import { getDesiredDefenseSquadSize } from "../defenseSquad";
import { findReadyBoostLab } from "../empire/labPlans";
import { isRoomUnderUnsafeAttack } from "../hostileTargeting";
import { getDesiredRepairerCount } from "../repairPolicy";
import {
  CREEP_ROLE,
  type CreepRole,
  SPAWN_HOLD,
  type SpawnDecision,
  type SpawnRequest,
} from "../types";
import { getControllerDeliveryContainer } from "./buildPlanManager";
import { expansionManager } from "./expansionManager";
import { labManager } from "./labManager";
import { getRoomNeighbors } from "./roomLinkManager";
import { safeModeReplenishManager } from "./safeModeReplenishManager";

const FULL_HARVESTER_COST = bodyCost(CREEP_BODY.HARVESTER);

const BASE_CARRIER_CAPACITY_PER_SOURCE = 400;
const EXTRA_CARRIER_HAULABLE_ENERGY_PER_SOURCE = 1400;
const MAX_BASE_CARRIERS = 4;
const MAX_CARRIERS_PER_ROOM = 5;
const ATTACK_CARRIER_TARGET = 3;
const EXTRA_CARRIER_PROBE_INTERVAL = 100;
// A low-RCL recovery room must be able to field the same ranged-defense role.
// The first TOUGH/RANGED_ATTACK/MOVE trio costs 210, fitting a 300-capacity
// RCL1 room; the existing pattern adds combat and healing parts as capacity
// grows.
const MIN_COMBAT_BODY_SIZE = 3;
// How long a freshly spawned defender will detour for a boost before giving up.
const BOOST_DEADLINE_TICKS = 60;

// Controller-container energy that marks the economy as having spare throughput.
// The upgrader holds this near the threshold in equilibrium, so we treat it as a
// feedback setpoint: while it stays above, the economy can absorb another sink.
// Kept below the 2000 container capacity so the signal has headroom to trigger
// instead of needing the container pegged full (which it rarely is).
const SURPLUS_CONTROLLER_CONTAINER_ENERGY = 1200;
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
        (creep) =>
          creep.room.name === room.name &&
          (!creep.memory.targetRoom || creep.memory.targetRoom === room.name),
      );
      const creepsByRole = groupCreepsByRole(creeps);
      const sources = room.find(FIND_SOURCES);
      const hostiles = room.find(FIND_HOSTILE_CREEPS);

      const decision = this.getSpawnRequest({
        room,
        creeps,
        creepsByRole,
        sources,
        hostiles,
      });

      // A hold reserves the room's energy for a creep it cannot pay for yet, so
      // it must not fall through to the cross-room harvester either: a besieged
      // room does not spend its defense budget staffing a neighbor's source.
      if (decision === SPAWN_HOLD) {
        continue;
      }

      const request = decision ?? getCrossRoomHarvesterRequest(spawn);

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

  getSpawnRequest(context: SpawnContext): SpawnDecision {
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

    // Only combat creeps the towers cannot handle warrant wartime spawning; a
    // lone scout (common at low RCL with no towers) must not trigger it. Roles
    // stand their civilians down on this same signal.
    if (isRoomUnderUnsafeAttack(room, hostiles)) {
      return getUnsafeAttackDecision(context);
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

    const unclaimedSource = findUnclaimedHarvesterSource(room);
    if (unclaimedSource) {
      if (
        capacityEnergy < FULL_HARVESTER_COST &&
        hasAvailableNeighborSpawn(room)
      ) {
        return null;
      }

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
    const desiredCarriers = getDesiredCarrierCount(
      room,
      sources,
      carriers,
      haulableEnergy,
    );
    const needsBaseCarrierCapacity = needsMoreBaseCarrierCapacity(
      sources,
      carriers,
    );
    if (
      harvesters.length > 0 &&
      (needsBaseCarrierCapacity || carriers.length < desiredCarriers)
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

    // Empire lab/safe-mode logistics: gated on real work and their own reserves,
    // so they never fire in recovery rooms and sit below core economy needs.
    const labTechRequest = labManager.getSpawnRequest(room, creepsByRole);
    if (labTechRequest) {
      return labTechRequest;
    }

    const safeModeRequest = safeModeReplenishManager.getSpawnRequest(
      room,
      creepsByRole,
    );
    if (safeModeRequest) {
      return safeModeRequest;
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
    if (
      creep.memory.remoteOperate !== undefined &&
      Game.time < creep.memory.remoteOperate
    ) {
      continue;
    }
    const group = creepsByRole.get(creep.memory.role) ?? [];
    group.push(creep);
    creepsByRole.set(creep.memory.role, group);
  }

  return (role) => creepsByRole.get(role) ?? [];
}

function canAfford(spawn: StructureSpawn, body: BodyPartConstant[]): boolean {
  return spawn.room.energyAvailable >= bodyCost(body);
}

/**
 * Spawn policy while hostiles the towers cannot beat are in the room. The room
 * is buying survival, so the order is fixed and everything discretionary waits:
 * minimum energy production, wartime hauling, then the defense squad. Creeps
 * already alive keep doing their jobs; this only decides what the spawn builds
 * next.
 */
function getUnsafeAttackDecision(context: SpawnContext): SpawnDecision {
  const { creepsByRole, room } = context;

  // Recovery comes first: without any harvester the room cannot refill the
  // spawn, towers, or extensions needed to sustain the defense. Only replace
  // the first harvester here; normal economy scaling waits for peace.
  const economyRequest = getEssentialEconomyRequest(context);
  if (economyRequest) {
    return economyRequest;
  }

  // Once income exists, ATTACK_CARRIER_TARGET keeps one carrier above the
  // peacetime baseline so towers and extensions stay fed while under fire.
  if (creepsByRole(CREEP_ROLE.CARRIER).length < ATTACK_CARRIER_TARGET) {
    return {
      role: CREEP_ROLE.CARRIER,
      body: buildBodyFromMaxPattern({
        maxBody: CREEP_BODY.CARRIER,
        energyBudget: room.energyCapacityAvailable,
      }),
      memory: { working: false },
    };
  }

  const defenderDecision = getDefenderDecision(context);
  if (defenderDecision !== null && defenderDecision !== SPAWN_HOLD) {
    return defenderDecision;
  }

  // Squad complete, or short a defender we are still saving up for. Either way
  // the energy stays in the room instead of buying a builder or an upgrader.
  return SPAWN_HOLD;
}

/**
 * The next member of the ranged-defense squad, `SPAWN_HOLD` while the room is
 * short one it cannot pay for this tick, or `null` once the squad is complete.
 *
 * Holding matters: the defender body is sized to the room's full energy
 * capacity, so a room mid-refill is only ever temporarily short of it. Spending
 * that partial energy on a cheaper civilian is how a room ends up with a half
 * defense and a builder walking into a ranged kill zone.
 */
function getDefenderDecision(context: SpawnContext): SpawnDecision {
  const { creepsByRole, hostiles, room } = context;
  const rangedDefenders = creepsByRole(CREEP_ROLE.RANGED_DEFENDER);
  const squadSize = getDesiredDefenseSquadSize(hostiles);
  if (rangedDefenders.length >= squadSize) {
    return null;
  }

  const body = buildBodyFromMaxPattern({
    maxBody: CREEP_BODY.RANGED_DEFENDER,
    energyBudget: room.energyCapacityAvailable,
    minimumSize: MIN_COMBAT_BODY_SIZE,
    sortBody: sortCombatBody,
  });
  if (room.energyAvailable < bodyCost(body)) {
    return SPAWN_HOLD;
  }

  return {
    role: CREEP_ROLE.RANGED_DEFENDER,
    body,
    memory: getDefenderBoostMemory(room, body),
  };
}

/**
 * The energy production a besieged room cannot survive without. A room with no
 * harvester at all has no income and cannot rebuild its defense, so it still
 * gets one; a room merely short its second harvester waits for the attack to
 * end. The body is sized to energy on hand, matching the empty-room path, so a
 * low-RCL room recovering under attack can always afford what it asks for.
 */
function getEssentialEconomyRequest(
  context: SpawnContext,
): SpawnRequest | null {
  const { creepsByRole, room } = context;
  if (creepsByRole(CREEP_ROLE.HARVESTER).length > 0) {
    return null;
  }

  const source = findUnclaimedHarvesterSource(room);
  if (!source) {
    return null;
  }

  return {
    role: CREEP_ROLE.HARVESTER,
    body: buildBodyFromMaxPattern({
      maxBody: CREEP_BODY.HARVESTER,
      energyBudget: room.energyAvailable,
    }),
    memory: { sourceId: source.id },
  };
}

// Request a defensive boost only when a boost lab is already stocked for this
// creep's TOUGH parts, with a deadline so a defender is never stranded waiting.
function getDefenderBoostMemory(
  room: Room,
  body: BodyPartConstant[],
): Partial<CreepMemory> | undefined {
  const toughParts = body.filter((part) => part === TOUGH).length;
  if (toughParts === 0 || !findReadyBoostLab(room, toughParts)) {
    return undefined;
  }

  return { wantsBoost: true, boostDeadline: Game.time + BOOST_DEADLINE_TICKS };
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

function needsMoreBaseCarrierCapacity(
  sources: Source[],
  carriers: Creep[],
): boolean {
  return (
    carriers.length < MAX_BASE_CARRIERS &&
    getCarrierCapacity(carriers) <
      sources.length * BASE_CARRIER_CAPACITY_PER_SOURCE
  );
}

function getDesiredCarrierCount(
  room: Room,
  sources: Source[],
  carriers: Creep[],
  haulableEnergy: number,
): number {
  const baseCarriers = sources.length > 1 || haulableEnergy > 0 ? 2 : 1;
  let desiredCarriers = Math.max(
    room.memory.desiredCarriers ?? baseCarriers,
    baseCarriers,
  );

  if (Game.time % EXTRA_CARRIER_PROBE_INTERVAL === 0) {
    const isHaulSurplus =
      haulableEnergy >
      sources.length * EXTRA_CARRIER_HAULABLE_ENERGY_PER_SOURCE;
    if (isHaulSurplus && carriers.length >= desiredCarriers) {
      desiredCarriers += 1;
    } else if (!isHaulSurplus && desiredCarriers > baseCarriers) {
      desiredCarriers -= 1;
    }
    room.memory.desiredCarriers = desiredCarriers;
  }

  if (desiredCarriers > MAX_CARRIERS_PER_ROOM) {
    desiredCarriers = MAX_CARRIERS_PER_ROOM;
    room.memory.desiredCarriers = desiredCarriers;
  }

  return desiredCarriers;
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

function findUnclaimedHarvesterSource(room: Room): Source | null {
  const sources = room.find(FIND_SOURCES);
  const allHarvesters = Object.values(Game.creeps).filter(
    (c) => c.memory.role === CREEP_ROLE.HARVESTER,
  );

  for (const source of sources) {
    const hasAssigned = allHarvesters.some(
      (creep) => creep.memory.sourceId === source.id,
    );
    if (!hasAssigned) {
      return source;
    }
  }

  return null;
}

function hasAvailableNeighborSpawn(room: Room): boolean {
  if (!canReceiveCrossRoomHarvester(room)) {
    return false;
  }

  const neighbors = getRoomNeighbors(room.name);

  for (const neighborName of neighbors) {
    const neighborRoom = Game.rooms[neighborName];
    if (!neighborRoom) continue;

    const spawns = neighborRoom.find(FIND_MY_SPAWNS);
    for (const spawn of spawns) {
      if (
        !spawn.spawning &&
        neighborRoom.energyAvailable >= FULL_HARVESTER_COST
      ) {
        return true;
      }
    }
  }

  return false;
}

function canReceiveCrossRoomHarvester(room: Room): boolean {
  return (
    room.controller?.my === true &&
    room.find(FIND_HOSTILE_CREEPS).length === 0 &&
    room.find(FIND_MY_SPAWNS).length > 0
  );
}

function getCrossRoomHarvesterRequest(
  spawn: StructureSpawn,
): SpawnRequest | null {
  if (spawn.room.energyAvailable < FULL_HARVESTER_COST) {
    return null;
  }

  const neighbors = getRoomNeighbors(spawn.room.name);

  for (const neighborName of neighbors) {
    const neighborRoom = Game.rooms[neighborName];
    if (!neighborRoom) continue;

    if (!canReceiveCrossRoomHarvester(neighborRoom)) continue;

    if (neighborRoom.energyCapacityAvailable >= FULL_HARVESTER_COST) continue;

    const unclaimedSource = findUnclaimedHarvesterSource(neighborRoom);
    if (unclaimedSource) {
      return {
        role: CREEP_ROLE.HARVESTER,
        body: CREEP_BODY.HARVESTER,
        memory: { sourceId: unclaimedSource.id, targetRoom: neighborName },
      };
    }
  }

  return null;
}
