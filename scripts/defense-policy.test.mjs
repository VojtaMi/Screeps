import assert from "node:assert/strict";
import test from "node:test";

const positionContents = new Map();

class MockRoomPosition {
  constructor(x, y, roomName = "W0N0") {
    this.x = x;
    this.y = y;
    this.roomName = roomName;
    this.path = [];
  }

  getRangeTo(target) {
    const position = target.pos ?? target;
    return Math.max(Math.abs(this.x - position.x), Math.abs(this.y - position.y));
  }

  inRangeTo(target, range) {
    return this.getRangeTo(target) <= range;
  }

  isNearTo(target) {
    return this.inRangeTo(target, 1);
  }

  isEqualTo(target) {
    const position = target.pos ?? target;
    return this.x === position.x && this.y === position.y;
  }

  lookFor(type) {
    return positionContents.get(`${this.roomName}:${this.x}:${this.y}`)?.[type] ?? [];
  }

  findPathTo() {
    return this.path;
  }

  findClosestByRange(targets) {
    return [...targets].sort((a, b) => this.getRangeTo(a) - this.getRangeTo(b))[0] ?? null;
  }
}

Object.assign(globalThis, {
  ATTACK: "attack",
  FIND_HOSTILE_CREEPS: 1,
  FIND_MY_CREEPS: 2,
  FIND_MY_STRUCTURES: 3,
  FIND_STRUCTURES: 4,
  HEAL: "heal",
  HEAL_POWER: 12,
  LOOK_CREEPS: "creeps",
  LOOK_STRUCTURES: "structures",
  RANGED_ATTACK: "ranged_attack",
  RANGED_HEAL_POWER: 4,
  RESOURCE_ENERGY: "energy",
  RoomPosition: MockRoomPosition,
  STRUCTURE_CONTAINER: "container",
  STRUCTURE_EXTENSION: "extension",
  STRUCTURE_FACTORY: "factory",
  STRUCTURE_LAB: "lab",
  STRUCTURE_LINK: "link",
  STRUCTURE_NUKER: "nuker",
  STRUCTURE_OBSERVER: "observer",
  STRUCTURE_POWER_SPAWN: "powerSpawn",
  STRUCTURE_RAMPART: "rampart",
  STRUCTURE_ROAD: "road",
  STRUCTURE_SPAWN: "spawn",
  STRUCTURE_STORAGE: "storage",
  STRUCTURE_TERMINAL: "terminal",
  STRUCTURE_TOWER: "tower",
  STRUCTURE_WALL: "constructedWall",
  TOWER_ENERGY_COST: 10,
  TOWER_FALLOFF: 0.75,
  TOWER_FALLOFF_RANGE: 20,
  TOWER_OPTIMAL_RANGE: 5,
  TOWER_POWER_ATTACK: 600,
  BOOSTS: {
    heal: {
      LO: { heal: 2, rangedHeal: 2 },
    },
  },
  Game: {
    rooms: {},
    time: 100,
  },
});

const {
  DEFENSE_FORTIFICATION_TARGET_HITS,
  findBestRepairTarget,
  getDesiredRepairerCount,
  getRepairPriority,
} = await import("../src/repairPolicy.ts");
const { getIncomingHostileHealing } = await import("../src/hostileTargeting.ts");
const { findDefensiveRampart } = await import("../src/roles/support/defense.ts");
const { findLockedTowerTarget, towerManager } = await import(
  "../src/managers/towerManager.ts"
);
const { chooseDefenseDeliveryTarget } = await import(
  "../src/roles/carrier/defenseDelivery.ts"
);

function makeBody(type, count, boost) {
  return Array.from({ length: count }, () => ({ type, hits: 100, boost }));
}

function makeCreep({ id, hits = 5000, body, x, y }) {
  const creep = {
    id,
    hits,
    hitsMax: 5000,
    body,
    pos: new MockRoomPosition(x, y),
    getActiveBodyparts(type) {
      return this.body.filter((part) => part.type === type && part.hits > 0).length;
    },
  };
  return creep;
}

