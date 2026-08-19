"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  loop: () => loop
});
module.exports = __toCommonJS(main_exports);

// src/constructionPriority.ts
var FOUNDATION_EXTENSION_COUNT = 5;
function getConstructionPriority(structureType, establishedExtensionCount) {
  if (structureType === STRUCTURE_SPAWN) return 1;
  if (structureType === STRUCTURE_EXTENSION && establishedExtensionCount < FOUNDATION_EXTENSION_COUNT) {
    return 2;
  }
  if (structureType === STRUCTURE_TOWER) return 3;
  if (structureType === STRUCTURE_CONTAINER) return 4;
  if (structureType === STRUCTURE_RAMPART || structureType === STRUCTURE_WALL) {
    return 5;
  }
  if (structureType === STRUCTURE_EXTENSION) return 6;
  if (structureType === STRUCTURE_STORAGE || structureType === STRUCTURE_LINK || structureType === STRUCTURE_TERMINAL) {
    return 7;
  }
  if (structureType === STRUCTURE_ROAD) return 8;
  return 9;
}

// src/hostileTargeting.ts
var HOSTILE_CORE_THREAT_RANGE = 3;
var HOSTILE_MELEE_DANGER_RANGE = 1;
var HOSTILE_RANGED_DANGER_RANGE = 3;
var CORE_STRUCTURE_TYPES = /* @__PURE__ */ new Set([
  STRUCTURE_SPAWN,
  STRUCTURE_STORAGE,
  STRUCTURE_TOWER,
  STRUCTURE_TERMINAL
]);
function isHostileCombatCreep(hostile) {
  return hostile.getActiveBodyparts(ATTACK) > 0 || hostile.getActiveBodyparts(RANGED_ATTACK) > 0 || hostile.getActiveBodyparts(HEAL) > 0;
}
function hasHostileCombatCreeps(room, hostiles = room.find(FIND_HOSTILE_CREEPS)) {
  return hostiles.some(isHostileCombatCreep);
}
function isRoomUnderUnsafeAttack(room, hostiles = room.find(FIND_HOSTILE_CREEPS)) {
  return hostiles.filter(isHostileCombatCreep).some((hostile) => !canTowersOverpowerHostile(room, hostile, hostiles));
}
function isPositionInHostileWeaponRange(position, hostiles = ((_b) => (_b = ((_a) => (_a = Game.rooms[position.roomName]) == null ? void 0 : _a.find(FIND_HOSTILE_CREEPS))()) != null ? _b : [])()) {
  return hostiles.some(
    (hostile) => hostile.getActiveBodyparts(ATTACK) > 0 && hostile.pos.inRangeTo(position, HOSTILE_MELEE_DANGER_RANGE) || hostile.getActiveBodyparts(RANGED_ATTACK) > 0 && hostile.pos.inRangeTo(position, HOSTILE_RANGED_DANGER_RANGE)
  );
}
function getHostilePriority(hostile) {
  if (hostile.getActiveBodyparts(HEAL) > 0) {
    return 0;
  }
  if (hostile.getActiveBodyparts(ATTACK) > 0 || hostile.getActiveBodyparts(RANGED_ATTACK) > 0) {
    return 1;
  }
  return 2;
}
function findPriorityHostile(room, origin) {
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  if (hostiles.length === 0) {
    return null;
  }
  return hostiles.sort((a, b) => {
    const priorityDifference = getHostilePriority(a) - getHostilePriority(b);
    if (priorityDifference !== 0) {
      return priorityDifference;
    }
    const hitsDifference = a.hits - b.hits;
    if (hitsDifference !== 0) {
      return hitsDifference;
    }
    return origin.getRangeTo(a) - origin.getRangeTo(b);
  })[0];
}
function pickHostileTarget(hostiles) {
  var _a;
  return (_a = [...hostiles].sort((left, right) => {
    const priorityDifference = getHostilePriority(left) - getHostilePriority(right);
    return priorityDifference !== 0 ? priorityDifference : left.hits - right.hits;
  })[0]) != null ? _a : null;
}
function canTowersOverpowerHostile(room, hostile, hostiles = room.find(FIND_HOSTILE_CREEPS)) {
  const towerDamage = getTowerDamageAtPosition(room, hostile.pos);
  const incomingHealing = getIncomingHostileHealing(hostile, hostiles);
  return towerDamage > incomingHealing;
}
function shouldTowersFireAtHostile(room, hostile, hostiles = room.find(FIND_HOSTILE_CREEPS), additionalDamage = 0) {
  const towerDamage = getTowerDamageAtPosition(room, hostile.pos);
  if (towerDamage === 0) {
    return false;
  }
  const incomingHealing = getIncomingHostileHealing(hostile, hostiles);
  const totalDamage = towerDamage + additionalDamage;
  if (totalDamage >= hostile.hits + incomingHealing) {
    return true;
  }
  if (totalDamage > incomingHealing) {
    return true;
  }
  return false;
}
function findDefenderAttack(room, hostiles = room.find(FIND_HOSTILE_CREEPS)) {
  var _a, _b;
  const defenders = room.find(FIND_MY_CREEPS).filter((creep) => creep.getActiveBodyparts(RANGED_ATTACK) > 0);
  const attacks = /* @__PURE__ */ new Map();
  for (const defender of defenders) {
    const target2 = pickHostileTarget(
      hostiles.filter((hostile) => defender.pos.inRangeTo(hostile, 3))
    );
    if (!target2) {
      continue;
    }
    const current = attacks.get(target2.id);
    const damage = getEffectiveRangedAttackPower(defender);
    attacks.set(target2.id, {
      target: target2,
      damage: ((_a = current == null ? void 0 : current.damage) != null ? _a : 0) + damage
    });
  }
  const target = pickHostileTarget(
    [...attacks.values()].map((attack) => attack.target)
  );
  return target ? (_b = attacks.get(target.id)) != null ? _b : null : null;
}
function isHostileBreachingRampart(hostile) {
  return hostile.pos.findInRange(FIND_MY_STRUCTURES, 1, {
    filter: (structure) => structure.structureType === STRUCTURE_RAMPART
  }).length > 0;
}
function isHostileNearCriticalStructure(hostile) {
  return hostile.pos.findInRange(FIND_MY_STRUCTURES, HOSTILE_CORE_THREAT_RANGE, {
    filter: (structure) => CORE_STRUCTURE_TYPES.has(structure.structureType)
  }).length > 0;
}
function isHostileThreateningCore(hostile) {
  return isHostileBreachingRampart(hostile) || isHostileNearCriticalStructure(hostile);
}
function getTowerDamageAtPosition(room, position) {
  const towers = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_TOWER && structure.store[RESOURCE_ENERGY] >= TOWER_ENERGY_COST
  });
  return towers.reduce(
    (total, tower) => total + getTowerDamageAtRange(tower.pos.getRangeTo(position)),
    0
  );
}
function getTowerDamageAtRange(range) {
  if (range <= TOWER_OPTIMAL_RANGE) {
    return TOWER_POWER_ATTACK;
  }
  if (range >= TOWER_FALLOFF_RANGE) {
    return Math.floor(TOWER_POWER_ATTACK * (1 - TOWER_FALLOFF));
  }
  const falloff = TOWER_FALLOFF * ((range - TOWER_OPTIMAL_RANGE) / (TOWER_FALLOFF_RANGE - TOWER_OPTIMAL_RANGE));
  return Math.floor(TOWER_POWER_ATTACK * (1 - falloff));
}
function getEffectiveHealPower(creep, action) {
  const basePower = action === "heal" ? HEAL_POWER : RANGED_HEAL_POWER;
  return creep.body.reduce((total, part) => {
    var _a, _b;
    if (part.type !== HEAL || part.hits <= 0) {
      return total;
    }
    const multiplier = part.boost ? (_b = (_a = BOOSTS[HEAL][part.boost]) == null ? void 0 : _a[action]) != null ? _b : 1 : 1;
    return total + basePower * multiplier;
  }, 0);
}
function getEffectiveRangedAttackPower(creep) {
  return creep.body.reduce((total, part) => {
    var _a, _b;
    if (part.type !== RANGED_ATTACK || part.hits <= 0) {
      return total;
    }
    const multiplier = part.boost ? (_b = (_a = BOOSTS[RANGED_ATTACK][part.boost]) == null ? void 0 : _a.rangedAttack) != null ? _b : 1 : 1;
    return total + RANGED_ATTACK_POWER * multiplier;
  }, 0);
}
function getIncomingHostileHealing(hostile, hostiles) {
  return hostiles.reduce((total, healer) => {
    if (healer.pos.isNearTo(hostile)) {
      return total + getEffectiveHealPower(healer, "heal");
    }
    if (healer.pos.inRangeTo(hostile, 3)) {
      return total + getEffectiveHealPower(healer, "rangedHeal");
    }
    return total;
  }, 0);
}

// src/repairPolicy.ts
var REPAIR_DANGER_RANGE = 5;
var CRITICAL_INFRASTRUCTURE_DAMAGE_RATIO = 0.5;
var MAINTENANCE_INFRASTRUCTURE_DAMAGE_RATIO = 0.9;
var DEFENSE_TARGET_HITS = 1e4;
var DEFENSE_MAINTENANCE_TARGET_HITS = 1e5;
var DEFENSE_UPGRADE_TARGET_HITS = 5e5;
var DEFENSE_FORTIFICATION_TARGET_HITS = 2e6;
var BUILDER_FRESH_DEFENSE_RANGE = 3;
var REPAIR_PRIORITY_WEIGHT = 50;
var repairCacheByRoom = /* @__PURE__ */ new Map();
function isRepairTarget(structure) {
  return structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER || structure.structureType === STRUCTURE_RAMPART || structure.structureType === STRUCTURE_WALL;
}
function isInfrastructureTarget(structure) {
  return structure.structureType === STRUCTURE_ROAD || structure.structureType === STRUCTURE_CONTAINER;
}
function isDefenseTarget(structure) {
  return structure.structureType === STRUCTURE_RAMPART || structure.structureType === STRUCTURE_WALL;
}
function getRepairPriority(target) {
  if (isInfrastructureTarget(target) && target.hits / target.hitsMax < CRITICAL_INFRASTRUCTURE_DAMAGE_RATIO) {
    return 1;
  }
  if (isDefenseTarget(target) && target.hits < DEFENSE_TARGET_HITS) {
    return 2;
  }
  if (isInfrastructureTarget(target) && target.hits / target.hitsMax < MAINTENANCE_INFRASTRUCTURE_DAMAGE_RATIO) {
    return 3;
  }
  if (isDefenseTarget(target) && target.hits < DEFENSE_MAINTENANCE_TARGET_HITS) {
    return 4;
  }
  if (isDefenseTarget(target) && target.hits < DEFENSE_UPGRADE_TARGET_HITS) {
    return 5;
  }
  if (isInfrastructureTarget(target) && target.hits < target.hitsMax) {
    return 6;
  }
  if (isDefenseTarget(target) && target.hits < DEFENSE_FORTIFICATION_TARGET_HITS) {
    return 7;
  }
  return Infinity;
}
function getRepairScore(target) {
  if (isDefenseTarget(target)) {
    const targetHits = target.hits < DEFENSE_TARGET_HITS ? DEFENSE_TARGET_HITS : target.hits < DEFENSE_MAINTENANCE_TARGET_HITS ? DEFENSE_MAINTENANCE_TARGET_HITS : target.hits < DEFENSE_UPGRADE_TARGET_HITS ? DEFENSE_UPGRADE_TARGET_HITS : DEFENSE_FORTIFICATION_TARGET_HITS;
    return target.hits / targetHits;
  }
  return target.hits / target.hitsMax;
}
function isBetterRepairTarget(target, currentBest) {
  if (!currentBest) {
    return true;
  }
  const targetPriority = getRepairPriority(target);
  const currentPriority = getRepairPriority(currentBest);
  if (targetPriority < currentPriority) {
    return true;
  }
  return targetPriority === currentPriority && getRepairScore(target) < getRepairScore(currentBest);
}
function getCreepRepairScore(creep, target) {
  return getRepairPriority(target) * REPAIR_PRIORITY_WEIGHT + creep.pos.getRangeTo(target);
}
function isBetterRepairTargetForCreep(creep, target, currentBest) {
  if (!currentBest) {
    return getCreepRepairScore(creep, target) !== Infinity;
  }
  const targetScore = getCreepRepairScore(creep, target);
  const currentScore = getCreepRepairScore(creep, currentBest);
  if (targetScore < currentScore) {
    return true;
  }
  return targetScore === currentScore && getRepairScore(target) < getRepairScore(currentBest);
}
function getCombatHostiles(room) {
  return getRoomRepairCache(room).combatHostiles;
}
function isContestedBy(target, combatHostiles) {
  return combatHostiles.some(
    (hostile) => hostile.pos.inRangeTo(target, REPAIR_DANGER_RANGE)
  );
}
function isRepairTargetContested(target, room) {
  return isContestedBy(target, getCombatHostiles(room));
}
function getRoomRepairCache(room) {
  const cached = repairCacheByRoom.get(room.name);
  if ((cached == null ? void 0 : cached.tick) === Game.time) {
    return cached;
  }
  const combatHostiles = room.find(FIND_HOSTILE_CREEPS, {
    filter: isHostileCombatCreep
  });
  const targets = room.find(FIND_STRUCTURES, {
    filter: (structure) => isRepairTarget(structure) && getRepairPriority(structure) !== Infinity && !isContestedBy(structure, combatHostiles)
  });
  const cache = { tick: Game.time, combatHostiles, targets };
  repairCacheByRoom.set(room.name, cache);
  return cache;
}
function findBestRepairTarget(room) {
  return getRoomRepairCache(room).targets.reduce(
    (bestTarget, target) => {
      if (isBetterRepairTarget(target, bestTarget)) {
        return target;
      }
      return bestTarget;
    },
    null
  );
}
function findBestRepairTargetForCreep(creep) {
  return getRoomRepairCache(creep.room).targets.reduce(
    (bestTarget, target) => {
      if (isBetterRepairTargetForCreep(creep, target, bestTarget)) {
        return target;
      }
      return bestTarget;
    },
    null
  );
}
function findFreshDefenseForCreep(creep) {
  return getRoomRepairCache(creep.room).targets.reduce(
    (bestTarget, target) => {
      const targetRange = creep.pos.getRangeTo(target);
      if (!isDefenseTarget(target) || target.hits >= DEFENSE_TARGET_HITS || targetRange > BUILDER_FRESH_DEFENSE_RANGE) {
        return bestTarget;
      }
      if (!bestTarget || target.hits < bestTarget.hits || target.hits === bestTarget.hits && targetRange < creep.pos.getRangeTo(bestTarget)) {
        return target;
      }
      return bestTarget;
    },
    null
  );
}
function hasRepairWork(room) {
  return findBestRepairTarget(room) !== null;
}
function getDesiredRepairerCount(room) {
  const target = findBestRepairTarget(room);
  if (!target) return 0;
  const priority = getRepairPriority(target);
  if (priority === 1) return 2;
  if (priority < 5) return 1;
  const hasFortificationWork = getRoomRepairCache(room).targets.some(
    (repairTarget) => isDefenseTarget(repairTarget) && repairTarget.hits < DEFENSE_FORTIFICATION_TARGET_HITS
  );
  return hasFortificationWork ? 1 : 0;
}

// src/roles/support/defense.ts
var BLOCKING_STRUCTURE_TYPES = /* @__PURE__ */ new Set([
  STRUCTURE_SPAWN,
  STRUCTURE_EXTENSION,
  STRUCTURE_LINK,
  STRUCTURE_STORAGE,
  STRUCTURE_TOWER,
  STRUCTURE_OBSERVER,
  STRUCTURE_POWER_SPAWN,
  STRUCTURE_LAB,
  STRUCTURE_TERMINAL,
  STRUCTURE_NUKER,
  STRUCTURE_FACTORY,
  STRUCTURE_WALL
]);
function isStandableRampart(rampart) {
  return !rampart.pos.lookFor(LOOK_STRUCTURES).some((structure) => BLOCKING_STRUCTURE_TYPES.has(structure.structureType));
}

// src/types.ts
var CREEP_ROLE = {
  PIONEER: "pioneer",
  CLAIMER: "claimer",
  SETTLER: "settler",
  HARVESTER: "harvester",
  CARRIER: "carrier",
  RANGED_DEFENDER: "rangedDefender",
  UPGRADER: "upgrader",
  BUILDER: "builder",
  REPAIRER: "repairer",
  LAB_TECH: "labTech",
  SAFE_MODE_GENERATOR: "safeModeGenerator"
};
var SPAWN_HOLD = "hold";

// src/managers/defenseAssignmentManager.ts
var MATERIAL_TARGET_MOVE = 3;
var PLAN_REFRESH_INTERVAL = 7;
var SAFETY_FRONTIER_RANGE = 4;
var defenseAssignmentManager = {
  manage() {
    for (const roomName in Game.rooms) {
      this.manageRoom(Game.rooms[roomName]);
    }
  },
  manageRoom(room) {
    var _a, _b;
    if (!((_a = room.controller) == null ? void 0 : _a.my)) {
      return;
    }
    const origin = (_b = room.find(FIND_MY_SPAWNS)[0]) == null ? void 0 : _b.pos;
    const hostile = origin ? findPriorityHostile(room, origin) : null;
    const defenders = origin ? room.find(FIND_MY_CREEPS, {
      filter: (creep) => creep.memory.role === CREEP_ROLE.RANGED_DEFENDER
    }) : [];
    if (!origin || !hostile || defenders.length === 0) {
      delete room.memory.defensePlan;
      return;
    }
    if (room.memory.defensePlan && isDefensePlanValid(room, room.memory.defensePlan, hostile, defenders)) {
      return;
    }
    room.memory.defensePlan = buildDefensePlan(
      room,
      origin,
      hostile,
      defenders
    );
  }
};
function getDefenseAssignment(creep) {
  var _a;
  const assignment = (_a = creep.room.memory.defensePlan) == null ? void 0 : _a.assignments[creep.name];
  if (!assignment) {
    return null;
  }
  return new RoomPosition(assignment.x, assignment.y, creep.room.name);
}
function buildDefensePlan(room, origin, hostile, defenders) {
  const target = new RoomPosition(hostile.pos.x, hostile.pos.y, room.name);
  const pathRamparts = collectPathRamparts(room, origin, target);
  const used = /* @__PURE__ */ new Set();
  const assignments = {};
  for (const defender of [...defenders].sort(
    (left, right) => left.name.localeCompare(right.name)
  )) {
    const spot = assignDefender(
      room,
      origin,
      target,
      pathRamparts,
      used,
      defender
    );
    if (spot) {
      assignments[defender.name] = { x: spot.x, y: spot.y };
      used.add(tileKey(spot.x, spot.y));
    }
  }
  return {
    targetId: hostile.id,
    targetX: hostile.pos.x,
    targetY: hostile.pos.y,
    updatedAt: Game.time,
    roster: defenders.map((defender) => defender.name).sort(),
    assignments
  };
}
function isDefensePlanValid(room, plan, hostile, defenders) {
  if (plan.targetId !== hostile.id) {
    return false;
  }
  if (Math.max(
    Math.abs(plan.targetX - hostile.pos.x),
    Math.abs(plan.targetY - hostile.pos.y)
  ) > MATERIAL_TARGET_MOVE) {
    return false;
  }
  if (Game.time - plan.updatedAt >= PLAN_REFRESH_INTERVAL) {
    return false;
  }
  const roster = defenders.map((defender) => defender.name).sort();
  if (!sameNames(roster, plan.roster)) {
    return false;
  }
  const target = new RoomPosition(hostile.pos.x, hostile.pos.y, room.name);
  for (const name in plan.assignments) {
    const assignment = plan.assignments[name];
    const position = new RoomPosition(assignment.x, assignment.y, room.name);
    if (!standableOwnedRampartAt(position)) {
      return false;
    }
    if (position.lookFor(LOOK_CREEPS).some((creep) => creep.name !== name)) {
      return false;
    }
    if (hostile.pos.inRangeTo(position, SAFETY_FRONTIER_RANGE) && !isRampartBacked(room, position, target)) {
      return false;
    }
  }
  return true;
}
function collectPathRamparts(room, origin, target) {
  const path = origin.findPathTo(target, { ignoreCreeps: true, maxRooms: 1 });
  const ramparts = [];
  for (let index = path.length - 1; index >= 1; index -= 1) {
    const position = new RoomPosition(path[index].x, path[index].y, room.name);
    if (!standableOwnedRampartAt(position)) {
      continue;
    }
    const backing = new RoomPosition(
      path[index - 1].x,
      path[index - 1].y,
      room.name
    );
    if (standableOwnedRampartAt(backing)) {
      ramparts.push(position);
    }
  }
  return ramparts;
}
function assignDefender(room, origin, target, pathRamparts, used, defender) {
  for (const rampart of pathRamparts) {
    if (isAvailable(rampart, used, defender)) {
      return rampart;
    }
    const adjacent = findFreeAdjacentBackedRampart(
      room,
      rampart,
      target,
      used,
      defender
    );
    if (adjacent) {
      return adjacent;
    }
  }
  return findFreeCoreRampart(room, origin, used, defender);
}
function findFreeAdjacentBackedRampart(room, center, target, used, defender) {
  const candidates = ownedStandableRamparts(room).filter(
    (rampart) => center.getRangeTo(rampart) === 1 && isAvailable(rampart.pos, used, defender) && isRampartBacked(room, rampart.pos, target)
  ).map((rampart) => rampart.pos);
  return closestToTarget(candidates, target);
}
function findFreeCoreRampart(room, origin, used, defender) {
  var _a;
  const candidates = ownedStandableRamparts(room).filter((rampart) => isAvailable(rampart.pos, used, defender)).map((rampart) => rampart.pos);
  return (_a = [...candidates].sort((left, right) => {
    const byOrigin = origin.getRangeTo(left) - origin.getRangeTo(right);
    if (byOrigin !== 0) {
      return byOrigin;
    }
    return compareTiles(left, right);
  })[0]) != null ? _a : null;
}
function isRampartBacked(room, position, target) {
  const ownRange = position.getRangeTo(target);
  return ownedStandableRamparts(room).some(
    (rampart) => position.getRangeTo(rampart) === 1 && rampart.pos.getRangeTo(target) >= ownRange
  );
}
function isAvailable(position, used, defender) {
  if (used.has(tileKey(position.x, position.y))) {
    return false;
  }
  return position.lookFor(LOOK_CREEPS).every((creep) => creep.name === defender.name);
}
function ownedStandableRamparts(room) {
  return room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_RAMPART && isStandableRampart(structure)
  });
}
function standableOwnedRampartAt(position) {
  var _a;
  return (_a = position.lookFor(LOOK_STRUCTURES).find(
    (structure) => structure.structureType === STRUCTURE_RAMPART && structure.my && isStandableRampart(structure)
  )) != null ? _a : null;
}
function closestToTarget(positions, target) {
  var _a;
  return (_a = [...positions].sort((left, right) => {
    const byTarget = left.getRangeTo(target) - right.getRangeTo(target);
    if (byTarget !== 0) {
      return byTarget;
    }
    return compareTiles(left, right);
  })[0]) != null ? _a : null;
}
function compareTiles(left, right) {
  return left.x - right.x || left.y - right.y;
}
function sameNames(left, right) {
  return left.length === right.length && left.every((name, index) => name === right[index]);
}
function tileKey(x, y) {
  return `${x}:${y}`;
}

// src/tacticalReservation.ts
function isHoldingDefenseAssignment(creep) {
  const assignment = getDefenseAssignment(creep);
  return assignment !== null && creep.pos.isEqualTo(assignment);
}
function canYieldPosition(creep) {
  return !isHoldingDefenseAssignment(creep) || !hasHostileCombatCreeps(creep.room);
}
function applyTacticalReservations(room, costs) {
  if (!room.memory.defensePlan || !hasHostileCombatCreeps(room)) {
    return;
  }
  for (const creep of room.find(FIND_MY_CREEPS)) {
    if (isHoldingDefenseAssignment(creep)) {
      costs.set(creep.pos.x, creep.pos.y, 255);
    }
  }
}

// src/extendCreep.ts
var SWAP_STUCK_THRESHOLD = 2;
var SWAP_REQUEST_TTL = 1;
var extensionCountCacheTick = -1;
var completedExtensionCountByRoom = /* @__PURE__ */ new Map();
function getCompletedExtensionCount(room) {
  if (extensionCountCacheTick !== Game.time) {
    completedExtensionCountByRoom.clear();
    extensionCountCacheTick = Game.time;
  }
  const cachedCount = completedExtensionCountByRoom.get(room.name);
  if (cachedCount !== void 0) {
    return cachedCount;
  }
  const count = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_EXTENSION
  }).length;
  completedExtensionCountByRoom.set(room.name, count);
  return count;
}
function toMoveToOpts(opts) {
  if (!opts) {
    return void 0;
  }
  const { requestSwap: _requestSwap, ...moveToOpts } = opts;
  return moveToOpts;
}
function getTargetPosition(target) {
  return target instanceof RoomPosition ? target : target.pos;
}
function shouldAvoidRoomEdges(creep, target) {
  return getTargetPosition(target).roomName === creep.room.name;
}
function withRoomEdgeAvoidance(creep, target, opts) {
  const moveToOpts = toMoveToOpts(opts);
  if (!shouldAvoidRoomEdges(creep, target)) {
    return moveToOpts != null ? moveToOpts : {};
  }
  const existingCostCallback = opts == null ? void 0 : opts.costCallback;
  return {
    ignoreCreeps: true,
    ...moveToOpts,
    maxRooms: 1,
    costCallback(roomName, matrix) {
      var _a;
      const costs = (_a = existingCostCallback == null ? void 0 : existingCostCallback(roomName, matrix)) != null ? _a : matrix;
      if (roomName !== creep.room.name) {
        return costs;
      }
      for (let coord = 0; coord < 50; coord += 1) {
        costs.set(coord, 0, 255);
        costs.set(coord, 49, 255);
        costs.set(0, coord, 255);
        costs.set(49, coord, 255);
      }
      applyTacticalReservations(creep.room, costs);
      return costs;
    }
  };
}
function positionMatches(pos, x, y, roomName) {
  return pos.x === x && pos.y === y && pos.roomName === roomName;
}
function updateMoveStuckCount(creep) {
  var _a, _b;
  if (creep.memory.moveLastTick === Game.time) {
    return (_a = creep.memory.moveStuckCount) != null ? _a : 0;
  }
  const stayedInPlace = creep.memory.moveLastTick === Game.time - 1 && positionMatches(
    creep.pos,
    creep.memory.moveLastX,
    creep.memory.moveLastY,
    creep.memory.moveLastRoomName
  );
  creep.memory.moveStuckCount = stayedInPlace ? ((_b = creep.memory.moveStuckCount) != null ? _b : 0) + 1 : 0;
  creep.memory.moveLastX = creep.pos.x;
  creep.memory.moveLastY = creep.pos.y;
  creep.memory.moveLastRoomName = creep.pos.roomName;
  creep.memory.moveLastTick = Game.time;
  return creep.memory.moveStuckCount;
}
function findNextStep(creep, target, opts) {
  const targetPos = getTargetPosition(target);
  if (targetPos.roomName !== creep.room.name) {
    return null;
  }
  const path = creep.pos.findPathTo(
    targetPos,
    withRoomEdgeAvoidance(creep, target, opts)
  );
  const nextStep = path[0];
  if (!nextStep) {
    return null;
  }
  return new RoomPosition(nextStep.x, nextStep.y, creep.room.name);
}
function swappedWithLastTick(creep, otherCreep) {
  return creep.memory.lastSwapCreepName === otherCreep.name && creep.memory.lastSwapTick === Game.time - 1;
}
function rememberSwap(creep, otherCreep) {
  creep.memory.lastSwapCreepName = otherCreep.name;
  creep.memory.lastSwapTick = Game.time;
}
function requestSwapWithBlockingCreep(creep, target, opts) {
  if (creep.fatigue > 0 || updateMoveStuckCount(creep) < SWAP_STUCK_THRESHOLD) {
    return;
  }
  const nextStep = findNextStep(creep, target, opts);
  if (!nextStep || !creep.pos.isNearTo(nextStep)) {
    return;
  }
  const blocker = nextStep.lookFor(LOOK_CREEPS).find(
    (blockingCreep) => blockingCreep.my && blockingCreep.name !== creep.name && blockingCreep.fatigue === 0 && canYieldPosition(blockingCreep)
  );
  if (!blocker) {
    return;
  }
  blocker.memory.swapRequest = {
    requesterName: creep.name,
    requesterX: creep.pos.x,
    requesterY: creep.pos.y,
    requesterRoomName: creep.pos.roomName,
    tick: Game.time
  };
}
function isDroppedEnergy(target) {
  return "amount" in target;
}
function getRefillEnergyAmount(target) {
  if (isDroppedEnergy(target)) {
    return target.resourceType === RESOURCE_ENERGY ? target.amount : 0;
  }
  return target.store[RESOURCE_ENERGY];
}
function hasRefillEnergy(target) {
  return getRefillEnergyAmount(target) > 0;
}
function getReservedEnergyCapacity(creep, target) {
  return Object.values(Game.creeps).filter(
    (otherCreep) => otherCreep.name !== creep.name && otherCreep.memory.energyTargetId === target.id
  ).reduce(
    (total, otherCreep) => total + otherCreep.store.getFreeCapacity(RESOURCE_ENERGY),
    0
  );
}
function isEnergyTargetReservedByOtherCreep(creep, target) {
  return getReservedEnergyCapacity(creep, target) >= getRefillEnergyAmount(target);
}
function findAdjacentSourceContainer(source) {
  var _a;
  const containers = source.pos.findInRange(FIND_STRUCTURES, 1, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER
  });
  return (_a = containers[0]) != null ? _a : null;
}
function isRoomEdge(pos) {
  return pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49;
}
function isRoadPosition(pos) {
  return pos.lookFor(LOOK_STRUCTURES).some((structure) => structure.structureType === STRUCTURE_ROAD);
}
function isBlockingStructure(structure) {
  return structure.structureType !== STRUCTURE_ROAD && structure.structureType !== STRUCTURE_CONTAINER && structure.structureType !== STRUCTURE_RAMPART;
}
function isSafeNonRoadPosition(creep, pos) {
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
  return !structures.some(
    (structure) => structure.structureType === STRUCTURE_ROAD
  ) && !structures.some(isBlockingStructure);
}
function getPositionsInRange(pos, range) {
  const positions = [];
  for (let x = Math.max(1, pos.x - range); x <= Math.min(48, pos.x + range); x += 1) {
    for (let y = Math.max(1, pos.y - range); y <= Math.min(48, pos.y + range); y += 1) {
      const candidate = new RoomPosition(x, y, pos.roomName);
      if (candidate.inRangeTo(pos, range)) {
        positions.push(candidate);
      }
    }
  }
  return positions;
}
function findSafeNonRoadPositionInRange(creep, pos, range) {
  const candidates = getPositionsInRange(pos, range).filter(
    (candidate) => isSafeNonRoadPosition(creep, candidate)
  );
  return creep.pos.findClosestByPath(candidates);
}
function moveToNonRoadWorkPosition(creep, target, range, opts) {
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
function extendCreep() {
  Creep.prototype.needsEnergy = function() {
    return this.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
  };
  Creep.prototype.hasFullEnergy = function() {
    return this.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
  };
  Creep.prototype.hasEnergy = function() {
    return this.store[RESOURCE_ENERGY] > 0;
  };
  Creep.prototype.moveToAvoidingRoomEdges = function(target, opts) {
    if ((opts == null ? void 0 : opts.requestSwap) !== false) {
      requestSwapWithBlockingCreep(this, target, opts);
    }
    return this.moveTo(target, withRoomEdgeAvoidance(this, target, opts));
  };
  Creep.prototype.handleSwapRequest = function() {
    const request = this.memory.swapRequest;
    delete this.memory.swapRequest;
    if (!request || Game.time - request.tick > SWAP_REQUEST_TTL) {
      return false;
    }
    if (!canYieldPosition(this)) {
      return false;
    }
    const requester = Game.creeps[request.requesterName];
    if (!requester || this.fatigue > 0 || requester.fatigue > 0 || !positionMatches(
      requester.pos,
      request.requesterX,
      request.requesterY,
      request.requesterRoomName
    ) || this.pos.roomName !== requester.pos.roomName || !this.pos.isNearTo(requester) || swappedWithLastTick(this, requester) || swappedWithLastTick(requester, this)) {
      return false;
    }
    if (this.move(this.pos.getDirectionTo(requester)) !== OK) {
      return false;
    }
    rememberSwap(this, requester);
    rememberSwap(requester, this);
    return true;
  };
  Creep.prototype.moveOffRoad = function() {
    if (!isRoadPosition(this.pos)) {
      return false;
    }
    const parkingPosition = findSafeNonRoadPositionInRange(this, this.pos, 5);
    if (!parkingPosition) {
      return false;
    }
    this.moveToAvoidingRoomEdges(parkingPosition, {
      visualizePathStyle: { stroke: "#888888" }
    });
    return true;
  };
  Creep.prototype.moveToWorkTarget = function(target, actionResult, range = 3, opts) {
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
  Creep.prototype.isAtFlag = function(flagName, range = 1) {
    const flag = Game.flags[flagName];
    if (!flag) {
      return false;
    }
    return this.pos.inRangeTo(flag.pos, range);
  };
  Creep.prototype.goToSource = function() {
    const source = this.pos.findClosestByPath(FIND_SOURCES);
    if (source) {
      if (this.harvest(source) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(source, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
    }
  };
  Creep.prototype.transferEnergyTo = function(target) {
    if (target) {
      if (this.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(target, {
          visualizePathStyle: { stroke: "#ffffff" }
        });
      }
    }
  };
  Creep.prototype.withdrawEnergyFrom = function(target) {
    if (target) {
      if (this.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(target, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
    }
  };
  Creep.prototype.pickUpEnergy = function(target) {
    if (target) {
      if (this.pickup(target) === ERR_NOT_IN_RANGE) {
        this.moveToAvoidingRoomEdges(target, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
      }
    }
  };
  Creep.prototype.clearEnergyTarget = function() {
    delete this.memory.energyTargetId;
  };
  Creep.prototype.findEnergyRefillTarget = function() {
    var _a;
    if (this.memory.energyTargetId) {
      const savedTarget = Game.getObjectById(this.memory.energyTargetId);
      if (savedTarget && hasRefillEnergy(savedTarget) && !isPositionInHostileWeaponRange(savedTarget.pos) && !isEnergyTargetReservedByOtherCreep(this, savedTarget)) {
        return savedTarget;
      }
      this.clearEnergyTarget();
    }
    const target = (_a = this.findDecayingEnergy()) != null ? _a : this.findEnergyContainer();
    if (target) {
      this.memory.energyTargetId = target.id;
    }
    return target;
  };
  Creep.prototype.goUpgradeController = function() {
    const controller = this.room.controller;
    if (!controller) {
      this.moveOffRoad();
      return;
    }
    this.moveToWorkTarget(controller, this.upgradeController(controller), 3, {
      visualizePathStyle: { stroke: "#ffffff" }
    });
  };
  Creep.prototype.findRepairTarget = function() {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => isRepairTarget(structure) && getRepairPriority(structure) !== Infinity
    });
  };
  Creep.prototype.findAndRepair = function() {
    const target = this.findRepairTarget();
    if (target) {
      this.moveToWorkTarget(target, this.repair(target), 3, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
      return true;
    }
    return false;
  };
  Creep.prototype.findBuildTarget = function() {
    const sites = this.room.find(FIND_MY_CONSTRUCTION_SITES, {
      filter: (site) => !isPositionInHostileWeaponRange(site.pos)
    });
    const completedExtensionCount = getCompletedExtensionCount(this.room);
    const highestPriority = sites.reduce(
      (priority, site) => Math.min(
        priority,
        getConstructionPriority(site.structureType, completedExtensionCount)
      ),
      Infinity
    );
    return this.pos.findClosestByPath(
      sites.filter(
        (site) => getConstructionPriority(
          site.structureType,
          completedExtensionCount
        ) === highestPriority
      ),
      { ignoreCreeps: true }
    );
  };
  Creep.prototype.findAndBuild = function() {
    const target = this.findBuildTarget();
    if (target) {
      this.moveToWorkTarget(target, this.build(target), 3, {
        visualizePathStyle: { stroke: "#ffffff" }
      });
      return true;
    }
    return false;
  };
  Creep.prototype.goToFlag = function(flagName, range = 0, pathStyle = { stroke: "#ffffff" }) {
    const flag = Game.flags[flagName];
    if (flag) {
      if (!this.pos.inRangeTo(flag.pos, range)) {
        this.moveToAvoidingRoomEdges(flag, { visualizePathStyle: pathStyle });
      }
    } else {
      this.say(`No flag: ${flagName}`);
    }
  };
  Creep.prototype.findDroppedEnergy = function() {
    return this.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
      filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 0 && !isPositionInHostileWeaponRange(resource.pos) && !isEnergyTargetReservedByOtherCreep(
        this,
        resource
      )
    });
  };
  Creep.prototype.findDecayingEnergy = function() {
    const droppedEnergy = this.room.find(FIND_DROPPED_RESOURCES, {
      filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 0 && !isPositionInHostileWeaponRange(resource.pos) && !isEnergyTargetReservedByOtherCreep(
        this,
        resource
      )
    });
    const ruins = this.room.find(FIND_RUINS, {
      filter: (target) => target.store[RESOURCE_ENERGY] > 0 && !isPositionInHostileWeaponRange(target.pos) && !isEnergyTargetReservedByOtherCreep(this, target)
    });
    const tombstones = this.room.find(FIND_TOMBSTONES, {
      filter: (target) => target.store[RESOURCE_ENERGY] > 0 && !isPositionInHostileWeaponRange(target.pos) && !isEnergyTargetReservedByOtherCreep(this, target)
    });
    return this.pos.findClosestByPath([
      ...droppedEnergy,
      ...ruins,
      ...tombstones
    ]);
  };
  Creep.prototype.findAdjacentSourceContainer = findAdjacentSourceContainer;
  Creep.prototype.findEnergyContainer = function() {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.store[RESOURCE_ENERGY] > 0 && !isPositionInHostileWeaponRange(structure.pos) && !isEnergyTargetReservedByOtherCreep(this, structure)
    });
  };
  Creep.prototype.findWithdrawableEnergy = function() {
    const container = this.findEnergyContainer();
    const ruin = this.pos.findClosestByPath(FIND_RUINS, {
      filter: (target) => target.store[RESOURCE_ENERGY] > 0 && !isPositionInHostileWeaponRange(target.pos) && !isEnergyTargetReservedByOtherCreep(this, target)
    });
    const tombstone = this.pos.findClosestByPath(FIND_TOMBSTONES, {
      filter: (target) => target.store[RESOURCE_ENERGY] > 0 && !isPositionInHostileWeaponRange(target.pos) && !isEnergyTargetReservedByOtherCreep(this, target)
    });
    const targets = [container, ruin, tombstone].filter(
      (target) => !!target
    );
    return this.pos.findClosestByPath(targets);
  };
  Creep.prototype.findControllerContainer = function() {
    var _a;
    const controller = this.room.controller;
    if (!controller) {
      return null;
    }
    const containers = controller.pos.findInRange(FIND_STRUCTURES, 3, {
      filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    return (_a = containers[0]) != null ? _a : null;
  };
  Creep.prototype.findRefuelStructure = function() {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
      filter: (structure) => (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) && structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
  };
}

// src/buildPlans.ts
var DEFAULT_BUILD_PLANS = {
  E58S28: {
    plan: [
      {
        x: 47,
        y: 48,
        structureType: STRUCTURE_SPAWN,
        purpose: "primarySpawn"
      },
      { x: 48, y: 41, structureType: STRUCTURE_EXTENSION },
      { x: 48, y: 40, structureType: STRUCTURE_EXTENSION },
      { x: 47, y: 39, structureType: STRUCTURE_EXTENSION },
      { x: 44, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 44, y: 36, structureType: STRUCTURE_EXTENSION },
      {
        x: 32,
        y: 34,
        structureType: STRUCTURE_CONTAINER,
        purpose: "controllerDelivery"
      },
      { x: 29, y: 42, structureType: STRUCTURE_CONTAINER },
      { x: 45, y: 37, structureType: STRUCTURE_CONTAINER },
      { x: 30, y: 41, structureType: STRUCTURE_ROAD },
      { x: 29, y: 42, structureType: STRUCTURE_RAMPART },
      { x: 29, y: 43, structureType: STRUCTURE_RAMPART },
      { x: 28, y: 43, structureType: STRUCTURE_RAMPART },
      { x: 28, y: 42, structureType: STRUCTURE_RAMPART },
      { x: 43, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 35, structureType: STRUCTURE_EXTENSION },
      { x: 42, y: 35, structureType: STRUCTURE_EXTENSION },
      { x: 43, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 44, y: 29, structureType: STRUCTURE_RAMPART },
      { x: 44, y: 28, structureType: STRUCTURE_RAMPART },
      { x: 45, y: 28, structureType: STRUCTURE_RAMPART },
      { x: 31, y: 31, structureType: STRUCTURE_RAMPART },
      { x: 31, y: 30, structureType: STRUCTURE_RAMPART },
      { x: 30, y: 30, structureType: STRUCTURE_RAMPART },
      { x: 34, y: 31, structureType: STRUCTURE_TOWER },
      { x: 44, y: 46, structureType: STRUCTURE_ROAD },
      { x: 43, y: 47, structureType: STRUCTURE_ROAD },
      { x: 42, y: 46, structureType: STRUCTURE_ROAD },
      { x: 41, y: 45, structureType: STRUCTURE_ROAD },
      { x: 40, y: 44, structureType: STRUCTURE_ROAD },
      { x: 39, y: 43, structureType: STRUCTURE_ROAD },
      { x: 38, y: 42, structureType: STRUCTURE_ROAD },
      { x: 37, y: 42, structureType: STRUCTURE_ROAD },
      { x: 36, y: 42, structureType: STRUCTURE_ROAD },
      { x: 35, y: 42, structureType: STRUCTURE_ROAD },
      { x: 34, y: 42, structureType: STRUCTURE_ROAD },
      { x: 33, y: 41, structureType: STRUCTURE_ROAD },
      { x: 32, y: 40, structureType: STRUCTURE_ROAD },
      { x: 31, y: 40, structureType: STRUCTURE_ROAD },
      { x: 45, y: 46, structureType: STRUCTURE_ROAD },
      { x: 47, y: 47, structureType: STRUCTURE_ROAD },
      { x: 46, y: 46, structureType: STRUCTURE_ROAD },
      { x: 46, y: 39, structureType: STRUCTURE_ROAD },
      { x: 33, y: 35, structureType: STRUCTURE_ROAD },
      { x: 33, y: 36, structureType: STRUCTURE_ROAD },
      { x: 33, y: 37, structureType: STRUCTURE_ROAD },
      { x: 33, y: 38, structureType: STRUCTURE_ROAD },
      { x: 33, y: 39, structureType: STRUCTURE_ROAD },
      { x: 33, y: 34, structureType: STRUCTURE_ROAD },
      { x: 34, y: 33, structureType: STRUCTURE_ROAD },
      { x: 35, y: 32, structureType: STRUCTURE_ROAD },
      { x: 36, y: 32, structureType: STRUCTURE_ROAD },
      { x: 37, y: 33, structureType: STRUCTURE_ROAD },
      { x: 38, y: 34, structureType: STRUCTURE_ROAD },
      { x: 39, y: 35, structureType: STRUCTURE_ROAD },
      { x: 40, y: 36, structureType: STRUCTURE_ROAD },
      { x: 41, y: 37, structureType: STRUCTURE_ROAD },
      { x: 42, y: 37, structureType: STRUCTURE_ROAD },
      { x: 43, y: 37, structureType: STRUCTURE_ROAD },
      { x: 45, y: 38, structureType: STRUCTURE_ROAD },
      { x: 44, y: 38, structureType: STRUCTURE_ROAD },
      { x: 43, y: 35, structureType: STRUCTURE_ROAD },
      { x: 42, y: 36, structureType: STRUCTURE_ROAD },
      { x: 47, y: 40, structureType: STRUCTURE_ROAD },
      { x: 47, y: 41, structureType: STRUCTURE_ROAD },
      { x: 47, y: 42, structureType: STRUCTURE_ROAD },
      { x: 47, y: 43, structureType: STRUCTURE_ROAD },
      { x: 47, y: 44, structureType: STRUCTURE_ROAD },
      { x: 47, y: 45, structureType: STRUCTURE_ROAD },
      { x: 34, y: 37, structureType: STRUCTURE_ROAD },
      { x: 31, y: 40, structureType: STRUCTURE_RAMPART },
      { x: 32, y: 40, structureType: STRUCTURE_RAMPART },
      { x: 31, y: 39, structureType: STRUCTURE_RAMPART },
      { x: 45, y: 45, structureType: STRUCTURE_STORAGE },
      { x: 34, y: 31, structureType: STRUCTURE_RAMPART },
      { x: 34, y: 35, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 37, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 38, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 38, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 39, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 40, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 40, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 41, structureType: STRUCTURE_EXTENSION },
      { x: 4, y: 31, structureType: STRUCTURE_WALL },
      { x: 5, y: 31, structureType: STRUCTURE_RAMPART },
      { x: 6, y: 31, structureType: STRUCTURE_RAMPART },
      { x: 6, y: 30, structureType: STRUCTURE_RAMPART },
      { x: 5, y: 30, structureType: STRUCTURE_RAMPART },
      { x: 11, y: 28, structureType: STRUCTURE_RAMPART },
      { x: 12, y: 28, structureType: STRUCTURE_RAMPART },
      { x: 12, y: 29, structureType: STRUCTURE_RAMPART },
      { x: 11, y: 29, structureType: STRUCTURE_RAMPART },
      { x: 12, y: 27, structureType: STRUCTURE_RAMPART },
      { x: 12, y: 26, structureType: STRUCTURE_RAMPART },
      { x: 12, y: 19, structureType: STRUCTURE_RAMPART },
      { x: 13, y: 19, structureType: STRUCTURE_RAMPART },
      { x: 12, y: 20, structureType: STRUCTURE_RAMPART },
      { x: 6, y: 2, structureType: STRUCTURE_RAMPART },
      { x: 7, y: 2, structureType: STRUCTURE_RAMPART },
      { x: 31, y: 39, structureType: STRUCTURE_TOWER },
      { x: 32, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 37, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 38, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 39, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 41, structureType: STRUCTURE_EXTENSION },
      { x: 46, y: 38, structureType: STRUCTURE_EXTENSION },
      { x: 44, y: 37, structureType: STRUCTURE_EXTENSION },
      { x: 43, y: 38, structureType: STRUCTURE_EXTENSION },
      { x: 44, y: 39, structureType: STRUCTURE_EXTENSION },
      { x: 45, y: 39, structureType: STRUCTURE_EXTENSION },
      { x: 46, y: 47, structureType: STRUCTURE_EXTENSION },
      { x: 48, y: 47, structureType: STRUCTURE_EXTENSION },
      { x: 48, y: 46, structureType: STRUCTURE_EXTENSION },
      { x: 47, y: 46, structureType: STRUCTURE_EXTENSION },
      { x: 48, y: 45, structureType: STRUCTURE_EXTENSION },
      { x: 39, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 46, y: 45, structureType: STRUCTURE_TERMINAL },
      { x: 46, y: 44, structureType: STRUCTURE_EXTENSION },
      { x: 46, y: 43, structureType: STRUCTURE_EXTENSION },
      { x: 46, y: 42, structureType: STRUCTURE_EXTENSION },
      { x: 46, y: 41, structureType: STRUCTURE_EXTENSION },
      { x: 43, y: 47, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 47, structureType: STRUCTURE_RAMPART },
      { x: 46, y: 42, structureType: STRUCTURE_RAMPART },
      { x: 47, y: 42, structureType: STRUCTURE_RAMPART },
      { x: 47, y: 41, structureType: STRUCTURE_RAMPART },
      { x: 45, y: 37, structureType: STRUCTURE_RAMPART },
      { x: 32, y: 34, structureType: STRUCTURE_RAMPART },
      { x: 41, y: 47, structureType: STRUCTURE_ROAD },
      { x: 42, y: 47, structureType: STRUCTURE_LAB },
      { x: 42, y: 48, structureType: STRUCTURE_LAB },
      { x: 41, y: 48, structureType: STRUCTURE_LAB },
      { x: 28, y: 17, structureType: STRUCTURE_WALL },
      { x: 29, y: 17, structureType: STRUCTURE_WALL },
      { x: 29, y: 16, structureType: STRUCTURE_RAMPART },
      { x: 29, y: 15, structureType: STRUCTURE_RAMPART },
      { x: 28, y: 15, structureType: STRUCTURE_RAMPART },
      { x: 28, y: 16, structureType: STRUCTURE_RAMPART },
      { x: 36, y: 8, structureType: STRUCTURE_WALL },
      { x: 37, y: 8, structureType: STRUCTURE_WALL },
      { x: 39, y: 3, structureType: STRUCTURE_WALL },
      { x: 39, y: 4, structureType: STRUCTURE_WALL },
      { x: 39, y: 5, structureType: STRUCTURE_WALL },
      { x: 22, y: 39, structureType: STRUCTURE_WALL },
      { x: 23, y: 39, structureType: STRUCTURE_RAMPART },
      { x: 24, y: 39, structureType: STRUCTURE_RAMPART },
      { x: 24, y: 38, structureType: STRUCTURE_RAMPART },
      { x: 23, y: 38, structureType: STRUCTURE_RAMPART },
      { x: 20, y: 46, structureType: STRUCTURE_RAMPART },
      { x: 20, y: 45, structureType: STRUCTURE_RAMPART },
      { x: 20, y: 43, structureType: STRUCTURE_WALL },
      { x: 20, y: 44, structureType: STRUCTURE_WALL },
      { x: 20, y: 47, structureType: STRUCTURE_WALL },
      { x: 20, y: 48, structureType: STRUCTURE_WALL },
      { x: 21, y: 45, structureType: STRUCTURE_RAMPART },
      { x: 21, y: 46, structureType: STRUCTURE_RAMPART }
    ]
  },
  E58S29: {
    plan: [
      { x: 10, y: 41, structureType: STRUCTURE_CONTAINER },
      { x: 9, y: 42, structureType: STRUCTURE_SPAWN },
      {
        x: 44,
        y: 13,
        structureType: STRUCTURE_CONTAINER,
        purpose: "controllerDelivery"
      },
      { x: 11, y: 40, structureType: STRUCTURE_EXTENSION },
      { x: 9, y: 43, structureType: STRUCTURE_EXTENSION },
      { x: 9, y: 41, structureType: STRUCTURE_ROAD },
      { x: 10, y: 40, structureType: STRUCTURE_ROAD },
      { x: 8, y: 42, structureType: STRUCTURE_ROAD },
      { x: 7, y: 43, structureType: STRUCTURE_ROAD },
      { x: 7, y: 44, structureType: STRUCTURE_ROAD },
      { x: 8, y: 43, structureType: STRUCTURE_EXTENSION },
      { x: 8, y: 44, structureType: STRUCTURE_EXTENSION },
      { x: 8, y: 45, structureType: STRUCTURE_EXTENSION },
      { x: 8, y: 39, structureType: STRUCTURE_TOWER },
      { x: 9, y: 40, structureType: STRUCTURE_ROAD },
      { x: 10, y: 39, structureType: STRUCTURE_EXTENSION },
      { x: 9, y: 39, structureType: STRUCTURE_EXTENSION },
      { x: 8, y: 40, structureType: STRUCTURE_EXTENSION },
      { x: 8, y: 41, structureType: STRUCTURE_EXTENSION },
      { x: 7, y: 42, structureType: STRUCTURE_EXTENSION },
      { x: 11, y: 39, structureType: STRUCTURE_ROAD },
      { x: 12, y: 39, structureType: STRUCTURE_ROAD },
      { x: 13, y: 38, structureType: STRUCTURE_ROAD },
      { x: 14, y: 38, structureType: STRUCTURE_ROAD },
      { x: 15, y: 38, structureType: STRUCTURE_ROAD },
      { x: 16, y: 38, structureType: STRUCTURE_ROAD },
      { x: 17, y: 38, structureType: STRUCTURE_ROAD },
      { x: 18, y: 38, structureType: STRUCTURE_ROAD },
      { x: 19, y: 38, structureType: STRUCTURE_ROAD },
      { x: 20, y: 38, structureType: STRUCTURE_ROAD },
      { x: 21, y: 38, structureType: STRUCTURE_ROAD },
      { x: 22, y: 38, structureType: STRUCTURE_ROAD },
      { x: 23, y: 38, structureType: STRUCTURE_ROAD },
      { x: 24, y: 38, structureType: STRUCTURE_ROAD },
      { x: 25, y: 38, structureType: STRUCTURE_ROAD },
      { x: 26, y: 38, structureType: STRUCTURE_ROAD },
      { x: 27, y: 37, structureType: STRUCTURE_ROAD },
      { x: 28, y: 36, structureType: STRUCTURE_ROAD },
      { x: 29, y: 36, structureType: STRUCTURE_ROAD },
      { x: 30, y: 36, structureType: STRUCTURE_ROAD },
      { x: 31, y: 36, structureType: STRUCTURE_ROAD },
      { x: 32, y: 36, structureType: STRUCTURE_ROAD },
      { x: 33, y: 36, structureType: STRUCTURE_ROAD },
      { x: 34, y: 35, structureType: STRUCTURE_ROAD },
      { x: 35, y: 34, structureType: STRUCTURE_ROAD },
      { x: 36, y: 33, structureType: STRUCTURE_ROAD },
      { x: 37, y: 32, structureType: STRUCTURE_ROAD },
      { x: 38, y: 31, structureType: STRUCTURE_ROAD },
      { x: 38, y: 30, structureType: STRUCTURE_ROAD },
      { x: 38, y: 28, structureType: STRUCTURE_ROAD },
      { x: 38, y: 29, structureType: STRUCTURE_ROAD },
      { x: 38, y: 27, structureType: STRUCTURE_ROAD },
      { x: 37, y: 25, structureType: STRUCTURE_ROAD },
      { x: 37, y: 26, structureType: STRUCTURE_ROAD },
      { x: 38, y: 24, structureType: STRUCTURE_ROAD },
      { x: 39, y: 23, structureType: STRUCTURE_ROAD },
      { x: 39, y: 21, structureType: STRUCTURE_ROAD },
      { x: 39, y: 22, structureType: STRUCTURE_ROAD },
      { x: 39, y: 20, structureType: STRUCTURE_ROAD },
      { x: 39, y: 19, structureType: STRUCTURE_ROAD },
      { x: 39, y: 18, structureType: STRUCTURE_ROAD },
      { x: 39, y: 17, structureType: STRUCTURE_ROAD },
      { x: 39, y: 16, structureType: STRUCTURE_ROAD },
      { x: 39, y: 15, structureType: STRUCTURE_ROAD },
      { x: 40, y: 14, structureType: STRUCTURE_ROAD },
      { x: 41, y: 13, structureType: STRUCTURE_ROAD },
      { x: 42, y: 13, structureType: STRUCTURE_ROAD },
      { x: 43, y: 13, structureType: STRUCTURE_ROAD },
      { x: 2, y: 42, structureType: STRUCTURE_WALL },
      { x: 2, y: 41, structureType: STRUCTURE_RAMPART },
      { x: 3, y: 41, structureType: STRUCTURE_RAMPART },
      { x: 3, y: 40, structureType: STRUCTURE_RAMPART },
      { x: 2, y: 40, structureType: STRUCTURE_RAMPART },
      { x: 2, y: 39, structureType: STRUCTURE_WALL },
      { x: 2, y: 34, structureType: STRUCTURE_RAMPART },
      { x: 3, y: 34, structureType: STRUCTURE_RAMPART },
      { x: 3, y: 35, structureType: STRUCTURE_RAMPART },
      { x: 2, y: 35, structureType: STRUCTURE_RAMPART },
      { x: 2, y: 33, structureType: STRUCTURE_WALL },
      { x: 11, y: 32, structureType: STRUCTURE_WALL },
      { x: 12, y: 32, structureType: STRUCTURE_RAMPART },
      { x: 12, y: 33, structureType: STRUCTURE_RAMPART },
      { x: 13, y: 32, structureType: STRUCTURE_WALL },
      { x: 14, y: 38, structureType: STRUCTURE_RAMPART },
      { x: 14, y: 39, structureType: STRUCTURE_WALL },
      { x: 13, y: 38, structureType: STRUCTURE_RAMPART },
      { x: 14, y: 37, structureType: STRUCTURE_WALL },
      { x: 3, y: 44, structureType: STRUCTURE_WALL },
      { x: 3, y: 45, structureType: STRUCTURE_RAMPART },
      { x: 4, y: 45, structureType: STRUCTURE_RAMPART },
      { x: 4, y: 46, structureType: STRUCTURE_RAMPART },
      { x: 3, y: 46, structureType: STRUCTURE_RAMPART },
      { x: 28, y: 42, structureType: STRUCTURE_RAMPART },
      { x: 29, y: 42, structureType: STRUCTURE_RAMPART },
      { x: 30, y: 42, structureType: STRUCTURE_WALL },
      { x: 29, y: 41, structureType: STRUCTURE_RAMPART },
      { x: 28, y: 41, structureType: STRUCTURE_RAMPART },
      { x: 33, y: 40, structureType: STRUCTURE_WALL },
      { x: 34, y: 40, structureType: STRUCTURE_RAMPART },
      { x: 35, y: 40, structureType: STRUCTURE_RAMPART },
      { x: 35, y: 39, structureType: STRUCTURE_RAMPART },
      { x: 34, y: 39, structureType: STRUCTURE_RAMPART },
      { x: 46, y: 24, structureType: STRUCTURE_RAMPART },
      { x: 47, y: 24, structureType: STRUCTURE_RAMPART },
      { x: 47, y: 25, structureType: STRUCTURE_RAMPART },
      { x: 46, y: 25, structureType: STRUCTURE_RAMPART },
      { x: 45, y: 24, structureType: STRUCTURE_WALL },
      { x: 23, y: 6, structureType: STRUCTURE_WALL },
      { x: 23, y: 5, structureType: STRUCTURE_RAMPART },
      { x: 23, y: 4, structureType: STRUCTURE_RAMPART },
      { x: 22, y: 4, structureType: STRUCTURE_RAMPART },
      { x: 22, y: 5, structureType: STRUCTURE_RAMPART },
      { x: 19, y: 18, structureType: STRUCTURE_RAMPART },
      { x: 20, y: 18, structureType: STRUCTURE_RAMPART },
      { x: 20, y: 19, structureType: STRUCTURE_RAMPART },
      { x: 19, y: 19, structureType: STRUCTURE_RAMPART },
      { x: 9, y: 38, structureType: STRUCTURE_STORAGE },
      { x: 10, y: 38, structureType: STRUCTURE_ROAD },
      { x: 13, y: 39, structureType: STRUCTURE_EXTENSION },
      { x: 9, y: 37, structureType: STRUCTURE_EXTENSION },
      { x: 10, y: 37, structureType: STRUCTURE_ROAD },
      { x: 9, y: 36, structureType: STRUCTURE_ROAD },
      { x: 11, y: 36, structureType: STRUCTURE_ROAD },
      { x: 13, y: 37, structureType: STRUCTURE_EXTENSION },
      { x: 12, y: 38, structureType: STRUCTURE_EXTENSION },
      { x: 12, y: 37, structureType: STRUCTURE_EXTENSION },
      { x: 11, y: 37, structureType: STRUCTURE_EXTENSION },
      { x: 11, y: 38, structureType: STRUCTURE_EXTENSION },
      { x: 12, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 10, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 12, y: 35, structureType: STRUCTURE_EXTENSION },
      { x: 10, y: 35, structureType: STRUCTURE_TOWER },
      { x: 8, y: 35, structureType: STRUCTURE_ROAD },
      { x: 11, y: 34, structureType: STRUCTURE_ROAD },
      { x: 11, y: 35, structureType: STRUCTURE_ROAD },
      { x: 11, y: 33, structureType: STRUCTURE_ROAD },
      { x: 12, y: 32, structureType: STRUCTURE_ROAD },
      { x: 8, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 4, y: 35, structureType: STRUCTURE_ROAD },
      { x: 5, y: 35, structureType: STRUCTURE_ROAD },
      { x: 6, y: 35, structureType: STRUCTURE_ROAD },
      { x: 7, y: 35, structureType: STRUCTURE_ROAD },
      { x: 7, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 8, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 5, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 6, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 9, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 9, y: 35, structureType: STRUCTURE_EXTENSION },
      { x: 7, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 6, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 5, y: 36, structureType: STRUCTURE_EXTENSION },
      { x: 7, y: 45, structureType: STRUCTURE_TERMINAL },
      { x: 7, y: 41, structureType: STRUCTURE_ROAD },
      { x: 6, y: 40, structureType: STRUCTURE_ROAD },
      { x: 5, y: 40, structureType: STRUCTURE_ROAD },
      { x: 4, y: 40, structureType: STRUCTURE_ROAD },
      { x: 4, y: 39, structureType: STRUCTURE_LAB },
      { x: 5, y: 39, structureType: STRUCTURE_LAB },
      { x: 6, y: 39, structureType: STRUCTURE_LAB }
    ]
  },
  E59S28: {
    plan: [
      {
        x: 28,
        y: 21,
        structureType: STRUCTURE_SPAWN,
        purpose: "primarySpawn"
      },
      { x: 29, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 30, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 18, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 20, structureType: STRUCTURE_EXTENSION },
      {
        x: 38,
        y: 13,
        structureType: STRUCTURE_CONTAINER,
        purpose: "controllerDelivery"
      },
      { x: 39, y: 23, structureType: STRUCTURE_CONTAINER },
      { x: 29, y: 27, structureType: STRUCTURE_CONTAINER },
      { x: 34, y: 21, structureType: STRUCTURE_RAMPART },
      { x: 35, y: 21, structureType: STRUCTURE_RAMPART },
      { x: 35, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 36, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 37, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 38, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 38, y: 23, structureType: STRUCTURE_RAMPART },
      { x: 39, y: 23, structureType: STRUCTURE_RAMPART },
      { x: 35, y: 23, structureType: STRUCTURE_RAMPART },
      { x: 34, y: 23, structureType: STRUCTURE_RAMPART },
      { x: 34, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 33, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 33, y: 21, structureType: STRUCTURE_RAMPART },
      { x: 34, y: 24, structureType: STRUCTURE_ROAD },
      { x: 34, y: 23, structureType: STRUCTURE_ROAD },
      { x: 35, y: 23, structureType: STRUCTURE_ROAD },
      { x: 34, y: 25, structureType: STRUCTURE_ROAD },
      { x: 33, y: 26, structureType: STRUCTURE_ROAD },
      { x: 32, y: 27, structureType: STRUCTURE_ROAD },
      { x: 31, y: 27, structureType: STRUCTURE_ROAD },
      { x: 30, y: 27, structureType: STRUCTURE_ROAD },
      { x: 33, y: 22, structureType: STRUCTURE_ROAD },
      { x: 36, y: 22, structureType: STRUCTURE_ROAD },
      { x: 34, y: 21, structureType: STRUCTURE_ROAD },
      { x: 35, y: 21, structureType: STRUCTURE_ROAD },
      { x: 29, y: 23, structureType: STRUCTURE_TOWER },
      { x: 27, y: 20, structureType: STRUCTURE_EXTENSION },
      { x: 26, y: 21, structureType: STRUCTURE_EXTENSION },
      { x: 25, y: 22, structureType: STRUCTURE_EXTENSION },
      { x: 25, y: 23, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 20, structureType: STRUCTURE_EXTENSION },
      { x: 26, y: 22, structureType: STRUCTURE_ROAD },
      { x: 27, y: 22, structureType: STRUCTURE_ROAD },
      { x: 28, y: 22, structureType: STRUCTURE_ROAD },
      { x: 29, y: 22, structureType: STRUCTURE_ROAD },
      { x: 30, y: 22, structureType: STRUCTURE_ROAD },
      { x: 31, y: 22, structureType: STRUCTURE_ROAD },
      { x: 32, y: 22, structureType: STRUCTURE_ROAD },
      { x: 37, y: 22, structureType: STRUCTURE_ROAD },
      { x: 38, y: 23, structureType: STRUCTURE_ROAD },
      { x: 31, y: 19, structureType: STRUCTURE_ROAD },
      { x: 32, y: 20, structureType: STRUCTURE_ROAD },
      { x: 33, y: 21, structureType: STRUCTURE_ROAD },
      { x: 43, y: 9, structureType: STRUCTURE_RAMPART },
      { x: 43, y: 10, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 9, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 10, structureType: STRUCTURE_RAMPART },
      { x: 41, y: 10, structureType: STRUCTURE_WALL },
      { x: 36, y: 17, structureType: STRUCTURE_WALL },
      { x: 37, y: 17, structureType: STRUCTURE_WALL },
      { x: 38, y: 17, structureType: STRUCTURE_RAMPART },
      { x: 38, y: 16, structureType: STRUCTURE_RAMPART },
      { x: 37, y: 16, structureType: STRUCTURE_RAMPART },
      { x: 43, y: 30, structureType: STRUCTURE_RAMPART },
      { x: 43, y: 31, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 30, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 31, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 32, structureType: STRUCTURE_WALL },
      { x: 42, y: 35, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 36, structureType: STRUCTURE_RAMPART },
      { x: 41, y: 34, structureType: STRUCTURE_RAMPART },
      { x: 41, y: 35, structureType: STRUCTURE_RAMPART },
      { x: 41, y: 36, structureType: STRUCTURE_WALL },
      { x: 17, y: 12, structureType: STRUCTURE_RAMPART },
      { x: 18, y: 12, structureType: STRUCTURE_RAMPART },
      { x: 18, y: 13, structureType: STRUCTURE_RAMPART },
      { x: 17, y: 13, structureType: STRUCTURE_RAMPART },
      { x: 16, y: 14, structureType: STRUCTURE_WALL },
      { x: 17, y: 14, structureType: STRUCTURE_WALL },
      { x: 18, y: 14, structureType: STRUCTURE_WALL },
      { x: 29, y: 27, structureType: STRUCTURE_RAMPART },
      { x: 38, y: 14, structureType: STRUCTURE_ROAD },
      { x: 38, y: 15, structureType: STRUCTURE_ROAD },
      { x: 38, y: 16, structureType: STRUCTURE_ROAD },
      { x: 38, y: 17, structureType: STRUCTURE_ROAD },
      { x: 38, y: 18, structureType: STRUCTURE_ROAD },
      { x: 39, y: 19, structureType: STRUCTURE_ROAD },
      { x: 40, y: 20, structureType: STRUCTURE_ROAD },
      { x: 40, y: 21, structureType: STRUCTURE_ROAD },
      { x: 41, y: 20, structureType: STRUCTURE_ROAD },
      { x: 39, y: 22, structureType: STRUCTURE_ROAD },
      { x: 36, y: 20, structureType: STRUCTURE_ROAD },
      { x: 37, y: 19, structureType: STRUCTURE_ROAD },
      { x: 33, y: 27, structureType: STRUCTURE_ROAD },
      { x: 29, y: 8, structureType: STRUCTURE_WALL },
      { x: 29, y: 9, structureType: STRUCTURE_WALL },
      { x: 29, y: 10, structureType: STRUCTURE_RAMPART },
      { x: 30, y: 10, structureType: STRUCTURE_RAMPART },
      { x: 30, y: 11, structureType: STRUCTURE_RAMPART },
      { x: 29, y: 11, structureType: STRUCTURE_RAMPART },
      { x: 30, y: 9, structureType: STRUCTURE_WALL },
      { x: 34, y: 28, structureType: STRUCTURE_ROAD },
      { x: 35, y: 29, structureType: STRUCTURE_ROAD },
      { x: 36, y: 30, structureType: STRUCTURE_ROAD },
      { x: 37, y: 31, structureType: STRUCTURE_ROAD },
      { x: 27, y: 21, structureType: STRUCTURE_ROAD },
      { x: 28, y: 20, structureType: STRUCTURE_ROAD },
      { x: 30, y: 20, structureType: STRUCTURE_ROAD },
      { x: 29, y: 21, structureType: STRUCTURE_ROAD },
      { x: 31, y: 20, structureType: STRUCTURE_EXTENSION },
      { x: 30, y: 21, structureType: STRUCTURE_ROAD },
      { x: 31, y: 21, structureType: STRUCTURE_ROAD },
      { x: 40, y: 11, structureType: STRUCTURE_RAMPART },
      { x: 41, y: 21, structureType: STRUCTURE_EXTENSION },
      { x: 40, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 42, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 26, y: 23, structureType: STRUCTURE_STORAGE },
      { x: 35, y: 25, structureType: STRUCTURE_ROAD },
      { x: 34, y: 27, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 28, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 28, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 29, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 26, structureType: STRUCTURE_EXTENSION },
      { x: 38, y: 13, structureType: STRUCTURE_RAMPART },
      { x: 32, y: 21, structureType: STRUCTURE_TOWER },
      { x: 36, y: 18, structureType: STRUCTURE_EXTENSION },
      { x: 37, y: 18, structureType: STRUCTURE_EXTENSION },
      { x: 39, y: 18, structureType: STRUCTURE_EXTENSION },
      { x: 40, y: 22, structureType: STRUCTURE_EXTENSION },
      { x: 38, y: 21, structureType: STRUCTURE_ROAD },
      { x: 38, y: 20, structureType: STRUCTURE_ROAD },
      { x: 39, y: 20, structureType: STRUCTURE_EXTENSION },
      { x: 39, y: 21, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 27, structureType: STRUCTURE_ROAD },
      { x: 35, y: 26, structureType: STRUCTURE_EXTENSION },
      { x: 36, y: 27, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 30, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 33, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 29, structureType: STRUCTURE_ROAD },
      { x: 31, y: 29, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 28, structureType: STRUCTURE_ROAD },
      { x: 32, y: 28, structureType: STRUCTURE_ROAD },
      { x: 33, y: 29, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 30, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 30, structureType: STRUCTURE_ROAD },
      { x: 34, y: 31, structureType: STRUCTURE_ROAD },
      { x: 34, y: 30, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 31, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 32, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 31, structureType: STRUCTURE_EXTENSION },
      { x: 36, y: 32, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 32, structureType: STRUCTURE_ROAD },
      { x: 36, y: 31, structureType: STRUCTURE_EXTENSION },
      { x: 36, y: 28, structureType: STRUCTURE_EXTENSION },
      { x: 2, y: 27, structureType: STRUCTURE_WALL },
      { x: 2, y: 26, structureType: STRUCTURE_RAMPART },
      { x: 3, y: 26, structureType: STRUCTURE_RAMPART },
      { x: 3, y: 25, structureType: STRUCTURE_RAMPART },
      { x: 2, y: 25, structureType: STRUCTURE_RAMPART },
      { x: 2, y: 24, structureType: STRUCTURE_WALL },
      { x: 3, y: 24, structureType: STRUCTURE_WALL },
      { x: 3, y: 27, structureType: STRUCTURE_WALL },
      { x: 36, y: 26, structureType: STRUCTURE_ROAD },
      { x: 37, y: 27, structureType: STRUCTURE_ROAD },
      { x: 37, y: 28, structureType: STRUCTURE_LAB },
      { x: 38, y: 28, structureType: STRUCTURE_ROAD },
      { x: 38, y: 30, structureType: STRUCTURE_ROAD },
      { x: 37, y: 30, structureType: STRUCTURE_LAB },
      { x: 37, y: 29, structureType: STRUCTURE_LAB },
      { x: 36, y: 29, structureType: STRUCTURE_TERMINAL },
      { x: 39, y: 28, structureType: STRUCTURE_LAB },
      { x: 39, y: 29, structureType: STRUCTURE_LAB },
      { x: 39, y: 30, structureType: STRUCTURE_LAB },
      { x: 36, y: 33, structureType: STRUCTURE_ROAD },
      { x: 37, y: 33, structureType: STRUCTURE_ROAD },
      { x: 38, y: 32, structureType: STRUCTURE_ROAD },
      { x: 39, y: 32, structureType: STRUCTURE_TOWER },
      { x: 37, y: 32, structureType: STRUCTURE_SPAWN },
      { x: 38, y: 19, structureType: STRUCTURE_EXTENSION },
      { x: 37, y: 20, structureType: STRUCTURE_EXTENSION },
      { x: 37, y: 21, structureType: STRUCTURE_EXTENSION },
      { x: 36, y: 21, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 34, structureType: STRUCTURE_ROAD },
      { x: 34, y: 34, structureType: STRUCTURE_ROAD },
      { x: 33, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 35, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 35, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 33, structureType: STRUCTURE_EXTENSION },
      { x: 36, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 37, y: 34, structureType: STRUCTURE_EXTENSION },
      { x: 38, y: 27, structureType: STRUCTURE_LAB },
      { x: 38, y: 31, structureType: STRUCTURE_LAB },
      { x: 38, y: 29, structureType: STRUCTURE_LAB },
      { x: 39, y: 27, structureType: STRUCTURE_LAB }
    ]
  },
  E59S29: {
    plan: [
      { x: 35, y: 7, structureType: STRUCTURE_SPAWN },
      { x: 33, y: 9, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 10, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 8, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 8, structureType: STRUCTURE_ROAD },
      { x: 32, y: 9, structureType: STRUCTURE_ROAD },
      { x: 33, y: 7, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 8, structureType: STRUCTURE_CONTAINER },
      { x: 34, y: 7, structureType: STRUCTURE_ROAD },
      { x: 34, y: 6, structureType: STRUCTURE_EXTENSION },
      {
        x: 13,
        y: 9,
        structureType: STRUCTURE_CONTAINER,
        purpose: "controllerDelivery"
      },
      { x: 31, y: 10, structureType: STRUCTURE_ROAD },
      { x: 30, y: 10, structureType: STRUCTURE_ROAD },
      { x: 29, y: 10, structureType: STRUCTURE_ROAD },
      { x: 28, y: 10, structureType: STRUCTURE_ROAD },
      { x: 27, y: 10, structureType: STRUCTURE_ROAD },
      { x: 26, y: 10, structureType: STRUCTURE_ROAD },
      { x: 25, y: 10, structureType: STRUCTURE_ROAD },
      { x: 24, y: 10, structureType: STRUCTURE_ROAD },
      { x: 23, y: 10, structureType: STRUCTURE_ROAD },
      { x: 22, y: 10, structureType: STRUCTURE_ROAD },
      { x: 21, y: 10, structureType: STRUCTURE_ROAD },
      { x: 20, y: 10, structureType: STRUCTURE_ROAD },
      { x: 19, y: 10, structureType: STRUCTURE_ROAD },
      { x: 18, y: 10, structureType: STRUCTURE_ROAD },
      { x: 17, y: 10, structureType: STRUCTURE_ROAD },
      { x: 16, y: 10, structureType: STRUCTURE_ROAD },
      { x: 15, y: 10, structureType: STRUCTURE_ROAD },
      { x: 14, y: 10, structureType: STRUCTURE_ROAD },
      { x: 13, y: 10, structureType: STRUCTURE_ROAD },
      { x: 44, y: 23, structureType: STRUCTURE_CONTAINER },
      { x: 44, y: 23, structureType: STRUCTURE_RAMPART },
      { x: 31, y: 9, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 6, structureType: STRUCTURE_ROAD },
      { x: 35, y: 5, structureType: STRUCTURE_EXTENSION },
      { x: 36, y: 6, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 11, structureType: STRUCTURE_EXTENSION },
      { x: 27, y: 11, structureType: STRUCTURE_EXTENSION },
      { x: 30, y: 9, structureType: STRUCTURE_TOWER },
      { x: 29, y: 11, structureType: STRUCTURE_ROAD },
      { x: 28, y: 12, structureType: STRUCTURE_ROAD },
      { x: 27, y: 13, structureType: STRUCTURE_ROAD },
      { x: 26, y: 14, structureType: STRUCTURE_ROAD },
      { x: 25, y: 15, structureType: STRUCTURE_ROAD },
      { x: 24, y: 16, structureType: STRUCTURE_ROAD },
      { x: 23, y: 17, structureType: STRUCTURE_ROAD },
      { x: 22, y: 18, structureType: STRUCTURE_ROAD },
      { x: 21, y: 18, structureType: STRUCTURE_ROAD },
      { x: 20, y: 18, structureType: STRUCTURE_ROAD },
      { x: 19, y: 18, structureType: STRUCTURE_ROAD },
      { x: 18, y: 19, structureType: STRUCTURE_ROAD },
      { x: 17, y: 20, structureType: STRUCTURE_ROAD },
      { x: 16, y: 21, structureType: STRUCTURE_ROAD },
      { x: 16, y: 22, structureType: STRUCTURE_ROAD },
      { x: 16, y: 23, structureType: STRUCTURE_ROAD },
      { x: 17, y: 24, structureType: STRUCTURE_ROAD },
      { x: 18, y: 25, structureType: STRUCTURE_ROAD },
      { x: 19, y: 26, structureType: STRUCTURE_ROAD },
      { x: 20, y: 27, structureType: STRUCTURE_ROAD },
      { x: 21, y: 28, structureType: STRUCTURE_ROAD },
      { x: 22, y: 28, structureType: STRUCTURE_ROAD },
      { x: 23, y: 28, structureType: STRUCTURE_ROAD },
      { x: 24, y: 28, structureType: STRUCTURE_ROAD },
      { x: 25, y: 29, structureType: STRUCTURE_ROAD },
      { x: 26, y: 30, structureType: STRUCTURE_ROAD },
      { x: 27, y: 30, structureType: STRUCTURE_ROAD },
      { x: 28, y: 30, structureType: STRUCTURE_ROAD },
      { x: 29, y: 30, structureType: STRUCTURE_ROAD },
      { x: 30, y: 30, structureType: STRUCTURE_ROAD },
      { x: 31, y: 29, structureType: STRUCTURE_ROAD },
      { x: 32, y: 28, structureType: STRUCTURE_ROAD },
      { x: 33, y: 27, structureType: STRUCTURE_ROAD },
      { x: 34, y: 26, structureType: STRUCTURE_ROAD },
      { x: 35, y: 26, structureType: STRUCTURE_ROAD },
      { x: 36, y: 26, structureType: STRUCTURE_ROAD },
      { x: 37, y: 26, structureType: STRUCTURE_ROAD },
      { x: 38, y: 26, structureType: STRUCTURE_ROAD },
      { x: 39, y: 26, structureType: STRUCTURE_ROAD },
      { x: 40, y: 26, structureType: STRUCTURE_ROAD },
      { x: 41, y: 26, structureType: STRUCTURE_ROAD },
      { x: 42, y: 26, structureType: STRUCTURE_ROAD },
      { x: 43, y: 26, structureType: STRUCTURE_ROAD },
      { x: 44, y: 25, structureType: STRUCTURE_ROAD },
      { x: 44, y: 24, structureType: STRUCTURE_ROAD },
      { x: 33, y: 6, structureType: STRUCTURE_ROAD },
      { x: 47, y: 21, structureType: STRUCTURE_WALL },
      { x: 47, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 47, y: 23, structureType: STRUCTURE_RAMPART },
      { x: 46, y: 23, structureType: STRUCTURE_RAMPART },
      { x: 46, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 33, y: 5, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 6, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 8, structureType: STRUCTURE_ROAD },
      { x: 30, y: 8, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 7, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 7, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 5, structureType: STRUCTURE_EXTENSION },
      { x: 30, y: 11, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 9, structureType: STRUCTURE_EXTENSION },
      { x: 28, y: 11, structureType: STRUCTURE_EXTENSION },
      { x: 28, y: 9, structureType: STRUCTURE_EXTENSION },
      { x: 36, y: 5, structureType: STRUCTURE_ROAD },
      { x: 37, y: 4, structureType: STRUCTURE_ROAD },
      { x: 38, y: 3, structureType: STRUCTURE_ROAD },
      { x: 39, y: 2, structureType: STRUCTURE_ROAD },
      { x: 40, y: 1, structureType: STRUCTURE_ROAD },
      { x: 37, y: 5, structureType: STRUCTURE_STORAGE },
      { x: 14, y: 21, structureType: STRUCTURE_WALL },
      { x: 15, y: 21, structureType: STRUCTURE_RAMPART },
      { x: 16, y: 21, structureType: STRUCTURE_RAMPART },
      { x: 16, y: 20, structureType: STRUCTURE_RAMPART },
      { x: 17, y: 20, structureType: STRUCTURE_RAMPART },
      { x: 15, y: 20, structureType: STRUCTURE_RAMPART },
      { x: 14, y: 20, structureType: STRUCTURE_WALL },
      { x: 26, y: 3, structureType: STRUCTURE_WALL },
      { x: 27, y: 3, structureType: STRUCTURE_WALL },
      { x: 28, y: 3, structureType: STRUCTURE_RAMPART },
      { x: 28, y: 4, structureType: STRUCTURE_RAMPART },
      { x: 35, y: 2, structureType: STRUCTURE_WALL },
      { x: 36, y: 2, structureType: STRUCTURE_WALL },
      { x: 37, y: 2, structureType: STRUCTURE_WALL },
      { x: 38, y: 2, structureType: STRUCTURE_WALL },
      { x: 39, y: 2, structureType: STRUCTURE_RAMPART },
      { x: 39, y: 3, structureType: STRUCTURE_RAMPART },
      { x: 40, y: 2, structureType: STRUCTURE_RAMPART },
      {
        x: 44,
        y: 23,
        structureType: STRUCTURE_CONTAINER,
        action: "destroy",
        minRcl: 5
      },
      { x: 33, y: 41, structureType: STRUCTURE_WALL },
      { x: 34, y: 41, structureType: STRUCTURE_RAMPART },
      { x: 35, y: 41, structureType: STRUCTURE_RAMPART },
      { x: 36, y: 41, structureType: STRUCTURE_WALL },
      { x: 37, y: 41, structureType: STRUCTURE_WALL },
      { x: 38, y: 41, structureType: STRUCTURE_WALL },
      { x: 39, y: 41, structureType: STRUCTURE_WALL },
      { x: 35, y: 40, structureType: STRUCTURE_RAMPART },
      { x: 34, y: 40, structureType: STRUCTURE_RAMPART },
      { x: 34, y: 40, structureType: STRUCTURE_ROAD },
      { x: 5, y: 22, structureType: STRUCTURE_WALL },
      { x: 5, y: 23, structureType: STRUCTURE_RAMPART },
      { x: 6, y: 23, structureType: STRUCTURE_RAMPART },
      { x: 6, y: 24, structureType: STRUCTURE_RAMPART },
      { x: 5, y: 24, structureType: STRUCTURE_RAMPART },
      { x: 5, y: 25, structureType: STRUCTURE_WALL },
      { x: 13, y: 34, structureType: STRUCTURE_WALL },
      { x: 13, y: 35, structureType: STRUCTURE_WALL },
      { x: 13, y: 36, structureType: STRUCTURE_RAMPART },
      { x: 14, y: 36, structureType: STRUCTURE_RAMPART },
      { x: 14, y: 37, structureType: STRUCTURE_RAMPART },
      { x: 13, y: 37, structureType: STRUCTURE_RAMPART },
      { x: 13, y: 38, structureType: STRUCTURE_WALL },
      { x: 13, y: 39, structureType: STRUCTURE_WALL },
      { x: 13, y: 40, structureType: STRUCTURE_WALL },
      { x: 36, y: 4, structureType: STRUCTURE_ROAD },
      { x: 35, y: 4, structureType: STRUCTURE_ROAD },
      { x: 34, y: 4, structureType: STRUCTURE_EXTENSION },
      { x: 35, y: 3, structureType: STRUCTURE_EXTENSION },
      { x: 36, y: 3, structureType: STRUCTURE_EXTENSION },
      { x: 37, y: 3, structureType: STRUCTURE_EXTENSION },
      { x: 39, y: 3, structureType: STRUCTURE_EXTENSION },
      { x: 30, y: 12, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 13, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 12, structureType: STRUCTURE_EXTENSION },
      { x: 28, y: 13, structureType: STRUCTURE_EXTENSION },
      { x: 27, y: 12, structureType: STRUCTURE_TOWER },
      { x: 44, y: 22, structureType: STRUCTURE_LINK },
      { x: 14, y: 9, structureType: STRUCTURE_LINK },
      { x: 27, y: 9, structureType: STRUCTURE_EXTENSION },
      { x: 38, y: 4, structureType: STRUCTURE_TERMINAL },
      { x: 25, y: 14, structureType: STRUCTURE_LAB },
      { x: 25, y: 13, structureType: STRUCTURE_LAB },
      { x: 26, y: 13, structureType: STRUCTURE_LAB },
      { x: 30, y: 7, structureType: STRUCTURE_ROAD },
      { x: 29, y: 7, structureType: STRUCTURE_ROAD },
      { x: 27, y: 7, structureType: STRUCTURE_ROAD },
      { x: 26, y: 8, structureType: STRUCTURE_ROAD },
      { x: 25, y: 9, structureType: STRUCTURE_ROAD },
      { x: 27, y: 6, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 6, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 8, structureType: STRUCTURE_EXTENSION },
      { x: 28, y: 8, structureType: STRUCTURE_EXTENSION },
      { x: 27, y: 8, structureType: STRUCTURE_EXTENSION },
      { x: 26, y: 9, structureType: STRUCTURE_EXTENSION },
      { x: 26, y: 7, structureType: STRUCTURE_EXTENSION },
      { x: 25, y: 8, structureType: STRUCTURE_EXTENSION },
      { x: 26, y: 6, structureType: STRUCTURE_ROAD },
      { x: 25, y: 7, structureType: STRUCTURE_EXTENSION },
      { x: 25, y: 6, structureType: STRUCTURE_EXTENSION },
      { x: 19, y: 19, structureType: STRUCTURE_TOWER },
      { x: 19, y: 19, structureType: STRUCTURE_RAMPART },
      { x: 24, y: 8, structureType: STRUCTURE_ROAD },
      { x: 25, y: 5, structureType: STRUCTURE_ROAD },
      { x: 24, y: 6, structureType: STRUCTURE_ROAD },
      { x: 23, y: 7, structureType: STRUCTURE_ROAD },
      { x: 27, y: 5, structureType: STRUCTURE_ROAD },
      { x: 28, y: 6, structureType: STRUCTURE_ROAD },
      { x: 28, y: 7, structureType: STRUCTURE_EXTENSION },
      { x: 28, y: 5, structureType: STRUCTURE_EXTENSION },
      { x: 27, y: 4, structureType: STRUCTURE_EXTENSION },
      { x: 26, y: 4, structureType: STRUCTURE_EXTENSION },
      { x: 26, y: 5, structureType: STRUCTURE_EXTENSION },
      { x: 25, y: 4, structureType: STRUCTURE_EXTENSION },
      { x: 24, y: 5, structureType: STRUCTURE_EXTENSION },
      { x: 23, y: 6, structureType: STRUCTURE_EXTENSION },
      { x: 24, y: 7, structureType: STRUCTURE_EXTENSION },
      { x: 22, y: 7, structureType: STRUCTURE_EXTENSION },
      { x: 27, y: 12, structureType: STRUCTURE_RAMPART },
      { x: 30, y: 9, structureType: STRUCTURE_RAMPART }
    ]
  },
  E59S27: {
    plan: [
      { x: 28, y: 23, structureType: STRUCTURE_SPAWN },
      { x: 39, y: 22, structureType: STRUCTURE_CONTAINER },
      { x: 28, y: 22, structureType: STRUCTURE_CONTAINER },
      {
        x: 29,
        y: 8,
        structureType: STRUCTURE_CONTAINER,
        purpose: "controllerDelivery"
      },
      { x: 29, y: 22, structureType: STRUCTURE_ROAD },
      { x: 30, y: 22, structureType: STRUCTURE_ROAD },
      { x: 31, y: 22, structureType: STRUCTURE_ROAD },
      { x: 32, y: 22, structureType: STRUCTURE_ROAD },
      { x: 33, y: 22, structureType: STRUCTURE_ROAD },
      { x: 34, y: 22, structureType: STRUCTURE_ROAD },
      { x: 35, y: 22, structureType: STRUCTURE_ROAD },
      { x: 36, y: 22, structureType: STRUCTURE_ROAD },
      { x: 37, y: 22, structureType: STRUCTURE_ROAD },
      { x: 38, y: 22, structureType: STRUCTURE_ROAD },
      { x: 35, y: 23, structureType: STRUCTURE_EXTENSION },
      { x: 34, y: 23, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 23, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 23, structureType: STRUCTURE_ROAD },
      { x: 34, y: 24, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 25, structureType: STRUCTURE_EXTENSION },
      { x: 47, y: 17, structureType: STRUCTURE_WALL },
      { x: 46, y: 17, structureType: STRUCTURE_WALL },
      { x: 47, y: 14, structureType: STRUCTURE_RAMPART },
      { x: 47, y: 15, structureType: STRUCTURE_RAMPART },
      { x: 47, y: 16, structureType: STRUCTURE_RAMPART },
      { x: 46, y: 16, structureType: STRUCTURE_RAMPART },
      { x: 46, y: 15, structureType: STRUCTURE_RAMPART },
      { x: 46, y: 14, structureType: STRUCTURE_RAMPART },
      { x: 45, y: 14, structureType: STRUCTURE_RAMPART },
      { x: 45, y: 15, structureType: STRUCTURE_RAMPART },
      { x: 45, y: 16, structureType: STRUCTURE_RAMPART },
      { x: 40, y: 22, structureType: STRUCTURE_TOWER },
      { x: 33, y: 24, structureType: STRUCTURE_ROAD },
      { x: 30, y: 23, structureType: STRUCTURE_ROAD },
      { x: 31, y: 24, structureType: STRUCTURE_ROAD },
      { x: 31, y: 23, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 24, structureType: STRUCTURE_EXTENSION },
      { x: 30, y: 24, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 25, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 26, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 25, structureType: STRUCTURE_ROAD },
      { x: 29, y: 21, structureType: STRUCTURE_ROAD },
      { x: 29, y: 20, structureType: STRUCTURE_ROAD },
      { x: 29, y: 19, structureType: STRUCTURE_ROAD },
      { x: 29, y: 18, structureType: STRUCTURE_ROAD },
      { x: 29, y: 17, structureType: STRUCTURE_ROAD },
      { x: 29, y: 16, structureType: STRUCTURE_ROAD },
      { x: 29, y: 15, structureType: STRUCTURE_ROAD },
      { x: 29, y: 14, structureType: STRUCTURE_ROAD },
      { x: 29, y: 13, structureType: STRUCTURE_ROAD },
      { x: 29, y: 12, structureType: STRUCTURE_ROAD },
      { x: 29, y: 11, structureType: STRUCTURE_ROAD },
      { x: 29, y: 10, structureType: STRUCTURE_ROAD },
      { x: 29, y: 9, structureType: STRUCTURE_ROAD },
      { x: 28, y: 24, structureType: STRUCTURE_STORAGE },
      { x: 29, y: 24, structureType: STRUCTURE_ROAD },
      { x: 29, y: 25, structureType: STRUCTURE_ROAD },
      { x: 39, y: 23, structureType: STRUCTURE_ROAD },
      { x: 40, y: 23, structureType: STRUCTURE_ROAD },
      { x: 41, y: 22, structureType: STRUCTURE_ROAD },
      { x: 39, y: 24, structureType: STRUCTURE_ROAD },
      { x: 39, y: 25, structureType: STRUCTURE_ROAD },
      { x: 41, y: 23, structureType: STRUCTURE_EXTENSION },
      { x: 40, y: 24, structureType: STRUCTURE_EXTENSION },
      { x: 40, y: 25, structureType: STRUCTURE_EXTENSION },
      { x: 38, y: 25, structureType: STRUCTURE_ROAD },
      { x: 37, y: 24, structureType: STRUCTURE_ROAD },
      { x: 36, y: 23, structureType: STRUCTURE_ROAD },
      { x: 36, y: 24, structureType: STRUCTURE_EXTENSION },
      { x: 37, y: 25, structureType: STRUCTURE_EXTENSION },
      { x: 38, y: 26, structureType: STRUCTURE_EXTENSION },
      { x: 40, y: 26, structureType: STRUCTURE_EXTENSION },
      { x: 37, y: 23, structureType: STRUCTURE_EXTENSION },
      { x: 38, y: 23, structureType: STRUCTURE_EXTENSION },
      { x: 38, y: 24, structureType: STRUCTURE_EXTENSION },
      { x: 44, y: 20, structureType: STRUCTURE_TOWER },
      { x: 42, y: 21, structureType: STRUCTURE_ROAD },
      { x: 43, y: 21, structureType: STRUCTURE_ROAD },
      { x: 44, y: 21, structureType: STRUCTURE_ROAD },
      { x: 45, y: 22, structureType: STRUCTURE_ROAD },
      { x: 42, y: 22, structureType: STRUCTURE_EXTENSION },
      { x: 43, y: 22, structureType: STRUCTURE_EXTENSION },
      { x: 44, y: 22, structureType: STRUCTURE_EXTENSION },
      { x: 45, y: 23, structureType: STRUCTURE_EXTENSION },
      { x: 46, y: 22, structureType: STRUCTURE_EXTENSION },
      { x: 45, y: 21, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 26, structureType: STRUCTURE_ROAD },
      { x: 30, y: 26, structureType: STRUCTURE_ROAD },
      { x: 32, y: 27, structureType: STRUCTURE_ROAD },
      { x: 32, y: 28, structureType: STRUCTURE_ROAD },
      { x: 33, y: 27, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 28, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 26, structureType: STRUCTURE_EXTENSION },
      { x: 30, y: 25, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 18, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 18, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 19, structureType: STRUCTURE_RAMPART },
      { x: 41, y: 19, structureType: STRUCTURE_RAMPART },
      { x: 41, y: 20, structureType: STRUCTURE_RAMPART },
      { x: 42, y: 20, structureType: STRUCTURE_RAMPART },
      { x: 43, y: 19, structureType: STRUCTURE_WALL },
      { x: 43, y: 20, structureType: STRUCTURE_WALL },
      { x: 44, y: 20, structureType: STRUCTURE_RAMPART },
      { x: 40, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 39, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 38, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 37, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 36, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 35, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 34, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 33, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 32, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 31, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 30, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 29, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 28, y: 22, structureType: STRUCTURE_RAMPART },
      { x: 22, y: 31, structureType: STRUCTURE_RAMPART },
      { x: 22, y: 32, structureType: STRUCTURE_RAMPART },
      { x: 23, y: 32, structureType: STRUCTURE_RAMPART },
      { x: 23, y: 31, structureType: STRUCTURE_RAMPART },
      { x: 22, y: 33, structureType: STRUCTURE_WALL },
      { x: 23, y: 33, structureType: STRUCTURE_WALL },
      { x: 39, y: 26, structureType: STRUCTURE_ROAD },
      { x: 39, y: 27, structureType: STRUCTURE_ROAD },
      { x: 40, y: 28, structureType: STRUCTURE_ROAD },
      { x: 38, y: 28, structureType: STRUCTURE_ROAD },
      { x: 37, y: 29, structureType: STRUCTURE_ROAD },
      { x: 40, y: 29, structureType: STRUCTURE_ROAD },
      { x: 40, y: 30, structureType: STRUCTURE_ROAD },
      { x: 40, y: 31, structureType: STRUCTURE_ROAD },
      { x: 40, y: 27, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 27, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 28, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 29, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 30, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 31, structureType: STRUCTURE_EXTENSION },
      { x: 41, y: 32, structureType: STRUCTURE_EXTENSION },
      { x: 38, y: 27, structureType: STRUCTURE_EXTENSION },
      { x: 37, y: 28, structureType: STRUCTURE_EXTENSION },
      { x: 39, y: 28, structureType: STRUCTURE_EXTENSION },
      { x: 30, y: 27, structureType: STRUCTURE_ROAD },
      { x: 30, y: 28, structureType: STRUCTURE_ROAD },
      { x: 30, y: 29, structureType: STRUCTURE_ROAD },
      { x: 29, y: 30, structureType: STRUCTURE_TOWER },
      { x: 31, y: 27, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 28, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 30, structureType: STRUCTURE_EXTENSION },
      { x: 31, y: 29, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 29, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 29, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 28, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 27, structureType: STRUCTURE_EXTENSION },
      { x: 29, y: 26, structureType: STRUCTURE_EXTENSION },
      { x: 33, y: 30, structureType: STRUCTURE_EXTENSION },
      { x: 32, y: 29, structureType: STRUCTURE_ROAD },
      { x: 29, y: 30, structureType: STRUCTURE_RAMPART }
    ]
  }
};

// src/managers/buildPlanManager.ts
var BUILD_PLAN_RECONCILE_INTERVAL = 100;
var MAX_ROOM_CONSTRUCTION_SITES = 10;
function stableBuildPlanValue(value) {
  if (!value || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(stableBuildPlanValue);
  }
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entryValue]) => [key, stableBuildPlanValue(entryValue)])
  );
}
function getBuildPlanHash(plan) {
  return JSON.stringify(stableBuildPlanValue(plan));
}
function getControllerDeliveryBuildPlan(room) {
  var _a, _b;
  return (_b = (_a = room.memory.buildPlan) == null ? void 0 : _a.find(
    (item) => item.purpose === "controllerDelivery"
  )) != null ? _b : null;
}
function getPrimarySpawnBuildPlan(room) {
  var _a, _b;
  syncDefaultBuildPlan(room);
  return (_b = (_a = room.memory.buildPlan) == null ? void 0 : _a.find(
    (item) => item.purpose === "primarySpawn" && item.structureType === STRUCTURE_SPAWN
  )) != null ? _b : null;
}
function isControllerDeliveryContainer(structure) {
  if (structure.structureType !== STRUCTURE_CONTAINER) {
    return false;
  }
  const plan = getControllerDeliveryBuildPlan(structure.room);
  return !!plan && structure.pos.x === plan.x && structure.pos.y === plan.y;
}
function getControllerDeliveryLink(room) {
  var _a;
  const plan = getControllerDeliveryBuildPlan(room);
  if (plan) {
    const plannedLink = room.lookForAt(LOOK_STRUCTURES, plan.x, plan.y).find((s) => s.structureType === STRUCTURE_LINK);
    if (plannedLink) {
      return plannedLink;
    }
  }
  const controller = room.controller;
  if (!controller) {
    return null;
  }
  return (_a = controller.pos.findInRange(FIND_MY_STRUCTURES, 4, {
    filter: (s) => s.structureType === STRUCTURE_LINK
  })[0]) != null ? _a : null;
}
function getControllerDeliveryContainer(room) {
  var _a;
  const plan = getControllerDeliveryBuildPlan(room);
  if (plan) {
    const plannedContainer = room.lookForAt(LOOK_STRUCTURES, plan.x, plan.y).find(
      (structure) => structure.structureType === STRUCTURE_CONTAINER
    );
    if (plannedContainer) {
      return plannedContainer;
    }
  }
  const controller = room.controller;
  if (!controller) {
    return null;
  }
  return (_a = controller.pos.findInRange(FIND_STRUCTURES, 3, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER
  })[0]) != null ? _a : null;
}
function getBuildPlan(room) {
  var _a;
  syncDefaultBuildPlan(room);
  return ((_a = room.memory.buildPlan) != null ? _a : []).map((item, index) => {
    var _a2;
    return {
      ...item,
      priority: (_a2 = item.priority) != null ? _a2 : index
    };
  });
}
function syncDefaultBuildPlan(room) {
  const defaultBuildPlan = DEFAULT_BUILD_PLANS[room.name];
  if (!defaultBuildPlan) {
    return;
  }
  const buildPlanHash = getBuildPlanHash(defaultBuildPlan.plan);
  if (room.memory.buildPlanHash === buildPlanHash) {
    return;
  }
  room.memory.buildPlan = defaultBuildPlan.plan;
  room.memory.buildPlanHash = buildPlanHash;
}
function getRoomReconcileOffset(roomName) {
  let offset = 0;
  for (const character of roomName) {
    offset = (offset * 31 + character.charCodeAt(0)) % BUILD_PLAN_RECONCILE_INTERVAL;
  }
  return offset;
}
function shouldReconcileBuildPlan(room) {
  return (Game.time + getRoomReconcileOffset(room.name)) % BUILD_PLAN_RECONCILE_INTERVAL === 0;
}
function removeForeignConstructionSites(room) {
  var _a;
  if (!((_a = room.controller) == null ? void 0 : _a.my)) {
    return;
  }
  const foreignSites = room.find(FIND_CONSTRUCTION_SITES, {
    filter: (site) => !site.my
  });
  let removedCount = 0;
  for (const site of foreignSites) {
    const result = site.remove();
    if (result === OK) {
      removedCount += 1;
    } else {
      console.log(
        `Failed to remove foreign ${site.structureType} construction site in ${room.name} at ${site.pos.x},${site.pos.y}: ${result}`
      );
    }
  }
  if (removedCount > 0) {
    console.log(
      `Removed ${removedCount} foreign construction site(s) in ${room.name}`
    );
  }
}
function isBuilt(room, plan) {
  const structures = room.lookForAt(LOOK_STRUCTURES, plan.x, plan.y);
  return structures.some(
    (structure) => structure.structureType === plan.structureType
  );
}
function hasConstructionSiteAt(room, plan) {
  const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, plan.x, plan.y);
  return sites.some(
    (site) => site.my && site.structureType === plan.structureType
  );
}
function getBuildPlanRoomState(room) {
  var _a, _b;
  const structureCounts = {};
  const siteCounts = {};
  for (const structure of room.find(FIND_STRUCTURES)) {
    const structureType = structure.structureType;
    structureCounts[structureType] = ((_a = structureCounts[structureType]) != null ? _a : 0) + 1;
  }
  for (const site of room.find(FIND_MY_CONSTRUCTION_SITES)) {
    siteCounts[site.structureType] = ((_b = siteCounts[site.structureType]) != null ? _b : 0) + 1;
  }
  return { structureCounts, siteCounts };
}
function canBuildAtCurrentControllerLevel(room, plan, state) {
  var _a, _b, _c, _d, _e;
  const controllerLevel = (_b = (_a = room.controller) == null ? void 0 : _a.level) != null ? _b : 0;
  const allowed = (_c = CONTROLLER_STRUCTURES[plan.structureType][controllerLevel]) != null ? _c : 0;
  if (state) {
    return ((_d = state.structureCounts[plan.structureType]) != null ? _d : 0) + ((_e = state.siteCounts[plan.structureType]) != null ? _e : 0) < allowed;
  }
  return room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === plan.structureType
  }).length + room.find(FIND_MY_CONSTRUCTION_SITES, {
    filter: (site) => site.structureType === plan.structureType
  }).length < allowed;
}
function shouldPlaceBuildPlanSite(room, plan) {
  return !isBuilt(room, plan) && !hasConstructionSiteAt(room, plan) && canBuildAtCurrentControllerLevel(room, plan);
}
function isForeignOwnedStructure(room, structure) {
  var _a, _b;
  if (!("owner" in structure)) {
    return false;
  }
  const ownedStructure = structure;
  return ownedStructure.owner.username !== ((_b = (_a = room.controller) == null ? void 0 : _a.owner) == null ? void 0 : _b.username);
}
function canCoexistWithPlannedStructure(structure, plan) {
  if (structure.structureType === plan.structureType) {
    return true;
  }
  if (structure.structureType === STRUCTURE_RAMPART) {
    return true;
  }
  if (plan.structureType === STRUCTURE_RAMPART) {
    return structure.structureType !== STRUCTURE_WALL;
  }
  return false;
}
function findBuildPlanBlocker(room, plan) {
  var _a, _b;
  if (!((_a = room.controller) == null ? void 0 : _a.my)) {
    return null;
  }
  return (_b = room.lookForAt(LOOK_STRUCTURES, plan.x, plan.y).find(
    (structure) => !isForeignOwnedStructure(room, structure) && !canCoexistWithPlannedStructure(structure, plan)
  )) != null ? _b : null;
}
function destroyBuildPlanBlocker(room, plan) {
  const blocker = findBuildPlanBlocker(room, plan);
  if (!blocker) {
    return false;
  }
  const result = blocker.destroy();
  if (result === OK) {
    console.log(
      `Build plan destroyed blocking ${blocker.structureType} in ${room.name} at ${plan.x},${plan.y} for planned ${plan.structureType}`
    );
  } else {
    console.log(
      `Build plan failed to destroy blocking ${blocker.structureType} in ${room.name} at ${plan.x},${plan.y} for planned ${plan.structureType}: ${result}`
    );
  }
  return true;
}
function placeBuildPlanSite(room, plan) {
  const result = room.createConstructionSite(
    plan.x,
    plan.y,
    plan.structureType
  );
  if (result === OK) {
    console.log(
      `Build plan placed ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}`
    );
    return true;
  }
  if (result !== ERR_FULL) {
    console.log(
      `Build plan failed for ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}: ${result}`
    );
  }
  return false;
}
function prepareBuildPlanSite(room, plan) {
  if (destroyBuildPlanBlocker(room, plan)) {
    return false;
  }
  return placeBuildPlanSite(room, plan);
}
function executeDestroyPlan(room, plan) {
  const structure = room.lookForAt(LOOK_STRUCTURES, plan.x, plan.y).find((s) => s.structureType === plan.structureType);
  if (!structure) return;
  const result = structure.destroy();
  if (result === OK) {
    console.log(
      `Build plan destroyed ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}`
    );
  } else {
    console.log(
      `Build plan failed to destroy ${plan.structureType} in ${room.name} at ${plan.x},${plan.y}: ${result}`
    );
  }
}
var buildPlanManager = {
  manageBuildPlans() {
    for (const roomName in Game.rooms) {
      this.manageRoomBuildPlan(Game.rooms[roomName]);
    }
  },
  manageRoomBuildPlan(room) {
    var _a, _b, _c, _d, _e;
    syncDefaultBuildPlan(room);
    removeForeignConstructionSites(room);
    const primarySpawnPlan = getPrimarySpawnBuildPlan(room);
    if (primarySpawnPlan && shouldPlaceBuildPlanSite(room, primarySpawnPlan)) {
      prepareBuildPlanSite(room, primarySpawnPlan);
    }
    if (!shouldReconcileBuildPlan(room)) {
      return;
    }
    const buildPlan = getBuildPlan(room).sort(
      (a, b) => a.priority - b.priority
    );
    const currentRcl = (_b = (_a = room.controller) == null ? void 0 : _a.level) != null ? _b : 0;
    const state = getBuildPlanRoomState(room);
    let globalSiteCount = Object.keys(Game.constructionSites).length;
    let roomSiteCount = Object.values(state.siteCounts).reduce(
      (count, typeCount) => count + (typeCount != null ? typeCount : 0),
      0
    );
    const supersededByDestroy = /* @__PURE__ */ new Set();
    for (const plan of buildPlan) {
      if (plan.action === "destroy") {
        const rclMet = plan.minRcl === void 0 || currentRcl >= plan.minRcl;
        if (rclMet) {
          supersededByDestroy.add(`${plan.x},${plan.y},${plan.structureType}`);
        }
      }
    }
    for (const plan of buildPlan) {
      if (plan.action === "destroy") {
        if (plan.minRcl !== void 0 && currentRcl < plan.minRcl) {
          continue;
        }
        executeDestroyPlan(room, plan);
      }
    }
    const candidates = buildPlan.filter(
      (plan) => plan.action !== "destroy" && !(plan.purpose === "primarySpawn" && plan.structureType === STRUCTURE_SPAWN) && !supersededByDestroy.has(`${plan.x},${plan.y},${plan.structureType}`) && !isBuilt(room, plan) && !hasConstructionSiteAt(room, plan) && canBuildAtCurrentControllerLevel(room, plan, state)
    );
    while (candidates.length > 0 && roomSiteCount < MAX_ROOM_CONSTRUCTION_SITES && globalSiteCount < MAX_CONSTRUCTION_SITES) {
      const establishedExtensionCount = ((_c = state.structureCounts[STRUCTURE_EXTENSION]) != null ? _c : 0) + ((_d = state.siteCounts[STRUCTURE_EXTENSION]) != null ? _d : 0);
      let bestCandidateIndex = 0;
      for (let index = 1; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const bestCandidate = candidates[bestCandidateIndex];
        const candidatePriority = getConstructionPriority(
          candidate.structureType,
          establishedExtensionCount
        );
        const bestPriority = getConstructionPriority(
          bestCandidate.structureType,
          establishedExtensionCount
        );
        if (candidatePriority < bestPriority || candidatePriority === bestPriority && candidate.priority < bestCandidate.priority) {
          bestCandidateIndex = index;
        }
      }
      const [plan] = candidates.splice(bestCandidateIndex, 1);
      if (!canBuildAtCurrentControllerLevel(room, plan, state)) {
        continue;
      }
      if (prepareBuildPlanSite(room, plan)) {
        state.siteCounts[plan.structureType] = ((_e = state.siteCounts[plan.structureType]) != null ? _e : 0) + 1;
        roomSiteCount += 1;
        globalSiteCount += 1;
      }
    }
  }
};