function makeRoom({ name, structures = [], hostiles = [], friendlies = [] }) {
  return {
    name,
    memory: {},
    find(type, options) {
      const candidates =
        type === FIND_HOSTILE_CREEPS
          ? hostiles
          : type === FIND_MY_CREEPS
            ? friendlies
            : structures;
      return options?.filter ? candidates.filter(options.filter) : candidates;
    },
  };
}

test("defense structures progress through the 2M fortification tier", () => {
  const rampart = { structureType: STRUCTURE_RAMPART, hits: 9_999, hitsMax: 10_000_000 };
  assert.equal(getRepairPriority(rampart), 2);
  rampart.hits = 99_999;
  assert.equal(getRepairPriority(rampart), 4);
  rampart.hits = 499_999;
  assert.equal(getRepairPriority(rampart), 5);
  rampart.hits = 500_000;
  assert.equal(getRepairPriority(rampart), 7);
  rampart.hits = DEFENSE_FORTIFICATION_TARGET_HITS;
  assert.equal(getRepairPriority(rampart), Infinity);
});

test("ordinary infrastructure outranks top-tier fortification", () => {
  Game.time += 1;
  const road = { structureType: STRUCTURE_ROAD, hits: 950, hitsMax: 1_000 };
  const rampart = {
    structureType: STRUCTURE_RAMPART,
    hits: 500_000,
    hitsMax: 10_000_000,
  };
  const room = makeRoom({ name: "repair-priority", structures: [rampart, road] });
  assert.equal(findBestRepairTarget(room), road);
  assert.equal(getDesiredRepairerCount(room), 1);
});

test("the fortification tier maintains one repairer until complete", () => {
  Game.time += 1;
  const rampart = {
    structureType: STRUCTURE_RAMPART,
    hits: 500_000,
    hitsMax: 10_000_000,
  };
  const room = makeRoom({ name: "repair-count", structures: [rampart] });
  assert.equal(getDesiredRepairerCount(room), 1);

  Game.time += 1;
  rampart.hits = DEFENSE_FORTIFICATION_TARGET_HITS;
  assert.equal(getDesiredRepairerCount(room), 0);
});

test("boost-aware healing counts two 26-part LO healers as 1248", () => {
  const target = makeCreep({
    id: "healer-a",
    body: makeBody(HEAL, 26, "LO"),
    x: 10,
    y: 10,
  });
  const partner = makeCreep({
    id: "healer-b",
    body: makeBody(HEAL, 26, "LO"),
    x: 11,
    y: 10,
  });
  assert.equal(getIncomingHostileHealing(target, [target, partner]), 1_248);
});

test("tower focus survives formation swaps and yields to higher priority", () => {
  const weakAttacker = makeCreep({
    id: "attacker-a",
    hits: 3_000,
    body: makeBody(ATTACK, 1),
    x: 10,
    y: 10,
  });
  const strongAttacker = makeCreep({
    id: "attacker-b",
    body: makeBody(ATTACK, 1),
    x: 11,
    y: 10,
  });
  const hostiles = [strongAttacker, weakAttacker];
  const room = makeRoom({ name: "focus", hostiles });
  const origin = new MockRoomPosition(20, 20);

  assert.equal(findLockedTowerTarget(room, hostiles, origin), weakAttacker);
  [weakAttacker.pos, strongAttacker.pos] = [strongAttacker.pos, weakAttacker.pos];
  assert.equal(findLockedTowerTarget(room, hostiles, origin), weakAttacker);

  const healer = makeCreep({
    id: "healer",
    body: makeBody(HEAL, 1),
    x: 15,
    y: 15,
  });
  hostiles.push(healer);
  assert.equal(findLockedTowerTarget(room, hostiles, origin), healer);
  assert.equal(findLockedTowerTarget(room, [], origin), null);
  assert.equal(room.memory.towerTargetId, undefined);
});