// src/creepBodies.ts
var repeatBody = (count, parts) => Array.from({ length: count }).flatMap(() => parts);
var rangedDefenderBody = () => repeatBody(5, [
  TOUGH,
  RANGED_ATTACK,
  MOVE,
  RANGED_ATTACK,
  MOVE,
  RANGED_ATTACK,
  HEAL,
  MOVE
]);
var CREEP_BODY = {
  PIONEER: [
    WORK,
    CARRY,
    MOVE,
    CARRY,
    MOVE,
    ...repeatBody(5, [WORK, CARRY, MOVE, MOVE])
  ],
  CLAIMER: [CLAIM, MOVE],
  HARVESTER: [WORK, CARRY, MOVE, WORK, WORK, CARRY, WORK, WORK, MOVE, WORK],
  UPGRADER: [
    WORK,
    CARRY,
    MOVE,
    ...repeatBody(4, [WORK, WORK, WORK, WORK, MOVE, CARRY])
  ],
  CARRIER: [...repeatBody(4, [MOVE, CARRY, CARRY])],
  LAB_TECH: [...repeatBody(6, [CARRY, CARRY, MOVE])],
  RANGED_DEFENDER: rangedDefenderBody(),
  WORKER: [
    WORK,
    CARRY,
    MOVE,
    WORK,
    CARRY,
    WORK,
    MOVE,
    WORK,
    CARRY,
    MOVE,
    CARRY,
    CARRY,
    MOVE
  ]
};
function bodyCost(body) {
  return body.reduce((total, part) => total + BODYPART_COST[part], 0);
}
function buildBodyFromMaxPattern({
  maxBody,
  energyBudget,
  minimumSize = 3,
  sortBody
}) {
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

// src/empire/labPlans.ts
var PRODUCTION_LAB_PLANS = [
  {
    roomName: "E59S28",
    compound: RESOURCE_GHODIUM_OXIDE,
    reagents: [RESOURCE_GHODIUM, RESOURCE_OXYGEN],
    sourceLab: { x: 38, y: 29 },
    outputLabs: [
      { x: 37, y: 29 },
      { x: 39, y: 29 }
    ]
  }
];
var BOOST_LAB_PLANS = [
  {
    roomName: "E58S28",
    boost: RESOURCE_GHODIUM_OXIDE,
    boostedPart: TOUGH,
    labs: [
      { x: 42, y: 47 },
      { x: 42, y: 48 },
      { x: 41, y: 48 }
    ]
  }
];
var SOURCE_LAB_TARGET_MINERAL = 1500;
var BOOST_LAB_TARGET_MINERAL = 900;
var BOOST_LAB_TARGET_ENERGY = 600;
var MIN_BOOST_PARTS = 3;
function getProductionLabPlan(roomName) {
  var _a;
  return (_a = PRODUCTION_LAB_PLANS.find((plan) => plan.roomName === roomName)) != null ? _a : null;
}
function getBoostLabPlan(roomName) {
  var _a;
  return (_a = BOOST_LAB_PLANS.find((plan) => plan.roomName === roomName)) != null ? _a : null;
}
function getLabAt(room, pos) {
  var _a;
  return (_a = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y).find((s) => s.structureType === STRUCTURE_LAB)) != null ? _a : null;
}
function getBoostLabs(room, plan) {
  return plan.labs.map((pos) => getLabAt(room, pos)).filter((lab) => lab !== null);
}
function isBoostLabReady(lab, boost, parts) {
  return lab.mineralType === boost && lab.store[boost] >= parts * LAB_BOOST_MINERAL && lab.store[RESOURCE_ENERGY] >= parts * LAB_BOOST_ENERGY;
}
function findReadyBoostLab(room, parts = MIN_BOOST_PARTS) {
  var _a;
  const plan = getBoostLabPlan(room.name);
  if (!plan) {
    return null;
  }
  return (_a = getBoostLabs(room, plan).find(
    (lab) => isBoostLabReady(lab, plan.boost, parts)
  )) != null ? _a : null;
}

// src/empire/resourcePolicy.ts
var SHARED_MINERALS = [
  RESOURCE_GHODIUM,
  // "G" - safe-mode fuel
  RESOURCE_GHODIUM_OXIDE,
  // "GO" - TOUGH boost + lab-hub input
  RESOURCE_OXYGEN,
  // "O" - reverse-reaction product
  RESOURCE_HYDROGEN
  // "H" - optional, future boosts
];
var SAFE_MODE_GHODIUM_COST = 1e3;
var DEFAULT_ROOM_RESERVES = {
  // Every owned room keeps enough ghodium for one safe-mode generation.
  [RESOURCE_GHODIUM]: SAFE_MODE_GHODIUM_COST
};
var ROOM_RESERVE_OVERRIDES = {
  // Production hub: hoards GO to reverse into G + O, still keeps a safe-mode G.
  E59S28: {
    [RESOURCE_GHODIUM]: SAFE_MODE_GHODIUM_COST,
    [RESOURCE_GHODIUM_OXIDE]: 3e3
  },
  // Exposed frontline: wants extra ghodium (two safe modes) and imported GO for
  // defensive TOUGH boosts, since NPC drops are scarce here.
  E58S28: {
    [RESOURCE_GHODIUM]: 2 * SAFE_MODE_GHODIUM_COST,
    [RESOURCE_GHODIUM_OXIDE]: 2e3
  }
};
var DEFAULT_SAFE_MODE_RESERVE = 1;
var SAFE_MODE_RESERVE_OVERRIDES = {
  E58S28: 2
};
function getRoomReserve(roomName, resource) {
  var _a, _b, _c;
  return (_c = (_b = (_a = ROOM_RESERVE_OVERRIDES[roomName]) == null ? void 0 : _a[resource]) != null ? _b : DEFAULT_ROOM_RESERVES[resource]) != null ? _c : 0;
}
function getDesiredSafeModes(roomName) {
  var _a;
  return (_a = SAFE_MODE_RESERVE_OVERRIDES[roomName]) != null ? _a : DEFAULT_SAFE_MODE_RESERVE;
}
function getStoredAmount(room, resource) {
  var _a, _b, _c, _d;
  const storageAmount = (_b = (_a = room.storage) == null ? void 0 : _a.store[resource]) != null ? _b : 0;
  const terminalAmount = (_d = (_c = room.terminal) == null ? void 0 : _c.store[resource]) != null ? _d : 0;
  return storageAmount + terminalAmount;
}
function isSharedMineral(resource) {
  return SHARED_MINERALS.includes(resource);
}