test("towers repair instead of firing into superior healing", () => {
  const actions = [];
  const towers = [0, 1].map((index) => ({
    id: `tower-${index}`,
    structureType: STRUCTURE_TOWER,
    hits: 3_000,
    hitsMax: 3_000,
    pos: new MockRoomPosition(10 + index, 13),
    store: { energy: 1_000 },
    attack: () => actions.push("attack"),
    heal: () => actions.push("heal"),
    repair: () => actions.push("repair"),
  }));
  const rampart = {
    id: "breach",
    structureType: STRUCTURE_RAMPART,
    hits: 100_000,
    hitsMax: 10_000_000,
    pos: new MockRoomPosition(10, 11),
  };
  const healerA = makeCreep({
    id: "healer-a",
    body: makeBody(HEAL, 26, "LO"),
    x: 10,
    y: 10,
  });
  const healerB = makeCreep({
    id: "healer-b",
    body: makeBody(HEAL, 26, "LO"),
    x: 11,
    y: 10,
  });
  const room = makeRoom({
    name: "tower-repair",
    structures: [...towers, rampart],
    hostiles: [healerA, healerB],
  });

  towerManager.manageRoomTowers(room);
  assert.deepEqual(actions, ["repair", "repair"]);
});

test("towers hold without a repair target and fire a finishable target", () => {
  const actions = [];
  const towers = [0, 1].map((index) => ({
    id: `tower-${index}`,
    structureType: STRUCTURE_TOWER,
    hits: 3_000,
    hitsMax: 3_000,
    pos: new MockRoomPosition(10 + index, 13),
    store: { energy: 1_000 },
    attack: () => actions.push("attack"),
    heal: () => actions.push("heal"),
    repair: () => actions.push("repair"),
  }));
  const healerA = makeCreep({
    id: "healer-a",
    body: makeBody(HEAL, 26, "LO"),
    x: 10,
    y: 10,
  });
  const healerB = makeCreep({
    id: "healer-b",
    body: makeBody(HEAL, 26, "LO"),
    x: 11,
    y: 10,
  });
  const room = makeRoom({
    name: "tower-hold",
    structures: towers,
    hostiles: [healerA, healerB],
  });

  towerManager.manageRoomTowers(room);
  assert.deepEqual(actions, []);

  const attacker = makeCreep({
    id: "finishable",
    hits: 500,
    body: makeBody(ATTACK, 1),
    x: 10,
    y: 10,
  });
  room.find = makeRoom({
    name: "tower-hold",
    structures: towers,
    hostiles: [attacker],
  }).find;
  towerManager.manageRoomTowers(room);
  assert.deepEqual(actions, ["attack", "attack"]);
});

test("defender replaces a distant cache with an attack-capable rampart", () => {
  positionContents.clear();
  Game.time = 1_000;
  const distantPosition = new MockRoomPosition(44, 28, "E58S28");
  const breachPosition = new MockRoomPosition(31, 30, "E58S28");
  const distantRampart = {
    structureType: STRUCTURE_RAMPART,
    my: true,
    pos: distantPosition,
  };
  const breachRampart = {
    structureType: STRUCTURE_RAMPART,
    my: true,
    pos: breachPosition,
  };
  positionContents.set("E58S28:44:28", {
    structures: [distantRampart],
    creeps: [],
  });
  positionContents.set("E58S28:31:30", {
    structures: [breachRampart],
    creeps: [],
  });

  const origin = new MockRoomPosition(47, 48, "E58S28");
  origin.path = [
    { x: 44, y: 28 },
    { x: 31, y: 30 },
  ];
  const target = new MockRoomPosition(31, 28, "E58S28");
  const room = makeRoom({
    name: "E58S28",
    structures: [distantRampart, breachRampart],
  });
  const self = {
    name: "defender",
    room,
    memory: {
      guardRampartX: 44,
      guardRampartY: 28,
      guardRampartRoomName: "E58S28",
      guardRampartUntil: Game.time + 50,
    },
  };

  assert.equal(
    findDefensiveRampart({ origin, target, self, attackRange: 3 }),
    breachRampart,
  );
  const fixedExpiry = self.memory.guardRampartUntil;
  Game.time += 1;
  assert.equal(
    findDefensiveRampart({ origin, target, self, attackRange: 3 }),
    breachRampart,
  );
  assert.equal(self.memory.guardRampartUntil, fixedExpiry);
});

test("committed breaches override saved economy delivery targets", () => {
  const tower = { id: "tower" };
  const extension = { id: "extension" };
  assert.equal(chooseDefenseDeliveryTarget(true, tower, extension), tower);
  assert.equal(chooseDefenseDeliveryTarget(false, tower, extension), extension);
});