// src/roles/labTech.ts
var PATH_STYLE = { stroke: "#cc66ff" };
var labTech = {
  run(creep) {
    if (deliverCarry(creep)) {
      return;
    }
    if (pickUpWork(creep)) {
      return;
    }
    creep.moveOffRoad();
  }
};
function roomHasLabWork(room) {
  if (!room.storage && !room.terminal) {
    return false;
  }
  const prodPlan = getProductionLabPlan(room.name);
  if (prodPlan && productionLabWork(room, prodPlan)) {
    return true;
  }
  return boostLabWork(room);
}
function deliverCarry(creep) {
  const carried = getCarriedResource(creep);
  if (!carried) {
    return false;
  }
  if (carried === RESOURCE_ENERGY) {
    return deliverEnergyCarry(creep);
  }
  const goSink = findGoSink(creep.room, carried);
  if (goSink) {
    transfer(creep, goSink, carried);
    return true;
  }
  const store = findDepositTarget(creep.room, carried);
  if (store) {
    transfer(creep, store, carried);
    return true;
  }
  return true;
}
function deliverEnergyCarry(creep) {
  const lab = findBoostLabNeedingEnergy(creep.room);
  if (lab) {
    transfer(creep, lab, RESOURCE_ENERGY);
    return true;
  }
  const storage = creep.room.storage;
  if (storage) {
    transfer(creep, storage, RESOURCE_ENERGY);
    return true;
  }
  return true;
}
function pickUpWork(creep) {
  const salvage = findLabToEmpty(creep.room);
  if (salvage) {
    withdraw(creep, salvage.lab, salvage.resource);
    return true;
  }
  const prodPlan = getProductionLabPlan(creep.room.name);
  if (prodPlan) {
    const source = getLabAt(creep.room, prodPlan.sourceLab);
    if (source && source.store[prodPlan.compound] < SOURCE_LAB_TARGET_MINERAL && withdrawFromStore(creep, prodPlan.compound)) {
      return true;
    }
  }
  const boostPlan = getBoostLabPlan(creep.room.name);
  if (boostPlan) {
    const mineralLab = getBoostLabs(creep.room, boostPlan).find(
      (lab) => lab.store[boostPlan.boost] < BOOST_LAB_TARGET_MINERAL
    );
    if (mineralLab && withdrawFromStore(creep, boostPlan.boost)) {
      return true;
    }
    if (findBoostLabNeedingEnergy(creep.room) && withdrawFromStore(creep, RESOURCE_ENERGY)) {
      return true;
    }
  }
  return false;
}
function productionLabWork(room, plan) {
  const source = getLabAt(room, plan.sourceLab);
  if (!source) {
    return false;
  }
  if (source.mineralType && source.mineralType !== plan.compound) {
    return true;
  }
  if (source.store[plan.compound] < SOURCE_LAB_TARGET_MINERAL && storeAmount(room, plan.compound) > 0) {
    return true;
  }
  return plan.outputLabs.some((pos) => {
    const lab = getLabAt(room, pos);
    return lab !== null && lab.mineralType !== null && lab.store[lab.mineralType] > 0;
  });
}
function boostLabWork(room) {
  const plan = getBoostLabPlan(room.name);
  if (!plan) {
    return false;
  }
  return getBoostLabs(room, plan).some((lab) => {
    if (lab.mineralType && lab.mineralType !== plan.boost) {
      return true;
    }
    if (lab.store[plan.boost] < BOOST_LAB_TARGET_MINERAL && storeAmount(room, plan.boost) > 0) {
      return true;
    }
    return lab.store[RESOURCE_ENERGY] < BOOST_LAB_TARGET_ENERGY && storeAmount(room, RESOURCE_ENERGY) > 0;
  });
}
function findLabToEmpty(room) {
  const prodPlan = getProductionLabPlan(room.name);
  if (prodPlan) {
    const source = getLabAt(room, prodPlan.sourceLab);
    if ((source == null ? void 0 : source.mineralType) && source.mineralType !== prodPlan.compound) {
      return { lab: source, resource: source.mineralType };
    }
    for (const pos of prodPlan.outputLabs) {
      const lab = getLabAt(room, pos);
      if ((lab == null ? void 0 : lab.mineralType) && lab.store[lab.mineralType] > 0) {
        return { lab, resource: lab.mineralType };
      }
    }
  }
  const boostPlan = getBoostLabPlan(room.name);
  if (boostPlan) {
    const wrong = getBoostLabs(room, boostPlan).find(
      (lab) => lab.mineralType && lab.mineralType !== boostPlan.boost
    );
    if (wrong == null ? void 0 : wrong.mineralType) {
      return { lab: wrong, resource: wrong.mineralType };
    }
  }
  return null;
}
function findGoSink(room, resource) {
  var _a;
  const prodPlan = getProductionLabPlan(room.name);
  if (prodPlan && resource === prodPlan.compound) {
    const source = getLabAt(room, prodPlan.sourceLab);
    if (source && source.store[prodPlan.compound] < LAB_MINERAL_CAPACITY) {
      return source;
    }
  }
  const boostPlan = getBoostLabPlan(room.name);
  if (boostPlan && resource === boostPlan.boost) {
    return (_a = getBoostLabs(room, boostPlan).find(
      (lab) => lab.store[boostPlan.boost] < BOOST_LAB_TARGET_MINERAL
    )) != null ? _a : null;
  }
  return null;
}
function findBoostLabNeedingEnergy(room) {
  var _a;
  const plan = getBoostLabPlan(room.name);
  if (!plan) {
    return null;
  }
  return (_a = getBoostLabs(room, plan).find(
    (lab) => lab.store[RESOURCE_ENERGY] < BOOST_LAB_TARGET_ENERGY
  )) != null ? _a : null;
}
function getCarriedResource(creep) {
  var _a, _b;
  const stored = Object.keys(creep.store);
  return (_b = (_a = stored.find((resource) => resource !== RESOURCE_ENERGY)) != null ? _a : stored[0]) != null ? _b : null;
}
function storeAmount(room, resource) {
  var _a, _b, _c, _d;
  return ((_b = (_a = room.storage) == null ? void 0 : _a.store[resource]) != null ? _b : 0) + ((_d = (_c = room.terminal) == null ? void 0 : _c.store[resource]) != null ? _d : 0);
}
function findWithdrawSource(room, resource) {
  if (room.storage && room.storage.store[resource] > 0) {
    return room.storage;
  }
  if (room.terminal && room.terminal.store[resource] > 0) {
    return room.terminal;
  }
  return null;
}
function findDepositTarget(room, resource) {
  var _a, _b, _c;
  if (isSharedMineral(resource) && ((_a = room.terminal) == null ? void 0 : _a.store.getFreeCapacity())) {
    return room.terminal;
  }
  if ((_b = room.storage) == null ? void 0 : _b.store.getFreeCapacity()) {
    return room.storage;
  }
  if ((_c = room.terminal) == null ? void 0 : _c.store.getFreeCapacity()) {
    return room.terminal;
  }
  return null;
}
function withdrawFromStore(creep, resource) {
  const source = findWithdrawSource(creep.room, resource);
  if (!source) {
    return false;
  }
  withdraw(creep, source, resource);
  return true;
}
function withdraw(creep, target, resource) {
  const result = creep.withdraw(target, resource);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(target, { visualizePathStyle: PATH_STYLE });
  }
}
function transfer(creep, target, resource) {
  const result = creep.transfer(target, resource);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(target, { visualizePathStyle: PATH_STYLE });
  }
}

// src/managers/labManager.ts
var REACTION_ERROR_LOG_INTERVAL = 50;
var labManager = {
  manageLabs() {
    var _a;
    for (const plan of PRODUCTION_LAB_PLANS) {
      const room = Game.rooms[plan.roomName];
      if (!((_a = room == null ? void 0 : room.controller) == null ? void 0 : _a.my)) {
        continue;
      }
      const source = getLabAt(room, plan.sourceLab);
      const outputA = getLabAt(room, plan.outputLabs[0]);
      const outputB = getLabAt(room, plan.outputLabs[1]);
      if (!source || !outputA || !outputB) {
        continue;
      }
      if (source.cooldown > 0) {
        continue;
      }
      if (source.mineralType !== plan.compound || source.store[plan.compound] < LAB_REACTION_AMOUNT) {
        continue;
      }
      const result = source.reverseReaction(outputA, outputB);
      if (result !== OK && result !== ERR_NOT_ENOUGH_RESOURCES && result !== ERR_FULL && Game.time % REACTION_ERROR_LOG_INTERVAL === 0) {
        console.log(
          `Lab hub ${room.name} reverseReaction ${plan.compound} failed: ${result}`
        );
      }
    }
  },
  // Keeps one labTech per room that has production or boost lab servicing work.
  getSpawnRequest(room, creepsByRole) {
    if (creepsByRole(CREEP_ROLE.LAB_TECH).length > 0) {
      return null;
    }
    if (!roomHasLabWork(room)) {
      return null;
    }
    return {
      role: CREEP_ROLE.LAB_TECH,
      body: buildBodyFromMaxPattern({
        maxBody: CREEP_BODY.LAB_TECH,
        energyBudget: room.energyCapacityAvailable
      })
    };
  }
};

// src/managers/linkTransferManager.ts
var linkTransferManager = {
  manageLinkTransfers() {
    for (const roomName in Game.rooms) {
      manageRoomLinkTransfers(Game.rooms[roomName]);
    }
  }
};
function manageRoomLinkTransfers(room) {
  const receiverLink = getControllerDeliveryLink(room);
  if (!receiverLink || receiverLink.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    return;
  }
  const sourceLinks = room.find(FIND_MY_STRUCTURES, {
    filter: (s) => s.structureType === STRUCTURE_LINK && s.id !== receiverLink.id && s.store[RESOURCE_ENERGY] > 0 && s.cooldown === 0
  });
  for (const sourceLink of sourceLinks) {
    sourceLink.transferEnergy(receiverLink);
  }
}

// src/managers/memoryManager.ts
var memoryManager = {
  cleanUpCreepMemory() {
    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        console.log(`Clearing memory of non-existing creep: ${name}`);
        delete Memory.creeps[name];
      }
    }
  }
};

// src/managers/mineralLogisticsManager.ts
var MIN_TRANSFER_AMOUNT = 200;
var MAX_TRANSFER_AMOUNT = 2e3;
var PROVIDER_MIN_SURPLUS = 200;
var REQUESTER_MIN_DEFICIT = 200;
var mineralLogisticsManager = {
  manageMineralLogistics() {
    const rooms = getTerminalRooms();
    if (rooms.length < 2) {
      return;
    }
    const transfer2 = findBestTransfer(rooms);
    if (!transfer2) {
      return;
    }
    executeTransfer(transfer2);
  }
};
function getTerminalRooms() {
  var _a;
  const rooms = [];
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    if (((_a = room.controller) == null ? void 0 : _a.my) && room.terminal) {
      rooms.push({ room, terminal: room.terminal });
    }
  }
  return rooms;
}
function findBestTransfer(rooms) {
  for (const resource of SHARED_MINERALS) {
    const transfer2 = findResourceTransfer(rooms, resource);
    if (transfer2) {
      return transfer2;
    }
  }
  return null;
}
function findResourceTransfer(rooms, resource) {
  const requesters = rooms.map((entry) => ({
    entry,
    deficit: getRoomReserve(entry.room.name, resource) - getStoredAmount(entry.room, resource)
  })).filter(({ deficit }) => deficit >= REQUESTER_MIN_DEFICIT).sort((left, right) => right.deficit - left.deficit);
  for (const { entry: requester, deficit } of requesters) {
    const provider = findNearestProvider(rooms, requester, resource);
    if (!provider) {
      continue;
    }
    const amount = clampTransferAmount(
      Math.min(deficit, provider.surplus),
      requester,
      provider.entry,
      resource
    );
    if (amount >= MIN_TRANSFER_AMOUNT) {
      return {
        from: provider.entry,
        to: requester,
        resource,
        amount
      };
    }
  }
  return null;
}
function findNearestProvider(rooms, requester, resource) {
  var _a;
  return (_a = rooms.filter((entry) => entry.room.name !== requester.room.name).map((entry) => ({
    entry,
    // Only the surplus already in the terminal can actually be sent.
    surplus: Math.min(
      getStoredAmount(entry.room, resource) - getRoomReserve(entry.room.name, resource),
      entry.terminal.store[resource]
    )
  })).filter(
    (provider) => provider.surplus >= PROVIDER_MIN_SURPLUS && provider.entry.terminal.cooldown === 0
  ).sort(
    (left, right) => roomDistance(requester.room.name, left.entry.room.name) - roomDistance(requester.room.name, right.entry.room.name)
  )[0]) != null ? _a : null;
}
function clampTransferAmount(desired, requester, provider, resource) {
  let amount = Math.min(desired, MAX_TRANSFER_AMOUNT);
  amount = Math.min(amount, requester.terminal.store.getFreeCapacity(resource));
  if (amount < MIN_TRANSFER_AMOUNT) {
    return 0;
  }
  const availableEnergy = provider.terminal.store[RESOURCE_ENERGY];
  while (amount >= MIN_TRANSFER_AMOUNT) {
    const cost = Game.market.calcTransactionCost(
      amount,
      provider.room.name,
      requester.room.name
    );
    if (cost <= availableEnergy) {
      return amount;
    }
    amount -= MIN_TRANSFER_AMOUNT;
  }
  return 0;
}
function executeTransfer(transfer2) {
  const { from, to, resource, amount } = transfer2;
  const result = from.terminal.send(resource, amount, to.room.name);
  if (result === OK) {
    console.log(
      `Mineral logistics: sent ${amount} ${resource} from ${from.room.name} to ${to.room.name}`
    );
  } else {
    console.log(
      `Mineral logistics: failed to send ${amount} ${resource} from ${from.room.name} to ${to.room.name}: ${result}`
    );
  }
}
function roomDistance(a, b) {
  return Game.map.getRoomLinearDistance(a, b);
}

// src/managers/safeModeManager.ts
var CRITICAL_STRUCTURE_TYPES = /* @__PURE__ */ new Set([
  STRUCTURE_SPAWN,
  STRUCTURE_STORAGE,
  STRUCTURE_TOWER,
  STRUCTURE_TERMINAL
]);
var safeModeManager = {
  manageSafeMode() {
    var _a;
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!shouldActivateSafeMode(room)) {
        continue;
      }
      const result = (_a = room.controller) == null ? void 0 : _a.activateSafeMode();
      if (result === OK) {
        console.log(
          `Safe mode activated in ${room.name}: base under serious threat`
        );
      } else {
        console.log(`Safe mode activation in ${room.name} failed: ${result}`);
      }
    }
  }
};
function shouldActivateSafeMode(room) {
  var _a;
  const controller = room.controller;
  if (!(controller == null ? void 0 : controller.my)) {
    return false;
  }
  if (controller.safeMode || controller.safeModeCooldown) {
    return false;
  }
  if (((_a = controller.safeModeAvailable) != null ? _a : 0) === 0) {
    return false;
  }
  const hostiles = room.find(FIND_HOSTILE_CREEPS);
  if (!hasHostileCombatCreeps(room, hostiles)) {
    return false;
  }
  const committed = hostiles.some(isHostileNearCriticalStructure);
  const criticalDamaged = isCriticalStructureDamaged(room);
  if (!committed && !criticalDamaged) {
    return false;
  }
  const towersHandleIt = hostiles.every(
    (hostile) => canTowersOverpowerHostile(room, hostile, hostiles)
  );
  if (towersHandleIt && !criticalDamaged) {
    return false;
  }
  return true;
}
function isCriticalStructureDamaged(room) {
  return room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => CRITICAL_STRUCTURE_TYPES.has(structure.structureType) && structure.hits < structure.hitsMax
  }).length > 0;
}

// src/defenseSquad.ts
var MAX_DEFENSE_SQUAD_SIZE = 4;
function getDesiredDefenseSquadSize(hostiles) {
  const combatHostiles = hostiles.filter(isHostileCombatCreep).length;
  if (combatHostiles === 0) {
    return 0;
  }
  return Math.min(MAX_DEFENSE_SQUAD_SIZE, Math.max(2, combatHostiles));
}

// src/managers/expansionManager.ts
var EXPANSION_FAILURE_COOLDOWN_TICKS = CREEP_CLAIM_LIFE_TIME;
var MIN_USEFUL_CLAIMER_TICKS_TO_LIVE = 200;
function getSpawnRequest(room, energyBudget) {
  var _a;
  const targetRoom = findTargetRoom(room);
  if (!targetRoom) {
    return null;
  }
  const expansionRoom = Game.rooms[targetRoom];
  const expansionCreeps = Object.values(Game.creeps).filter(
    (creep) => creep.memory.targetRoom === targetRoom
  );
  const hasUsefulClaimer = expansionCreeps.some(
    (creep) => {
      var _a2;
      return creep.memory.role === CREEP_ROLE.CLAIMER && ((_a2 = creep.ticksToLive) != null ? _a2 : CREEP_CLAIM_LIFE_TIME) > MIN_USEFUL_CLAIMER_TICKS_TO_LIVE;
    }
  );
  if (!((_a = expansionRoom == null ? void 0 : expansionRoom.controller) == null ? void 0 : _a.my)) {
    if (hasUsefulClaimer || energyBudget < bodyCost(CREEP_BODY.CLAIMER)) {
      return null;
    }
    return {
      role: CREEP_ROLE.CLAIMER,
      body: CREEP_BODY.CLAIMER,
      memory: { targetRoom }
    };
  }
  const hasSettler = expansionCreeps.some(
    (creep) => creep.memory.role === CREEP_ROLE.SETTLER
  );
  if (hasSettler) {
    return null;
  }
  return {
    role: CREEP_ROLE.SETTLER,
    body: buildBodyFromMaxPattern({
      maxBody: CREEP_BODY.PIONEER,
      energyBudget
    }),
    memory: { targetRoom, working: false }
  };
}
function findTargetRoom(room) {
  var _a, _b;
  if (!((_a = room.controller) == null ? void 0 : _a.my) || room.controller.level <= 3) {
    return null;
  }
  const candidates = getAdjacentRoomNames(room.name).filter(isCandidate);
  const claimed = candidates.filter((name) => {
    var _a2, _b2;
    return (_b2 = (_a2 = Game.rooms[name]) == null ? void 0 : _a2.controller) == null ? void 0 : _b2.my;
  });
  return (_b = (claimed.length > 0 ? claimed : candidates).sort()[0]) != null ? _b : null;
}
function isCandidate(roomName) {
  if (!hasNonEmptyDefaultBuildPlan(roomName) || isTargetCoolingDown(roomName)) {
    return false;
  }
  const room = Game.rooms[roomName];
  if (!room) {
    return true;
  }
  return hasInspectableExpansionState(room) && !hasMySpawn(room);
}
function hasInspectableExpansionState(room) {
  const controller = room.controller;
  if (!controller) {
    return false;
  }
  if (controller.owner && !controller.my) {
    return false;
  }
  if (controller.reservation && controller.reservation.username !== getMyUsername()) {
    return false;
  }
  return room.find(FIND_HOSTILE_CREEPS).length === 0;
}
function hasNonEmptyDefaultBuildPlan(roomName) {
  var _a, _b;
  return ((_b = (_a = DEFAULT_BUILD_PLANS[roomName]) == null ? void 0 : _a.plan.length) != null ? _b : 0) > 0;
}
function hasMySpawn(room) {
  return room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_SPAWN
  }).length > 0;
}
function getMemory(roomName) {
  var _a, _b, _c;
  (_a = Memory.expansionTargets) != null ? _a : Memory.expansionTargets = {};
  (_c = (_b = Memory.expansionTargets)[roomName]) != null ? _c : _b[roomName] = {};
  return Memory.expansionTargets[roomName];
}
function isTargetCoolingDown(roomName) {
  var _a, _b;
  const memory = (_a = Memory.expansionTargets) == null ? void 0 : _a[roomName];
  if (!(memory == null ? void 0 : memory.failedUntilTick)) {
    return false;
  }
  const maxFailedUntilTick = ((_b = memory.lastAttemptTick) != null ? _b : memory.failedUntilTick) + EXPANSION_FAILURE_COOLDOWN_TICKS;
  memory.failedUntilTick = Math.min(memory.failedUntilTick, maxFailedUntilTick);
  if (memory.failedUntilTick <= Game.time) {
    delete memory.failedUntilTick;
    return false;
  }
  return true;
}
function recordSpawn(creepName, request) {
  var _a;
  const targetRoom = (_a = request.memory) == null ? void 0 : _a.targetRoom;
  if (!targetRoom || request.role !== CREEP_ROLE.CLAIMER && request.role !== CREEP_ROLE.SETTLER) {
    return;
  }
  const memory = getMemory(targetRoom);
  memory.lastAttemptTick = Game.time;
  delete memory.failedUntilTick;
  if (request.role === CREEP_ROLE.CLAIMER) {
    memory.claimerName = creepName;
  } else {
    memory.settlerName = creepName;
  }
}
function reconcileAttempts() {
  if (!Memory.expansionTargets) {
    return;
  }
  for (const roomName in Memory.expansionTargets) {
    reconcileAttempt(roomName, Memory.expansionTargets[roomName]);
  }
}
function reconcileAttempt(roomName, memory) {
  var _a, _b, _c;
  const room = Game.rooms[roomName];
  if (room && hasMySpawn(room)) {
    (_a = Memory.expansionTargets) == null ? true : delete _a[roomName];
    return;
  }
  const controllerMine = (_c = (_b = room == null ? void 0 : room.controller) == null ? void 0 : _b.my) != null ? _c : false;
  const claimerMissing = memory.claimerName !== void 0 && !Game.creeps[memory.claimerName];
  const settlerMissing = memory.settlerName !== void 0 && !Game.creeps[memory.settlerName];
  if (controllerMine) {
    if (claimerMissing) {
      delete memory.claimerName;
      delete memory.failedUntilTick;
    }
    if (settlerMissing) {
      delete memory.settlerName;
      memory.failedUntilTick = Game.time + EXPANSION_FAILURE_COOLDOWN_TICKS;
      console.log(
        `Settler for ${roomName} died; cooling down until tick ${memory.failedUntilTick}`
      );
    }
    return;
  }
  if (isTargetCoolingDown(roomName)) {
    return;
  }
  if (claimerMissing && !controllerMine) {
    memory.failedUntilTick = Game.time + EXPANSION_FAILURE_COOLDOWN_TICKS;
    delete memory.claimerName;
    delete memory.settlerName;
    console.log(
      `Expansion attempt for ${roomName} failed; cooling down until tick ${memory.failedUntilTick}`
    );
  }
}
function getMyUsername() {
  var _a, _b, _c, _d;
  return (_d = (_c = (_a = Game.spawns.Spawn1) == null ? void 0 : _a.owner.username) != null ? _c : (_b = Object.values(Game.creeps)[0]) == null ? void 0 : _b.owner.username) != null ? _d : null;
}
function getAdjacentRoomNames(roomName) {
  const position = parseRoomName(roomName);
  if (!position) {
    return [];
  }
  const roomNames = [];
  for (let xOffset = -1; xOffset <= 1; xOffset += 1) {
    for (let yOffset = -1; yOffset <= 1; yOffset += 1) {
      if (xOffset !== 0 || yOffset !== 0) {
        roomNames.push(
          serializeRoomName(position.x + xOffset, position.y + yOffset)
        );
      }
    }
  }
  return roomNames;
}
function parseRoomName(roomName) {
  const match = roomName.match(/^([WE])(\d+)([NS])(\d+)$/);
  if (!match) {
    return null;
  }
  const [
    ,
    horizontalDirection,
    horizontalDistance,
    verticalDirection,
    verticalDistance
  ] = match;
  return {
    x: horizontalDirection === "E" ? Number(horizontalDistance) : -Number(horizontalDistance) - 1,
    y: verticalDirection === "S" ? Number(verticalDistance) : -Number(verticalDistance) - 1
  };
}
function serializeRoomName(x, y) {
  const horizontal = x >= 0 ? `E${x}` : `W${-x - 1}`;
  const vertical = y >= 0 ? `S${y}` : `N${-y - 1}`;
  return `${horizontal}${vertical}`;
}
var expansionManager = {
  getSpawnRequest,
  reconcileAttempts,
  recordSpawn
};

// src/managers/roomLinkManager.ts
var MAX_NEIGHBOR_DISTANCE = 2;
function getRoomNeighbors(roomName) {
  var _a;
  const ownedRooms = getOwnedRoomNames();
  const version = [...ownedRooms].sort().join("|");
  if (Memory.ownedRoomLinksVersion !== version || !Memory.ownedRoomLinks || !Memory.ownedRoomRoutes) {
    Memory.ownedRoomLinks = buildRoomLinks(ownedRooms);
    Memory.ownedRoomRoutes = buildRoomRoutes(Memory.ownedRoomLinks);
    Memory.ownedRoomLinksVersion = version;
  }
  return ((_a = Memory.ownedRoomLinks[roomName]) != null ? _a : []).filter(
    (otherRoomName) => isCachedRouteSafe(roomName, otherRoomName)
  );
}
function getOwnedRoomNames() {
  return Object.values(Game.rooms).filter((room) => {
    var _a;
    return (_a = room.controller) == null ? void 0 : _a.my;
  }).map((room) => room.name);
}
function buildRoomLinks(ownedRooms) {
  const links = {};
  for (const roomName of ownedRooms) {
    links[roomName] = ownedRooms.filter((other) => {
      if (other === roomName) return false;
      return Game.map.getRoomLinearDistance(roomName, other) <= MAX_NEIGHBOR_DISTANCE;
    }).sort(
      (a, b) => Game.map.getRoomLinearDistance(roomName, a) - Game.map.getRoomLinearDistance(roomName, b)
    );
  }
  return links;
}
function buildRoomRoutes(links) {
  const routes = {};
  for (const [originRoomName, linkedRoomNames] of Object.entries(links)) {
    routes[originRoomName] = {};
    for (const targetRoomName of linkedRoomNames) {
      const route = Game.map.findRoute(originRoomName, targetRoomName);
      if (route === ERR_NO_PATH) continue;
      routes[originRoomName][targetRoomName] = route.map((step) => step.room);
    }
  }
  return routes;
}
function isCachedRouteSafe(originRoomName, targetRoomName) {
  var _a, _b;
  const route = (_b = (_a = Memory.ownedRoomRoutes) == null ? void 0 : _a[originRoomName]) == null ? void 0 : _b[targetRoomName];
  if (!route) return false;
  return [originRoomName, ...route].every((roomName) => {
    var _a2;
    const room = Game.rooms[roomName];
    return ((_a2 = room == null ? void 0 : room.controller) == null ? void 0 : _a2.my) === true && room.find(FIND_HOSTILE_CREEPS).length === 0;
  });
}

// src/managers/safeModeReplenishManager.ts
var GENERATOR_BODY = [
  ...Array(20).fill(CARRY),
  ...Array(10).fill(MOVE)
];
var GENERATOR_BODY_COST = 1500;
var safeModeReplenishManager = {
  getSpawnRequest(room, creepsByRole) {
    var _a;
    const controller = room.controller;
    if (!(controller == null ? void 0 : controller.my)) {
      return null;
    }
    if (((_a = controller.safeModeAvailable) != null ? _a : 0) >= getDesiredSafeModes(room.name)) {
      return null;
    }
    if (creepsByRole(CREEP_ROLE.SAFE_MODE_GENERATOR).length > 0) {
      return null;
    }
    if (room.energyCapacityAvailable < GENERATOR_BODY_COST) {
      return null;
    }
    if (getStoredAmount(room, RESOURCE_GHODIUM) < SAFE_MODE_GHODIUM_COST) {
      return null;
    }
    return {
      role: CREEP_ROLE.SAFE_MODE_GENERATOR,
      body: GENERATOR_BODY
    };
  }
};

// src/managers/spawnManager.ts
var FULL_HARVESTER_COST = bodyCost(CREEP_BODY.HARVESTER);
var BASE_CARRIER_CAPACITY_PER_SOURCE = 400;
var EXTRA_CARRIER_HAULABLE_ENERGY_PER_SOURCE = 1400;
var MAX_BASE_CARRIERS = 4;
var MAX_CARRIERS_PER_ROOM = 5;
var ATTACK_CARRIER_TARGET = 3;
var EXTRA_CARRIER_PROBE_INTERVAL = 100;
var MIN_COMBAT_BODY_SIZE = 3;
var BOOST_DEADLINE_TICKS = 60;
var SURPLUS_CONTROLLER_CONTAINER_ENERGY = 1200;
var DISCRETIONARY_PROBE_INTERVAL = 100;
var BUILDER_CAP = 3;
var UPGRADER_CAP = 3;
var spawnManager = {
  manageSpawning() {
    expansionManager.reconcileAttempts();
    for (const spawn of getOwnedSpawns()) {
      if (spawn.spawning) {
        continue;
      }
      const room = spawn.room;
      const creeps = Object.values(Game.creeps).filter(
        (creep) => creep.room.name === room.name && (!creep.memory.targetRoom || creep.memory.targetRoom === room.name)
      );
      const creepsByRole = groupCreepsByRole(creeps);
      const sources = room.find(FIND_SOURCES);
      const hostiles = room.find(FIND_HOSTILE_CREEPS);
      const decision = this.getSpawnRequest({
        room,
        creeps,
        creepsByRole,
        sources,
        hostiles
      });
      if (decision === SPAWN_HOLD) {
        continue;
      }
      const request = decision != null ? decision : getCrossRoomHarvesterRequest(spawn);
      if (!request || !canAfford(spawn, request.body)) {
        continue;
      }
      const newName = `${request.role}-${spawn.name}-${Game.time}`;
      const result = spawn.spawnCreep(request.body, newName, {
        memory: { role: request.role, ...request.memory }
      });
      if (result === OK) {
        console.log(
          `Spawning new ${request.role} at ${spawn.name}: ${newName}`
        );
        expansionManager.recordSpawn(newName, request);
      }
    }
  },
  getSpawnRequest(context) {
    const { room, creeps, creepsByRole, sources, hostiles } = context;
    const harvesters = creepsByRole(CREEP_ROLE.HARVESTER);
    const carriers = creepsByRole(CREEP_ROLE.CARRIER);
    const builders = creepsByRole(CREEP_ROLE.BUILDER);
    const repairers = creepsByRole(CREEP_ROLE.REPAIRER);
    const upgraders = creepsByRole(CREEP_ROLE.UPGRADER);
    const availableEnergy = room.energyAvailable;
    const capacityEnergy = room.energyCapacityAvailable;
    const harvesterEnergyBudget = harvesters.length === 0 ? availableEnergy : capacityEnergy;
    if (creeps.length === 0) {
      return {
        role: CREEP_ROLE.PIONEER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.PIONEER,
          energyBudget: availableEnergy
        })
      };
    }
    if (isRoomUnderUnsafeAttack(room, hostiles)) {
      return getUnsafeAttackDecision(context);
    }
    if (harvesters.length > 0 && carriers.length === 0) {
      return {
        role: CREEP_ROLE.CARRIER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.CARRIER,
          energyBudget: availableEnergy
        }),
        memory: { working: false }
      };
    }
    const unclaimedSource = findUnclaimedHarvesterSource(room);
    if (unclaimedSource) {
      if (capacityEnergy < FULL_HARVESTER_COST && hasAvailableNeighborSpawn(room)) {
        return null;
      }
      return {
        role: CREEP_ROLE.HARVESTER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.HARVESTER,
          energyBudget: harvesterEnergyBudget
        }),
        memory: { sourceId: unclaimedSource.id }
      };
    }
    const haulableEnergy = getHaulableEnergy(room);
    const desiredCarriers = getDesiredCarrierCount(
      room,
      sources,
      carriers,
      haulableEnergy
    );
    const needsBaseCarrierCapacity = needsMoreBaseCarrierCapacity(
      sources,
      carriers
    );
    if (harvesters.length > 0 && (needsBaseCarrierCapacity || carriers.length < desiredCarriers)) {
      return {
        role: CREEP_ROLE.CARRIER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.CARRIER,
          energyBudget: capacityEnergy
        }),
        memory: { working: false }
      };
    }
    const expansionRequest = expansionManager.getSpawnRequest(
      room,
      capacityEnergy
    );
    if (expansionRequest) {
      return expansionRequest;
    }
    const labTechRequest = labManager.getSpawnRequest(room, creepsByRole);
    if (labTechRequest) {
      return labTechRequest;
    }
    const safeModeRequest = safeModeReplenishManager.getSpawnRequest(
      room,
      creepsByRole
    );
    if (safeModeRequest) {
      return safeModeRequest;
    }
    const { desiredBuilders, desiredUpgraders } = getDiscretionaryPlan(
      room,
      builders,
      upgraders
    );
    if (hasConstructionWork(room) && builders.length < desiredBuilders) {
      return {
        role: CREEP_ROLE.BUILDER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.WORKER,
          energyBudget: capacityEnergy
        })
      };
    }
    const desiredRepairers = getDesiredRepairerCount(room);
    if (repairers.length < desiredRepairers) {
      return {
        role: CREEP_ROLE.REPAIRER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.WORKER,
          energyBudget: capacityEnergy
        })
      };
    }
    if (harvesters.length >= sources.length && carriers.length > 0 && upgraders.length < desiredUpgraders) {
      return {
        role: CREEP_ROLE.UPGRADER,
        body: buildBodyFromMaxPattern({
          maxBody: CREEP_BODY.UPGRADER,
          energyBudget: capacityEnergy
        })
      };
    }
    return null;
  }
};
function getOwnedSpawns() {
  return Object.values(Game.spawns).sort((left, right) => {
    if (left.room.name !== right.room.name) {
      return left.room.name.localeCompare(right.room.name);
    }
    return left.name.localeCompare(right.name);
  });
}
function groupCreepsByRole(creeps) {
  var _a;
  const creepsByRole = /* @__PURE__ */ new Map();
  for (const creep of creeps) {
    if (creep.memory.remoteOperate !== void 0 && Game.time < creep.memory.remoteOperate) {
      continue;
    }
    const group = (_a = creepsByRole.get(creep.memory.role)) != null ? _a : [];
    group.push(creep);
    creepsByRole.set(creep.memory.role, group);
  }
  return (role) => {
    var _a2;
    return (_a2 = creepsByRole.get(role)) != null ? _a2 : [];
  };
}
function canAfford(spawn, body) {
  return spawn.room.energyAvailable >= bodyCost(body);
}
function getUnsafeAttackDecision(context) {
  const { creepsByRole, room } = context;
  const economyRequest = getEssentialEconomyRequest(context);
  if (economyRequest) {
    return economyRequest;
  }
  if (creepsByRole(CREEP_ROLE.CARRIER).length < ATTACK_CARRIER_TARGET) {
    return {
      role: CREEP_ROLE.CARRIER,
      body: buildBodyFromMaxPattern({
        maxBody: CREEP_BODY.CARRIER,
        energyBudget: room.energyCapacityAvailable
      }),
      memory: { working: false }
    };
  }
  const defenderDecision = getDefenderDecision(context);
  if (defenderDecision !== null && defenderDecision !== SPAWN_HOLD) {
    return defenderDecision;
  }
  return SPAWN_HOLD;
}
function getDefenderDecision(context) {
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
    sortBody: sortCombatBody
  });
  if (room.energyAvailable < bodyCost(body)) {
    return SPAWN_HOLD;
  }
  return {
    role: CREEP_ROLE.RANGED_DEFENDER,
    body,
    memory: getDefenderBoostMemory(room, body)
  };
}
function getEssentialEconomyRequest(context) {
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
      energyBudget: room.energyAvailable
    }),
    memory: { sourceId: source.id }
  };
}
function getDefenderBoostMemory(room, body) {
  const toughParts = body.filter((part) => part === TOUGH).length;
  if (toughParts === 0 || !findReadyBoostLab(room, toughParts)) {
    return void 0;
  }
  return { wantsBoost: true, boostDeadline: Game.time + BOOST_DEADLINE_TICKS };
}
function sortCombatBody(body) {
  const bodyPartOrder = [
    TOUGH,
    MOVE,
    ATTACK,
    RANGED_ATTACK,
    HEAL,
    WORK,
    CARRY,
    CLAIM
  ];
  const bodyPartCounts = {
    [TOUGH]: 0,
    [ATTACK]: 0,
    [RANGED_ATTACK]: 0,
    [HEAL]: 0,
    [WORK]: 0,
    [CARRY]: 0,
    [CLAIM]: 0,
    [MOVE]: 0
  };
  for (const part of body) {
    bodyPartCounts[part] += 1;
  }
  bodyPartCounts[MOVE] -= 1;
  return [
    ...bodyPartOrder.flatMap((part) => Array(bodyPartCounts[part]).fill(part)),
    MOVE
  ];
}
function hasConstructionWork(room) {
  return room.find(FIND_CONSTRUCTION_SITES).length > 0;
}
function getHaulableEnergy(room) {
  const controllerDeliveryContainer = getControllerDeliveryContainer(room);
  const droppedEnergy = room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount >= 50
  }).reduce((total, resource) => total + resource.amount, 0);
  const containerEnergy = room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.id !== (controllerDeliveryContainer == null ? void 0 : controllerDeliveryContainer.id) && structure.store[RESOURCE_ENERGY] >= 50
  }).reduce((total, container) => total + container.store[RESOURCE_ENERGY], 0);
  const tombstoneEnergy = room.find(FIND_TOMBSTONES).reduce((total, tombstone) => total + tombstone.store[RESOURCE_ENERGY], 0);
  const ruinEnergy = room.find(FIND_RUINS).reduce((total, ruin) => total + ruin.store[RESOURCE_ENERGY], 0);
  return droppedEnergy + containerEnergy + tombstoneEnergy + ruinEnergy;
}
function getCarrierCapacity(carriers) {
  return carriers.reduce(
    (total, carrier2) => total + carrier2.store.getCapacity(RESOURCE_ENERGY),
    0
  );
}
function needsMoreBaseCarrierCapacity(sources, carriers) {
  return carriers.length < MAX_BASE_CARRIERS && getCarrierCapacity(carriers) < sources.length * BASE_CARRIER_CAPACITY_PER_SOURCE;
}
function getDesiredCarrierCount(room, sources, carriers, haulableEnergy) {
  var _a;
  const baseCarriers = sources.length > 1 || haulableEnergy > 0 ? 2 : 1;
  let desiredCarriers = Math.max(
    (_a = room.memory.desiredCarriers) != null ? _a : baseCarriers,
    baseCarriers
  );
  if (Game.time % EXTRA_CARRIER_PROBE_INTERVAL === 0) {
    const isHaulSurplus = haulableEnergy > sources.length * EXTRA_CARRIER_HAULABLE_ENERGY_PER_SOURCE;
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
function getDiscretionaryPlan(room, builders, upgraders) {
  var _a, _b;
  let desiredBuilders = (_a = room.memory.desiredBuilders) != null ? _a : 1;
  let desiredUpgraders = (_b = room.memory.desiredUpgraders) != null ? _b : 1;
  if (Game.time % DISCRETIONARY_PROBE_INTERVAL === 0) {
    const hasWork = hasConstructionWork(room);
    if (isSurplusEconomy(room)) {
      if (hasWork && desiredBuilders < BUILDER_CAP && builders.length >= desiredBuilders) {
        desiredBuilders += 1;
      } else if (desiredUpgraders < UPGRADER_CAP && upgraders.length >= desiredUpgraders) {
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
function isSurplusEconomy(room) {
  return getControllerContainerEnergy(room) >= SURPLUS_CONTROLLER_CONTAINER_ENERGY;
}
function getControllerContainerEnergy(room) {
  var _a, _b;
  return (_b = (_a = getControllerDeliveryContainer(room)) == null ? void 0 : _a.store[RESOURCE_ENERGY]) != null ? _b : 0;
}
function findUnclaimedHarvesterSource(room) {
  const sources = room.find(FIND_SOURCES);
  const allHarvesters = Object.values(Game.creeps).filter(
    (c) => c.memory.role === CREEP_ROLE.HARVESTER
  );
  for (const source of sources) {
    const hasAssigned = allHarvesters.some(
      (creep) => creep.memory.sourceId === source.id
    );
    if (!hasAssigned) {
      return source;
    }
  }
  return null;
}
function hasAvailableNeighborSpawn(room) {
  if (!canReceiveCrossRoomHarvester(room)) {
    return false;
  }
  const neighbors = getRoomNeighbors(room.name);
  for (const neighborName of neighbors) {
    const neighborRoom = Game.rooms[neighborName];
    if (!neighborRoom) continue;
    const spawns = neighborRoom.find(FIND_MY_SPAWNS);
    for (const spawn of spawns) {
      if (!spawn.spawning && neighborRoom.energyAvailable >= FULL_HARVESTER_COST) {
        return true;
      }
    }
  }
  return false;
}
function canReceiveCrossRoomHarvester(room) {
  var _a;
  return ((_a = room.controller) == null ? void 0 : _a.my) === true && room.find(FIND_HOSTILE_CREEPS).length === 0 && room.find(FIND_MY_SPAWNS).length > 0;
}
function getCrossRoomHarvesterRequest(spawn) {
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
        memory: { sourceId: unclaimedSource.id, targetRoom: neighborName }
      };
    }
  }
  return null;
}

// src/managers/spawnRecoveryManager.ts
function getPrimarySpawnSite(room) {
  var _a;
  const plan = getPrimarySpawnBuildPlan(room);
  if (!plan) {
    return null;
  }
  const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, plan.x, plan.y);
  return (_a = sites.find(
    (site) => site.my && site.structureType === STRUCTURE_SPAWN
  )) != null ? _a : null;
}
function isPrimarySpawnMissing(room) {
  var _a;
  const plan = getPrimarySpawnBuildPlan(room);
  if (!((_a = room.controller) == null ? void 0 : _a.my) || !plan) {
    return false;
  }
  const plannedSpawn = room.lookForAt(LOOK_STRUCTURES, plan.x, plan.y).find(
    (structure) => structure.structureType === STRUCTURE_SPAWN && structure.my
  );
  return !plannedSpawn;
}
function canRebuildSpawn(creep) {
  return creep.getActiveBodyparts(WORK) > 0 && creep.getActiveBodyparts(CARRY) > 0 && creep.getActiveBodyparts(MOVE) > 0;
}
function convertRebuildersToPioneers(room) {
  for (const creep of room.find(FIND_MY_CREEPS)) {
    if (creep.memory.role === CREEP_ROLE.PIONEER || creep.memory.role === CREEP_ROLE.SETTLER || !canRebuildSpawn(creep)) {
      continue;
    }
    creep.memory.role = CREEP_ROLE.PIONEER;
    creep.memory.working = creep.hasEnergy();
    delete creep.memory.sourceId;
    delete creep.memory.energyTargetId;
    delete creep.memory.deliveryTargetId;
    console.log(
      `Spawn recovery reassigned ${creep.name} to ${CREEP_ROLE.PIONEER}`
    );
  }
}
var spawnRecoveryManager = {
  manageSpawnRecovery() {
    for (const roomName in Game.rooms) {
      const room = Game.rooms[roomName];
      if (!isPrimarySpawnMissing(room)) {
        continue;
      }
      convertRebuildersToPioneers(room);
    }
  }
};

// src/managers/towerManager.ts
var TOWER_REPAIR_RESERVE = 200;
var THREATENED_RAMPART_RANGE = 3;
var towerManager = {
  manageTowers() {
    for (const roomName in Game.rooms) {
      this.manageRoomTowers(Game.rooms[roomName]);
    }
  },
  manageRoomTowers(room) {
    var _a, _b, _c;
    const towers = room.find(FIND_MY_STRUCTURES, {
      filter: (structure) => structure.structureType === STRUCTURE_TOWER
    });
    if (towers.length === 0) {
      return;
    }
    const hostiles = room.find(FIND_HOSTILE_CREEPS);
    const underAttack = hasHostileCombatCreeps(room, hostiles);
    const defenderAttack = findDefenderAttack(room, hostiles);
    const towerTarget = findLockedTowerTarget(room, hostiles, towers[0].pos);
    const defenderTarget = (_a = defenderAttack == null ? void 0 : defenderAttack.target) != null ? _a : null;
    const target = defenderTarget && shouldTowersFireAtHostile(
      room,
      defenderTarget,
      hostiles,
      (_b = defenderAttack == null ? void 0 : defenderAttack.damage) != null ? _b : 0
    ) ? defenderTarget : towerTarget;
    const shouldFire = target !== null && shouldTowersFireAtHostile(
      room,
      target,
      hostiles,
      target === defenderTarget ? (_c = defenderAttack == null ? void 0 : defenderAttack.damage) != null ? _c : 0 : 0
    );
    const repairTarget = !shouldFire && underAttack ? findThreatenedRampart(room, hostiles) : null;
    const woundedDefender = underAttack ? findMostWoundedCombatCreep(room) : null;
    const woundedFriendly = woundedDefender || shouldFire || repairTarget ? null : findMostWoundedFriendly(room);
    for (const tower of towers) {
      if (woundedDefender) {
        tower.heal(woundedDefender);
        continue;
      }
      if (shouldFire && target) {
        tower.attack(target);
        continue;
      }
      if (repairTarget && tower.store[RESOURCE_ENERGY] > TOWER_REPAIR_RESERVE) {
        tower.repair(repairTarget);
        continue;
      }
      if (woundedFriendly) {
        tower.heal(woundedFriendly);
      }
    }
  }
};
function findLockedTowerTarget(room, hostiles, origin) {
  if (hostiles.length === 0) {
    delete room.memory.towerTargetId;
    return null;
  }
  const highestPriority = hostiles.reduce(
    (priority, hostile) => Math.min(priority, getHostilePriority(hostile)),
    Infinity
  );
  const locked = room.memory.towerTargetId ? hostiles.find((hostile) => hostile.id === room.memory.towerTargetId) : void 0;
  if (locked && getHostilePriority(locked) === highestPriority) {
    return locked;
  }
  const target = findPriorityHostile(room, origin);
  if (target) {
    room.memory.towerTargetId = target.id;
  } else {
    delete room.memory.towerTargetId;
  }
  return target;
}
function findThreatenedRampart(room, hostiles) {
  const threatened = room.find(FIND_MY_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_RAMPART && structure.hits < structure.hitsMax && hostiles.some(
      (hostile) => hostile.pos.inRangeTo(structure, THREATENED_RAMPART_RANGE)
    )
  });
  return threatened.reduce((weakest, rampart) => {
    if (!weakest || rampart.hits < weakest.hits) {
      return rampart;
    }
    return weakest;
  }, null);
}
function findMostWoundedCombatCreep(room) {
  return findMostWoundedFriendly(
    room,
    (creep) => hasActiveCombatBodyparts(creep)
  );
}
function findMostWoundedFriendly(room, filter = () => true) {
  return room.find(FIND_MY_CREEPS, {
    filter: (creep) => creep.hits < creep.hitsMax && filter(creep)
  }).reduce((mostWounded, creep) => {
    if (!mostWounded || creep.hitsMax - creep.hits > mostWounded.hitsMax - mostWounded.hits) {
      return creep;
    }
    return mostWounded;
  }, null);
}
function hasActiveCombatBodyparts(creep) {
  return creep.getActiveBodyparts(ATTACK) > 0 || creep.getActiveBodyparts(RANGED_ATTACK) > 0 || creep.getActiveBodyparts(HEAL) > 0;
}

// src/roles/support/spawns.ts
function findSameRoomSpawn(creep) {
  return creep.pos.findClosestByRange(FIND_MY_SPAWNS);
}

// src/roles/support/civilianSafety.ts
var PATH_STYLE2 = { stroke: "#ffaa00" };
function standDownIfUnderAttack(creep) {
  if (!isRoomUnderUnsafeAttack(creep.room)) {
    return false;
  }
  const spawn = findSameRoomSpawn(creep);
  if (!spawn) {
    creep.moveOffRoad();
    return true;
  }
  if (!creep.pos.isNearTo(spawn)) {
    creep.moveToAvoidingRoomEdges(spawn, { visualizePathStyle: PATH_STYLE2 });
    return true;
  }
  spawn.recycleCreep(creep);
  return true;
}

// src/roles/support/repairWork.ts
function clearRepairTarget(creep) {
  delete creep.memory.repairTargetId;
}
function getSavedRepairTarget(creep) {
  if (!creep.memory.repairTargetId) {
    return null;
  }
  const target = Game.getObjectById(creep.memory.repairTargetId);
  if (target && target.hits < target.hitsMax && !isRepairTargetContested(target, creep.room)) {
    return target;
  }
  clearRepairTarget(creep);
  return null;
}
function findRepairTarget(creep) {
  const savedTarget = getSavedRepairTarget(creep);
  if (savedTarget) {
    return savedTarget;
  }
  const bestTarget = findBestRepairTargetForCreep(creep);
  if (bestTarget) {
    creep.memory.repairTargetId = bestTarget.id;
  }
  return bestTarget;
}
function moveToBestRepairTargetForCreep(creep) {
  const target = findBestRepairTargetForCreep(creep);
  if (!target) {
    return false;
  }
  creep.memory.repairTargetId = target.id;
  creep.moveToWorkTarget(target, ERR_NOT_IN_RANGE, 3, {
    visualizePathStyle: { stroke: "#ffaa00" }
  });
  return true;
}
function repairFreshDefense(creep) {
  const target = findFreshDefenseForCreep(creep);
  if (!target) {
    return false;
  }
  creep.moveToWorkTarget(target, creep.repair(target), 3, {
    visualizePathStyle: { stroke: "#ffaa00" }
  });
  return true;
}
function repairBestTarget(creep) {
  const target = findRepairTarget(creep);
  if (!target) {
    if (!moveToBestRepairTargetForCreep(creep)) {
      creep.moveOffRoad();
    }
    return false;
  }
  const result = creep.repair(target);
  creep.moveToWorkTarget(target, result, 3, {
    visualizePathStyle: { stroke: "#ffaa00" }
  });
  if (result === OK && !creep.hasEnergy()) {
    clearRepairTarget(creep);
  }
  return true;
}

// src/roles/support/localEnergy.ts
var LOCAL_ENERGY_RANGE = 5;
function collectLocalEnergy(creep) {
  const droppedEnergy = creep.pos.findClosestByRange(
    creep.pos.findInRange(FIND_DROPPED_RESOURCES, LOCAL_ENERGY_RANGE, {
      filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 0 && !isPositionInHostileWeaponRange(resource.pos)
    })
  );
  if (droppedEnergy) {
    creep.pickUpEnergy(droppedEnergy);
    return true;
  }
  const container = creep.pos.findClosestByRange(
    creep.pos.findInRange(FIND_STRUCTURES, LOCAL_ENERGY_RANGE, {
      filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && structure.store[RESOURCE_ENERGY] > 0 && !isPositionInHostileWeaponRange(structure.pos)
    })
  );
  if (container) {
    creep.withdrawEnergyFrom(container);
    return true;
  }
  return false;
}

// src/roles/support/workRefuelLoop.ts
function runWorkRefuelLoop(creep, work, idle = (idleCreep) => {
  idleCreep.moveOffRoad();
}) {
  if (creep.memory.working && !creep.hasEnergy()) {
    creep.memory.working = false;
  }
  if (!creep.memory.working && creep.hasFullEnergy()) {
    creep.memory.working = true;
    creep.clearEnergyTarget();
  }
  if (creep.memory.working) {
    work(creep);
    return;
  }
  if (collectLocalEnergy(creep)) {
    return;
  }
  if (creep.hasEnergy()) {
    creep.memory.working = true;
    creep.clearEnergyTarget();
    work(creep);
    return;
  }
  idle(creep);
}

// src/roles/builder.ts
function build(creep) {
  if (repairFreshDefense(creep)) {
    return;
  }
  if (creep.findAndBuild()) {
    return;
  }
  if (repairBestTarget(creep)) {
    return;
  }
  creep.moveOffRoad();
}
var builder = {
  run(creep) {
    if (standDownIfUnderAttack(creep)) {
      return;
    }
    runWorkRefuelLoop(creep, build);
  }
};

// src/roles/carrier/defenseDelivery.ts
function chooseDefenseDeliveryTarget(committedBreach, emergencyTower, savedTarget) {
  if (committedBreach && emergencyTower) {
    return emergencyTower;
  }
  return savedTarget;
}

// src/roles/carrier/loot.ts
var TERMINAL_LOOT_RESERVE = 5e4;
var STAGING_TERMINAL_CAP = 1e4;
var MIN_STAGING_AMOUNT = 200;
function getNonEnergyResourceInStore(store) {
  var _a;
  return (_a = RESOURCES_ALL.find(
    (resourceType) => resourceType !== RESOURCE_ENERGY && store.getUsedCapacity(resourceType) > 0
  )) != null ? _a : null;
}
function isDroppedNonEnergyResource(target) {
  return target.resourceType !== RESOURCE_ENERGY && target.amount > 0 && !isPositionInHostileWeaponRange(target.pos);
}
function findResourceLootDeliveryTarget(creep, resource = null) {
  const { storage, terminal } = creep.room;
  if (resource && isSharedMineral(resource) && terminal && terminal.store.getUsedCapacity(resource) < TERMINAL_LOOT_RESERVE && terminal.store.getFreeCapacity() > 0) {
    return terminal;
  }
  if (storage && storage.store.getFreeCapacity() > 0) {
    return storage;
  }
  if (terminal && terminal.store.getFreeCapacity() > 0) {
    return terminal;
  }
  return null;
}
function findResourceLootTarget(creep) {
  const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: isDroppedNonEnergyResource
  });
  const ruins = creep.room.find(FIND_RUINS, {
    filter: (target) => getNonEnergyResourceInStore(target.store) !== null && !isPositionInHostileWeaponRange(target.pos)
  });
  const tombstones = creep.room.find(FIND_TOMBSTONES, {
    filter: (target) => getNonEnergyResourceInStore(target.store) !== null && !isPositionInHostileWeaponRange(target.pos)
  });
  return creep.pos.findClosestByPath([
    ...droppedResources,
    ...ruins,
    ...tombstones
  ]);
}
function collectResourceLoot(creep) {
  if (creep.store.getFreeCapacity() === 0) {
    return false;
  }
  if (!findResourceLootDeliveryTarget(creep)) {
    return false;
  }
  const lootTarget = findResourceLootTarget(creep);
  if (!lootTarget) {
    return false;
  }
  if ("amount" in lootTarget) {
    const result2 = creep.pickup(lootTarget);
    if (result2 === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(lootTarget, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
      return true;
    }
    return result2 === OK;
  }
  const resourceType = getNonEnergyResourceInStore(lootTarget.store);
  if (!resourceType) {
    return false;
  }
  const result = creep.withdraw(lootTarget, resourceType);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(lootTarget, {
      visualizePathStyle: { stroke: "#ffaa00" }
    });
    return true;
  }
  return result === OK;
}
function deliverResourceLoot(creep) {
  const resourceType = getNonEnergyResourceInStore(creep.store);
  if (!resourceType) {
    return false;
  }
  const deliveryTarget = findResourceLootDeliveryTarget(creep, resourceType);
  if (!deliveryTarget) {
    return false;
  }
  const amount = Math.min(
    creep.store.getUsedCapacity(resourceType),
    deliveryTarget.store.getFreeCapacity()
  );
  const result = creep.transfer(deliveryTarget, resourceType, amount);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(deliveryTarget, {
      visualizePathStyle: { stroke: "#ffffff" }
    });
    return true;
  }
  return result === OK;
}
function collectStorageStagingMineral(creep) {
  const { storage, terminal } = creep.room;
  if (!storage || !terminal || creep.store.getFreeCapacity() === 0 || terminal.store.getFreeCapacity() === 0 || // Don't mix loads: only stage when not already carrying a mineral.
  getNonEnergyResourceInStore(creep.store) !== null) {
    return false;
  }
  for (const resource of SHARED_MINERALS) {
    const inStorage = storage.store[resource];
    if (inStorage === 0) {
      continue;
    }
    const total = inStorage + terminal.store[resource];
    const surplus = total - getRoomReserve(creep.room.name, resource);
    const desiredInTerminal = Math.min(
      Math.max(surplus, 0),
      STAGING_TERMINAL_CAP
    );
    const needToStage = desiredInTerminal - terminal.store[resource];
    if (needToStage < MIN_STAGING_AMOUNT) {
      continue;
    }
    const amount = Math.min(
      needToStage,
      inStorage,
      creep.store.getFreeCapacity()
    );
    if (amount < MIN_STAGING_AMOUNT) {
      continue;
    }
    const result = creep.withdraw(storage, resource, amount);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(storage, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
    }
    return true;
  }
  return false;
}

// src/roles/carrier/carrier.ts
var MIN_DELIVERY_ENERGY_RATIO = 0.1;
var STORAGE_ENERGY_RESERVE = 5e4;
var TERMINAL_ENERGY_TARGET = 2e4;
var TOWER_WARTIME_RESERVE = 700;
var EMPTY_TOWER_THRESHOLD = 1;
var CARRIER_REFILL_MOVE_OPTS = {
  reusePath: 10,
  visualizePathStyle: { stroke: "#ffaa00" }
};
var CARRIER_DELIVERY_MOVE_OPTS = {
  reusePath: 10,
  visualizePathStyle: { stroke: "#ffffff" }
};
var NEARBY_DROPPED_ENERGY_RANGE = 5;
var MIN_DROPPED_ENERGY_PER_RANGE = 10;
var DECAYING_REFILL_SCORE_BONUS = 8;
var FULL_REFILL_SCORE_BONUS = 3;
var MAX_PARTIAL_REFILL_SCORE_PENALTY = 6;
var DECAYING_REFILL_PROBE_INTERVAL = 10;
var WORKER_REFUEL_ROLES = /* @__PURE__ */ new Set([
  CREEP_ROLE.PIONEER,
  CREEP_ROLE.BUILDER,
  CREEP_ROLE.REPAIRER,
  CREEP_ROLE.UPGRADER
]);
var WORKER_REFUEL_ROLE_PENALTY = {
  [CREEP_ROLE.PIONEER]: 0,
  [CREEP_ROLE.BUILDER]: 0,
  [CREEP_ROLE.REPAIRER]: 4,
  [CREEP_ROLE.UPGRADER]: 8
};
var reservationState = null;
function addReservation(reservations, targetId, amount) {
  var _a;
  if (!targetId || amount <= 0) {
    return;
  }
  reservations[targetId] = ((_a = reservations[targetId]) != null ? _a : 0) + amount;
}
function getCarrierReservationState() {
  if ((reservationState == null ? void 0 : reservationState.tick) === Game.time) {
    return reservationState;
  }
  const refillCapacityByTargetId = {};
  const deliveryEnergyByTargetId = {};
  for (const otherCreep of Object.values(Game.creeps)) {
    addReservation(
      refillCapacityByTargetId,
      otherCreep.memory.energyTargetId,
      otherCreep.store.getFreeCapacity(RESOURCE_ENERGY)
    );
    addReservation(
      deliveryEnergyByTargetId,
      otherCreep.memory.deliveryTargetId,
      otherCreep.store[RESOURCE_ENERGY]
    );
  }
  reservationState = {
    tick: Game.time,
    refillCapacityByTargetId,
    deliveryEnergyByTargetId
  };
  return reservationState;
}
function getEnergyRatio(creep) {
  return creep.store[RESOURCE_ENERGY] / creep.store.getCapacity(RESOURCE_ENERGY);
}
function collectAdjacentDroppedEnergy(creep, container) {
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
    return false;
  }
  const droppedEnergy = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
    filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 0 && resource.pos.inRangeTo(container, 1) && isCarrierRefillTarget(creep, resource)
  }).reduce(
    (bestResource, resource) => !bestResource || resource.amount > bestResource.amount ? resource : bestResource,
    null
  );
  return droppedEnergy ? creep.pickup(droppedEnergy) === OK : false;
}
function collectEnergy(creep, energyTarget = findCarrierEnergyRefillTarget(
  creep
)) {
  if (energyTarget && "amount" in energyTarget) {
    const result = creep.pickup(energyTarget);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(energyTarget, CARRIER_REFILL_MOVE_OPTS);
      return true;
    }
    return result === OK;
  }
  if (energyTarget) {
    if ("structureType" in energyTarget && energyTarget.structureType === STRUCTURE_CONTAINER && collectAdjacentDroppedEnergy(creep, energyTarget)) {
      return true;
    }
    const result = creep.withdraw(energyTarget, RESOURCE_ENERGY);
    if (result === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(energyTarget, CARRIER_REFILL_MOVE_OPTS);
      return true;
    }
    return result === OK;
  }
  return false;
}
function getRefillEnergyAmount2(target) {
  if ("amount" in target) {
    return target.resourceType === RESOURCE_ENERGY ? target.amount : 0;
  }
  return target.store[RESOURCE_ENERGY];
}
function hasRefillEnergy2(target) {
  return getRefillEnergyAmount2(target) > 0;
}
function getAvailableRefillEnergy(creep, target) {
  return Math.max(
    0,
    getRefillEnergyAmount2(target) - getReservedRefillCapacity(creep, target)
  );
}
function canFullyRefillFromTarget(creep, target) {
  return getAvailableRefillEnergy(creep, target) >= creep.store.getFreeCapacity(RESOURCE_ENERGY);
}
function isStorageTarget(target) {
  return "structureType" in target && target.structureType === STRUCTURE_STORAGE;
}
function isTargetInCreepRoom(creep, target) {
  return target.pos.roomName === creep.room.name;
}
function isTowerBelowWartimeReserve(target) {
  return target.store[RESOURCE_ENERGY] < TOWER_WARTIME_RESERVE;
}
function isUrgentAttackDeliveryTarget(target) {
  if (!target || !("structureType" in target)) {
    return false;
  }
  return target.structureType === STRUCTURE_SPAWN || target.structureType === STRUCTURE_EXTENSION || target.structureType === STRUCTURE_TOWER && isTowerBelowWartimeReserve(target);
}
function hasNearbyWorker(resource) {
  return resource.pos.findInRange(FIND_MY_CREEPS, LOCAL_ENERGY_RANGE, {
    filter: (creep) => WORKER_REFUEL_ROLES.has(creep.memory.role)
  }).length > 0;
}
function isDroppedEnergyReservedForWorker(target) {
  return "amount" in target && target.resourceType === RESOURCE_ENERGY && hasNearbyWorker(target);
}
function isWorthCarrierDroppedEnergyTrip(creep, target) {
  if (!("amount" in target)) {
    return true;
  }
  const range = creep.pos.getRangeTo(target);
  return range <= NEARBY_DROPPED_ENERGY_RANGE || target.amount >= range * MIN_DROPPED_ENERGY_PER_RANGE;
}
function getReservedRefillCapacity(creep, target) {
  var _a;
  const reserved = (_a = getCarrierReservationState().refillCapacityByTargetId[target.id]) != null ? _a : 0;
  if (creep.memory.energyTargetId !== target.id) {
    return reserved;
  }
  return Math.max(0, reserved - creep.store.getFreeCapacity(RESOURCE_ENERGY));
}
function isRefillTargetReservedByOtherCreep(creep, target) {
  return getAvailableRefillEnergy(creep, target) === 0;
}
function isCarrierRefillTarget(creep, target) {
  return hasRefillEnergy2(target) && !isStorageTarget(target) && !isPositionInHostileWeaponRange(target.pos) && isWorthCarrierDroppedEnergyTrip(creep, target) && !isDroppedEnergyReservedForWorker(target) && !isRefillTargetReservedByOtherCreep(creep, target) && (!("structureType" in target) || !isControllerDeliveryContainer(target));
}
function isAttackStorageRefillTarget(creep, target, deliveryTarget) {
  return hasHostileCombatCreeps(creep.room) && isStorageTarget(target) && isUrgentAttackDeliveryTarget(deliveryTarget) && hasRefillEnergy2(target) && !isRefillTargetReservedByOtherCreep(creep, target);
}
function rememberRefillTarget(creep, target) {
  if (target && creep.memory.energyTargetId !== target.id) {
    reservationState = null;
    creep.memory.energyTargetId = target.id;
  }
  return target;
}
function isDecayingRefillTarget(target) {
  return !("structureType" in target);
}
function isFullDecayingRefillTarget(creep, target) {
  return isDecayingRefillTarget(target) && canFullyRefillFromTarget(creep, target);
}
function getRefillTargetScore(creep, target) {
  const freeCapacity = creep.store.getFreeCapacity(RESOURCE_ENERGY);
  const availableEnergy = getAvailableRefillEnergy(creep, target);
  const remainingFreeCapacity = Math.max(0, freeCapacity - availableEnergy);
  const partialRefillPenalty = remainingFreeCapacity / Math.max(1, freeCapacity) * MAX_PARTIAL_REFILL_SCORE_PENALTY;
  return creep.pos.getRangeTo(target) - (isDecayingRefillTarget(target) ? DECAYING_REFILL_SCORE_BONUS : 0) - (canFullyRefillFromTarget(creep, target) ? FULL_REFILL_SCORE_BONUS : 0) + partialRefillPenalty;
}
function findBestCarrierRefillTarget(creep, targets) {
  return targets.reduce((bestTarget, target) => {
    if (!bestTarget) {
      return target;
    }
    const isPriorityTarget = isFullDecayingRefillTarget(creep, target);
    const isBestPriorityTarget = isFullDecayingRefillTarget(creep, bestTarget);
    if (isPriorityTarget !== isBestPriorityTarget) {
      return isPriorityTarget ? target : bestTarget;
    }
    const score = getRefillTargetScore(creep, target);
    const bestScore = getRefillTargetScore(creep, bestTarget);
    if (score !== bestScore) {
      return score < bestScore ? target : bestTarget;
    }
    const availableEnergy = getAvailableRefillEnergy(creep, target);
    const bestAvailableEnergy = getAvailableRefillEnergy(creep, bestTarget);
    if (availableEnergy !== bestAvailableEnergy) {
      return availableEnergy > bestAvailableEnergy ? target : bestTarget;
    }
    return creep.pos.getRangeTo(target) < creep.pos.getRangeTo(bestTarget) ? target : bestTarget;
  }, null);
}
function findAttackStorageRefillTarget(creep, deliveryTarget) {
  const storage = creep.room.storage;
  if (!storage || !isAttackStorageRefillTarget(creep, storage, deliveryTarget)) {
    return null;
  }
  return storage;
}
function findCarrierLocalRefillTarget(creep) {
  const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource) => resource.resourceType === RESOURCE_ENERGY && resource.amount > 0 && isCarrierRefillTarget(creep, resource)
  });
  const ruins = creep.room.find(FIND_RUINS, {
    filter: (target) => isCarrierRefillTarget(creep, target)
  });
  const tombstones = creep.room.find(FIND_TOMBSTONES, {
    filter: (target) => isCarrierRefillTarget(creep, target)
  });
  const containers = creep.room.find(FIND_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && isCarrierRefillTarget(creep, structure)
  });
  return findBestCarrierRefillTarget(creep, [
    ...droppedEnergy,
    ...ruins,
    ...tombstones,
    ...containers
  ]);
}
function findPriorityDecayingRefillTarget(creep) {
  const droppedEnergy = creep.room.find(FIND_DROPPED_RESOURCES, {
    filter: (resource) => resource.resourceType === RESOURCE_ENERGY && isCarrierRefillTarget(creep, resource) && isFullDecayingRefillTarget(creep, resource)
  });
  return findBestCarrierRefillTarget(creep, droppedEnergy);
}
function findCarrierEnergyRefillTarget(creep, deliveryTarget = null) {
  const attackStorageTarget = findAttackStorageRefillTarget(
    creep,
    deliveryTarget
  );
  if (attackStorageTarget) {
    return rememberRefillTarget(creep, attackStorageTarget);
  }
  if (Game.time % DECAYING_REFILL_PROBE_INTERVAL === 0) {
    const priorityTarget = findPriorityDecayingRefillTarget(creep);
    if (priorityTarget) {
      return rememberRefillTarget(creep, priorityTarget);
    }
  }
  if (creep.memory.energyTargetId) {
    const savedTarget = Game.getObjectById(creep.memory.energyTargetId);
    if (savedTarget && isTargetInCreepRoom(creep, savedTarget)) {
      if (isCarrierRefillTarget(creep, savedTarget)) {
        return savedTarget;
      }
    }
    creep.clearEnergyTarget();
  }
  return rememberRefillTarget(creep, findCarrierLocalRefillTarget(creep));
}
function getReservedDeliveryEnergy(creep, target) {
  var _a;
  const reserved = (_a = getCarrierReservationState().deliveryEnergyByTargetId[target.id]) != null ? _a : 0;
  if (creep.memory.deliveryTargetId !== target.id) {
    return reserved;
  }
  return Math.max(0, reserved - creep.store[RESOURCE_ENERGY]);
}
function isDeliveryTargetAvailable(creep, target) {
  const freeCapacity = target.store.getFreeCapacity(RESOURCE_ENERGY);
  return freeCapacity > 0 && getReservedDeliveryEnergy(creep, target) < freeCapacity;
}
function canTowerAcceptFullCarrierLoad(creep, target) {
  return isDeliveryTargetAvailable(creep, target) && target.store.getFreeCapacity(RESOURCE_ENERGY) - getReservedDeliveryEnergy(creep, target) >= creep.store[RESOURCE_ENERGY];
}
function isStorageDeliveryTargetAvailable(creep, target) {
  return isDeliveryTargetAvailable(creep, target) && target.store[RESOURCE_ENERGY] + getReservedDeliveryEnergy(creep, target) < STORAGE_ENERGY_RESERVE;
}
function clearDeliveryTarget(creep) {
  delete creep.memory.deliveryTargetId;
}
function isWorkerDeliveryTarget(target) {
  return target instanceof Creep && WORKER_REFUEL_ROLES.has(target.memory.role);
}
function canContinueWorkerDelivery(creep, target) {
  return target.my && isTargetInCreepRoom(creep, target) && canRefuelWorkerRole(creep.room, target.memory.role) && !isPositionInHostileWeaponRange(target.pos);
}
function canContinueSavedDelivery(creep, target) {
  if (isWorkerDeliveryTarget(target)) {
    return canContinueWorkerDelivery(creep, target);
  }
  if (isStorageTarget(target)) {
    return isStorageDeliveryTargetAvailable(creep, target);
  }
  return isDeliveryTargetAvailable(creep, target);
}
function findSavedDeliveryTarget(creep) {
  if (!creep.memory.deliveryTargetId || !creep.hasEnergy()) {
    clearDeliveryTarget(creep);
    return null;
  }
  const savedTarget = Game.getObjectById(creep.memory.deliveryTargetId);
  if (savedTarget && isTargetInCreepRoom(creep, savedTarget) && canContinueSavedDelivery(creep, savedTarget)) {
    return savedTarget;
  }
  clearDeliveryTarget(creep);
  return null;
}
function rememberDeliveryTarget(creep, target) {
  if (target) {
    creep.memory.deliveryTargetId = target.id;
  }
  return target;
}
function findRefuelDeliveryTarget(creep) {
  return creep.pos.findClosestByPath(FIND_STRUCTURES, {
    filter: (structure) => (structure.structureType === STRUCTURE_SPAWN || structure.structureType === STRUCTURE_EXTENSION) && isDeliveryTargetAvailable(creep, structure)
  });
}
function findTowerDeliveryTarget(creep, belowEnergy = TOWER_CAPACITY, allowPartialLoad = false) {
  return creep.pos.findClosestByPath(FIND_MY_STRUCTURES, {
    filter: (structure) => structure.structureType === STRUCTURE_TOWER && structure.store[RESOURCE_ENERGY] < belowEnergy && (allowPartialLoad ? isDeliveryTargetAvailable(creep, structure) : canTowerAcceptFullCarrierLoad(creep, structure))
  });
}
function findStorageDeliveryTarget(creep) {
  const storage = creep.room.storage;
  if (!storage || !isStorageDeliveryTargetAvailable(creep, storage)) {
    return null;
  }
  return storage;
}
function findTerminalEnergyDeliveryTarget(creep) {
  const { storage, terminal } = creep.room;
  if (!terminal || !storage || storage.store[RESOURCE_ENERGY] < STORAGE_ENERGY_RESERVE || terminal.store[RESOURCE_ENERGY] >= TERMINAL_ENERGY_TARGET || !isDeliveryTargetAvailable(creep, terminal)) {
    return null;
  }
  return terminal;
}
function findControllerDeliveryContainer(creep) {
  const controller = creep.room.controller;
  if (!controller) {
    return null;
  }
  const controllerDeliveryPlan = getControllerDeliveryBuildPlan(creep.room);
  if (controllerDeliveryPlan) {
    const structures = creep.room.lookForAt(
      LOOK_STRUCTURES,
      controllerDeliveryPlan.x,
      controllerDeliveryPlan.y
    );
    const controllerDeliveryContainer = structures.find(
      (structure) => structure.structureType === STRUCTURE_CONTAINER && isDeliveryTargetAvailable(creep, structure)
    );
    if (controllerDeliveryContainer) {
      return controllerDeliveryContainer;
    }
  }
  return creep.pos.findClosestByPath(
    controller.pos.findInRange(FIND_STRUCTURES, 3, {
      filter: (structure) => structure.structureType === STRUCTURE_CONTAINER && isDeliveryTargetAvailable(creep, structure)
    })
  );
}
function canRefuelWorkerRole(room, role) {
  if (role === CREEP_ROLE.PIONEER) {
    return hasBuilderWork(room);
  }
  if (role === CREEP_ROLE.BUILDER) {
    return hasBuilderWork(room);
  }
  if (role === CREEP_ROLE.REPAIRER) {
    return hasRepairerWork(room);
  }
  return role === CREEP_ROLE.UPGRADER && !getControllerDeliveryContainer(room);
}
function getWorkerRefuelScore(carrier2, worker) {
  var _a;
  return carrier2.pos.getRangeTo(worker) + ((_a = WORKER_REFUEL_ROLE_PENALTY[worker.memory.role]) != null ? _a : 0);
}
function findWorkerDeliveryTarget(creep) {
  const workers = creep.room.find(FIND_MY_CREEPS, {
    filter: (target) => WORKER_REFUEL_ROLES.has(target.memory.role) && canRefuelWorkerRole(creep.room, target.memory.role) && !target.hasEnergy() && !isPositionInHostileWeaponRange(target.pos) && isDeliveryTargetAvailable(creep, target)
  });
  return workers.reduce((bestWorker, worker) => {
    if (!bestWorker || getWorkerRefuelScore(creep, worker) < getWorkerRefuelScore(creep, bestWorker)) {
      return worker;
    }
    return bestWorker;
  }, null);
}
function findCarrierDeliveryTarget(creep) {
  const committedBreach = creep.room.find(FIND_HOSTILE_CREEPS).some(isHostileThreateningCore);
  const savedTarget = findSavedDeliveryTarget(creep);
  const committedEmergencyTower = committedBreach ? findTowerDeliveryTarget(creep, TOWER_WARTIME_RESERVE, true) : null;
  const refuelTarget = findRefuelDeliveryTarget(creep);
  const defenseTarget = chooseDefenseDeliveryTarget(
    committedBreach,
    committedEmergencyTower,
    savedTarget
  );
  if (defenseTarget && (!isWorkerDeliveryTarget(defenseTarget) || !refuelTarget)) {
    return rememberDeliveryTarget(creep, defenseTarget);
  }
  if (refuelTarget) {
    return rememberDeliveryTarget(creep, refuelTarget);
  }
  const emergencyTowerThreshold = hasHostileCombatCreeps(creep.room) ? TOWER_WARTIME_RESERVE : EMPTY_TOWER_THRESHOLD;
  const emergencyTower = findTowerDeliveryTarget(
    creep,
    emergencyTowerThreshold
  );
  if (emergencyTower) {
    return rememberDeliveryTarget(creep, emergencyTower);
  }
  const storage = findStorageDeliveryTarget(creep);
  if (storage) {
    return rememberDeliveryTarget(creep, storage);
  }
  const terminalEnergy = findTerminalEnergyDeliveryTarget(creep);
  if (terminalEnergy) {
    return rememberDeliveryTarget(creep, terminalEnergy);
  }
  const tower = findTowerDeliveryTarget(creep);
  if (tower) {
    return rememberDeliveryTarget(creep, tower);
  }
  const worker = findWorkerDeliveryTarget(creep);
  if (worker) {
    return rememberDeliveryTarget(creep, worker);
  }
  return rememberDeliveryTarget(creep, findControllerDeliveryContainer(creep));
}
function shouldDeliverPartialEnergy(creep, refillTarget, deliveryTarget) {
  if (!deliveryTarget || !creep.hasEnergy() || getEnergyRatio(creep) <= MIN_DELIVERY_ENERGY_RATIO) {
    return false;
  }
  if (!refillTarget) {
    return true;
  }
  return creep.pos.getRangeTo(deliveryTarget) <= creep.pos.getRangeTo(refillTarget);
}
function deliverEnergy(creep, deliveryTarget = findCarrierDeliveryTarget(
  creep
)) {
  if (!deliveryTarget) {
    clearDeliveryTarget(creep);
    return false;
  }
  const amount = Math.min(
    creep.store[RESOURCE_ENERGY],
    deliveryTarget.store.getFreeCapacity(RESOURCE_ENERGY)
  );
  if (amount === 0 && isWorkerDeliveryTarget(deliveryTarget)) {
    if (!creep.pos.isNearTo(deliveryTarget)) {
      creep.moveToAvoidingRoomEdges(deliveryTarget, CARRIER_DELIVERY_MOVE_OPTS);
    }
    return true;
  }
  const result = creep.transfer(deliveryTarget, RESOURCE_ENERGY, amount);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(deliveryTarget, CARRIER_DELIVERY_MOVE_OPTS);
    return true;
  }
  if (result === OK) {
    return true;
  }
  clearDeliveryTarget(creep);
  return false;
}
function hasBuilderWork(room) {
  return room.find(FIND_CONSTRUCTION_SITES).length > 0;
}
function hasRepairerWork(room) {
  return hasRepairWork(room);
}
function collectAdjacentDecayingEnergy(creep) {
  if (creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0) return;
  const tombstone = creep.pos.findInRange(FIND_TOMBSTONES, 1, {
    filter: (t) => t.store[RESOURCE_ENERGY] > 0
  })[0];
  if (tombstone) {
    creep.withdraw(tombstone, RESOURCE_ENERGY);
    return;
  }
  const ruin = creep.pos.findInRange(FIND_RUINS, 1, {
    filter: (r) => r.store[RESOURCE_ENERGY] > 0
  })[0];
  if (ruin) {
    creep.withdraw(ruin, RESOURCE_ENERGY);
    return;
  }
  const dropped = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1, {
    filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount > 0
  })[0];
  if (dropped) creep.pickup(dropped);
}
var carrier = {
  run(creep) {
    if (creep.store[RESOURCE_ENERGY] === 0 && (collectResourceLoot(creep) || collectStorageStagingMineral(creep))) {
      return;
    }
    if (deliverResourceLoot(creep)) {
      return;
    }
    collectAdjacentDecayingEnergy(creep);
    if (creep.memory.working && !creep.hasEnergy()) {
      creep.memory.working = false;
      clearDeliveryTarget(creep);
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      clearDeliveryTarget(creep);
    }
    if (creep.memory.working) {
      if (deliverEnergy(creep)) {
        return;
      }
      if (creep.needsEnergy() && collectEnergy(creep)) {
        creep.memory.working = false;
        clearDeliveryTarget(creep);
        return;
      }
      creep.moveOffRoad();
      return;
    }
    const deliveryTarget = findCarrierDeliveryTarget(creep);
    const refillTarget = findCarrierEnergyRefillTarget(creep, deliveryTarget);
    if (shouldDeliverPartialEnergy(creep, refillTarget, deliveryTarget)) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      deliverEnergy(creep, deliveryTarget);
      return;
    }
    clearDeliveryTarget(creep);
    if (collectEnergy(creep, refillTarget)) {
      return;
    }
    if (creep.hasEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
      clearDeliveryTarget(creep);
      return;
    }
    creep.moveOffRoad();
  }
};

// src/roomIntel.ts
var ROOM_INTEL = {
  E58S28: { controller: { x: 31, y: 33 } },
  E58S29: { controller: { x: 44, y: 14 } },
  E59S28: { controller: { x: 39, y: 10 } },
  E59S29: { controller: { x: 10, y: 8 } }
};
function getKnownControllerPosition(roomName) {
  var _a;
  const controller = (_a = ROOM_INTEL[roomName]) == null ? void 0 : _a.controller;
  if (!controller) {
    return null;
  }
  return new RoomPosition(controller.x, controller.y, roomName);
}

// src/roles/support/targetRoom.ts
function isRoomEdge2(pos) {
  return pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49;
}
function getNearestInteriorPosition(pos) {
  return new RoomPosition(
    Math.max(1, Math.min(48, pos.x)),
    Math.max(1, Math.min(48, pos.y)),
    pos.roomName
  );
}
function moveToTargetRoom(creep, targetRoom, pathStyle) {
  var _a;
  if (creep.room.name === targetRoom) {
    if (isRoomEdge2(creep.pos)) {
      creep.moveToAvoidingRoomEdges(getNearestInteriorPosition(creep.pos), {
        visualizePathStyle: pathStyle
      });
      return true;
    }
    return false;
  }
  const targetPosition = (_a = getKnownControllerPosition(targetRoom)) != null ? _a : new RoomPosition(25, 25, targetRoom);
  creep.moveToAvoidingRoomEdges(targetPosition, {
    visualizePathStyle: pathStyle
  });
  return true;
}

// src/roles/claimer.ts
function getMyUsername2() {
  var _a;
  return (_a = creepOwnerName()) != null ? _a : "";
}
function creepOwnerName() {
  var _a, _b, _c, _d;
  return (_d = (_c = (_a = Game.spawns.Spawn1) == null ? void 0 : _a.owner.username) != null ? _c : (_b = Object.values(Game.creeps)[0]) == null ? void 0 : _b.owner.username) != null ? _d : null;
}
function canClaimRoom(creep, controller) {
  if (creep.room.find(FIND_HOSTILE_CREEPS).length > 0) {
    return false;
  }
  if (controller.owner && !controller.my) {
    return false;
  }
  return !controller.reservation || controller.reservation.username === getMyUsername2();
}
var claimer = {
  run(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) {
      creep.moveOffRoad();
      return;
    }
    if (moveToTargetRoom(creep, targetRoom, { stroke: "#a78bfa" })) {
      return;
    }
    const controller = creep.room.controller;
    if (!controller) {
      creep.moveOffRoad();
      return;
    }
    if (controller.my) {
      creep.moveOffRoad();
      return;
    }
    if (!canClaimRoom(creep, controller)) {
      creep.moveOffRoad();
      return;
    }
    if (creep.claimController(controller) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(controller, {
        visualizePathStyle: { stroke: "#a78bfa" }
      });
    }
  }
};

// src/roles/harvester.ts
var harvester = {
  run(creep) {
    var _a;
    const source = creep.memory.sourceId ? Game.getObjectById(creep.memory.sourceId) : null;
    if (!source) {
      const { targetRoom } = creep.memory;
      if (targetRoom && creep.room.name !== targetRoom) {
        moveToTargetRoom(creep, targetRoom, { stroke: "#ffaa00" });
        return;
      }
      creep.goToSource();
      return;
    }
    delete creep.memory.targetRoom;
    const container = creep.findAdjacentSourceContainer(source);
    const link = (_a = source.pos.findInRange(FIND_MY_STRUCTURES, 1, {
      filter: (s) => s.structureType === STRUCTURE_LINK
    })[0]) != null ? _a : null;
    if (creep.hasFullEnergy()) {
      const depositTarget = link != null ? link : container;
      if (depositTarget && depositTarget.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
        creep.transferEnergyTo(depositTarget);
      } else {
        creep.drop(RESOURCE_ENERGY);
      }
      return;
    }
    const moveTarget = container != null ? container : source;
    if (isPositionInHostileWeaponRange(moveTarget.pos)) {
      const spawn = findSameRoomSpawn(creep);
      if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
        creep.moveToAvoidingRoomEdges(spawn, {
          visualizePathStyle: { stroke: "#ffaa00" }
        });
        return;
      }
      creep.moveOffRoad();
      return;
    }
    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
      creep.moveToAvoidingRoomEdges(moveTarget, {
        visualizePathStyle: { stroke: "#ffaa00" }
      });
    }
  }
};

// src/roles/pioneer.ts
function buildPrimarySpawn(creep) {
  if (!isPrimarySpawnMissing(creep.room)) {
    return false;
  }
  const spawnSite = getPrimarySpawnSite(creep.room);
  if (!spawnSite) {
    return false;
  }
  if (isPositionInHostileWeaponRange(spawnSite.pos)) {
    creep.moveOffRoad();
    return true;
  }
  if (creep.build(spawnSite) === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(spawnSite, {
      visualizePathStyle: { stroke: "#ffffff" }
    });
  }
  return true;
}
var pioneer = {
  run(creep) {
    if (creep.memory.working && !creep.hasEnergy()) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }
    if (creep.memory.working) {
      if (buildPrimarySpawn(creep)) {
        return;
      }
      const target = creep.findRefuelStructure();
      if (target) {
        creep.transferEnergyTo(target);
        return;
      }
      if (creep.findAndBuild()) {
        return;
      }
      if (creep.findAndRepair()) {
        return;
      }
      creep.moveOffRoad();
      return;
    }
    const energyTarget = creep.findEnergyRefillTarget();
    if (energyTarget && "amount" in energyTarget) {
      creep.pickUpEnergy(energyTarget);
      return;
    }
    if (energyTarget) {
      creep.withdrawEnergyFrom(energyTarget);
      return;
    }
    creep.goToSource();
  }
};

// src/roles/support/boost.ts
var PATH_STYLE3 = { stroke: "#00ffcc" };
function seekBoost(creep) {
  var _a;
  if (!creep.memory.wantsBoost) {
    return false;
  }
  if (creep.memory.boosted) {
    delete creep.memory.wantsBoost;
    return false;
  }
  const toughParts = creep.getActiveBodyparts(TOUGH);
  if (toughParts === 0) {
    delete creep.memory.wantsBoost;
    return false;
  }
  if (creep.memory.boostDeadline !== void 0 && Game.time > creep.memory.boostDeadline) {
    console.log(
      `Boost fallback: ${creep.name} gave up waiting for a boost, defending unboosted`
    );
    delete creep.memory.wantsBoost;
    return false;
  }
  const lab = (_a = findReadyBoostLab(creep.room, toughParts)) != null ? _a : findReadyBoostLab(creep.room, MIN_BOOST_PARTS);
  if (!lab) {
    return false;
  }
  if (!creep.pos.isNearTo(lab)) {
    creep.moveToAvoidingRoomEdges(lab, { visualizePathStyle: PATH_STYLE3 });
    return true;
  }
  const result = lab.boostCreep(creep);
  if (result === OK) {
    creep.memory.boosted = true;
    delete creep.memory.wantsBoost;
    console.log(`Boost success: ${creep.name} boosted with ${lab.mineralType}`);
    return false;
  }
  console.log(
    `Boost fallback: ${creep.name} boostCreep failed (${result}), defending unboosted`
  );
  delete creep.memory.wantsBoost;
  return false;
}

// src/roles/rangedDefender.ts
var PATH_STYLE4 = { stroke: "#ff8800" };
var RANGED_RANGE = 3;
var FORMATION_APPROACH_RANGE = 5;
var rangedDefender = {
  run(creep) {
    var _a;
    if (seekBoost(creep)) {
      return;
    }
    const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);
    if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL) > 0) {
      creep.heal(creep);
    }
    const inRange = creep.pos.findInRange(hostiles, RANGED_RANGE);
    const attackTarget = pickHostileTarget(inRange);
    if (attackTarget) {
      creep.rangedAttack(attackTarget);
    }
    const assignment = getDefenseAssignment(creep);
    if (assignment) {
      if (!creep.pos.isEqualTo(assignment)) {
        creep.moveToAvoidingRoomEdges(assignment, {
          visualizePathStyle: PATH_STYLE4,
          // Refresh around the compact gate every tick so a newly anchored
          // defender cannot leave followers reusing a path through its tile.
          reusePath: creep.pos.inRangeTo(assignment, FORMATION_APPROACH_RANGE) ? 0 : 5
        });
      }
      return;
    }
    const target = (_a = pickHostileTarget(hostiles)) != null ? _a : findPriorityHostile(creep.room, creep.pos);
    const spawn = findSameRoomSpawn(creep);
    if (target) {
      const range = creep.pos.getRangeTo(target);
      if (range < RANGED_RANGE && spawn) {
        creep.moveToAvoidingRoomEdges(spawn, {
          visualizePathStyle: PATH_STYLE4
        });
      } else if (range > RANGED_RANGE) {
        creep.moveToAvoidingRoomEdges(target, {
          visualizePathStyle: PATH_STYLE4,
          range: RANGED_RANGE
        });
      }
      return;
    }
    if (spawn && !creep.pos.inRangeTo(spawn, 3)) {
      creep.moveToAvoidingRoomEdges(spawn, { visualizePathStyle: PATH_STYLE4 });
      return;
    }
    creep.moveOffRoad();
  }
};

// src/roles/repairer.ts
function idleRepairer(creep) {
  if (!moveToBestRepairTargetForCreep(creep)) {
    creep.moveOffRoad();
  }
}
var repairer = {
  run(creep) {
    if (!creep.hasEnergy()) {
      clearRepairTarget(creep);
    }
    if (standDownIfUnderAttack(creep)) {
      clearRepairTarget(creep);
      return;
    }
    runWorkRefuelLoop(creep, repairBestTarget, idleRepairer);
  }
};

// src/roles/safeModeGenerator.ts
var PATH_STYLE5 = { stroke: "#66ff66" };
var safeModeGenerator = {
  run(creep) {
    var _a;
    const controller = creep.room.controller;
    if (!(controller == null ? void 0 : controller.my)) {
      creep.moveOffRoad();
      return;
    }
    if (((_a = controller.safeModeAvailable) != null ? _a : 0) >= getDesiredSafeModes(creep.room.name) && creep.store[RESOURCE_GHODIUM] === 0) {
      creep.suicide();
      return;
    }
    if (creep.store[RESOURCE_GHODIUM] >= SAFE_MODE_GHODIUM_COST) {
      generateSafeMode(creep, controller);
      return;
    }
    loadGhodium(creep);
  }
};
function generateSafeMode(creep, controller) {
  var _a;
  const result = creep.generateSafeMode(controller);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(controller, {
      visualizePathStyle: PATH_STYLE5
    });
    return;
  }
  if (result === OK) {
    console.log(
      `Safe-mode generator added a safe mode in ${creep.room.name} (now ${((_a = controller.safeModeAvailable) != null ? _a : 0) + 1} available)`
    );
    return;
  }
  console.log(
    `Safe-mode generator in ${creep.room.name} failed generateSafeMode: ${result}`
  );
}
function loadGhodium(creep) {
  const source = findGhodiumSource(creep.room);
  if (!source) {
    const controller = creep.room.controller;
    if (controller && !creep.pos.inRangeTo(controller, 3)) {
      creep.moveToAvoidingRoomEdges(controller, {
        visualizePathStyle: PATH_STYLE5
      });
    } else {
      creep.moveOffRoad();
    }
    return;
  }
  const needed = SAFE_MODE_GHODIUM_COST - creep.store[RESOURCE_GHODIUM];
  const amount = Math.min(needed, source.store[RESOURCE_GHODIUM]);
  const result = creep.withdraw(source, RESOURCE_GHODIUM, amount);
  if (result === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(source, { visualizePathStyle: PATH_STYLE5 });
  }
}
function findGhodiumSource(room) {
  if (room.storage && room.storage.store[RESOURCE_GHODIUM] > 0) {
    return room.storage;
  }
  if (room.terminal && room.terminal.store[RESOURCE_GHODIUM] > 0) {
    return room.terminal;
  }
  return null;
}

// src/roles/settler.ts
function getPlannedSpawnSite(creep) {
  var _a;
  const plan = getPrimarySpawnBuildPlan(creep.room);
  if (!plan) {
    return null;
  }
  const sites = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES, plan.x, plan.y);
  return (_a = sites.find(
    (site) => site.my && site.structureType === STRUCTURE_SPAWN
  )) != null ? _a : null;
}
function buildPlannedSpawn(creep) {
  const spawnSite = getPlannedSpawnSite(creep);
  if (!spawnSite) {
    return false;
  }
  if (isPositionInHostileWeaponRange(spawnSite.pos)) {
    creep.moveOffRoad();
    return true;
  }
  if (creep.build(spawnSite) === ERR_NOT_IN_RANGE) {
    creep.moveToAvoidingRoomEdges(spawnSite, {
      visualizePathStyle: { stroke: "#ffffff" }
    });
  }
  return true;
}
var settler = {
  run(creep) {
    const targetRoom = creep.memory.targetRoom;
    if (!targetRoom) {
      creep.moveOffRoad();
      return;
    }
    if (moveToTargetRoom(creep, targetRoom, { stroke: "#34d399" })) {
      return;
    }
    if (creep.memory.working && !creep.hasEnergy()) {
      creep.memory.working = false;
    }
    if (!creep.memory.working && creep.hasFullEnergy()) {
      creep.memory.working = true;
      creep.clearEnergyTarget();
    }
    if (creep.memory.working) {
      if (buildPlannedSpawn(creep)) {
        return;
      }
      const target = creep.findRefuelStructure();
      if (target) {
        creep.transferEnergyTo(target);
        return;
      }
      if (creep.findAndBuild()) {
        return;
      }
      if (creep.findAndRepair()) {
        return;
      }
      creep.moveOffRoad();
      return;
    }
    const energyTarget = creep.findEnergyRefillTarget();
    if (energyTarget && "amount" in energyTarget) {
      creep.pickUpEnergy(energyTarget);
      return;
    }
    if (energyTarget) {
      creep.withdrawEnergyFrom(energyTarget);
      return;
    }
    creep.goToSource();
  }
};

// src/roles/upgrader.ts
function upgradeController(creep) {
  creep.goUpgradeController();
}
function moveToController(creep) {
  const controller = creep.room.controller;
  if (!controller) {
    creep.moveOffRoad();
    return;
  }
  if (creep.pos.inRangeTo(controller, 3)) {
    creep.moveOffRoad();
    return;
  }
  creep.moveToAvoidingRoomEdges(controller, {
    visualizePathStyle: { stroke: "#ffffff" }
  });
}
var upgrader = {
  run(creep) {
    if (!creep.memory.working && creep.needsEnergy()) {
      const link = getControllerDeliveryLink(creep.room);
      if (link && link.store[RESOURCE_ENERGY] > 0) {
        creep.withdrawEnergyFrom(link);
        return;
      }
    }
    runWorkRefuelLoop(creep, upgradeController, moveToController);
  }
};

// src/main.ts
extendCreep();
var roles = {
  [CREEP_ROLE.PIONEER]: pioneer,
  [CREEP_ROLE.CLAIMER]: claimer,
  [CREEP_ROLE.SETTLER]: settler,
  [CREEP_ROLE.HARVESTER]: harvester,
  [CREEP_ROLE.CARRIER]: carrier,
  [CREEP_ROLE.RANGED_DEFENDER]: rangedDefender,
  [CREEP_ROLE.UPGRADER]: upgrader,
  [CREEP_ROLE.BUILDER]: builder,
  [CREEP_ROLE.REPAIRER]: repairer,
  [CREEP_ROLE.LAB_TECH]: labTech,
  [CREEP_ROLE.SAFE_MODE_GENERATOR]: safeModeGenerator
};
function loop() {
  memoryManager.cleanUpCreepMemory();
  spawnRecoveryManager.manageSpawnRecovery();
  buildPlanManager.manageBuildPlans();
  linkTransferManager.manageLinkTransfers();
  towerManager.manageTowers();
  defenseAssignmentManager.manage();
  safeModeManager.manageSafeMode();
  mineralLogisticsManager.manageMineralLogistics();
  labManager.manageLabs();
  spawnManager.manageSpawning();
  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    if (creep.memory.remoteOperate !== void 0) {
      if (Game.time < creep.memory.remoteOperate) {
        continue;
      }
      delete creep.memory.remoteOperate;
    }
    if (creep.handleSwapRequest()) {
      continue;
    }
    const role = roles[creep.memory.role];
    if (role) {
      role.run(creep);
    } else {
      console.log(`Creep ${name} has an undefined role: ${creep.memory.role}`);
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  loop
});
