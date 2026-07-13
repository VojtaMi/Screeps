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
const { buildDefensePlan, isDefensePlanValid, getDefenseAssignment } =
  await import("../src/managers/defenseAssignmentManager.ts");
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

function placeRampart(x, y, roomName = "E58S28") {
  const rampart = {
    structureType: STRUCTURE_RAMPART,
    my: true,
    pos: new MockRoomPosition(x, y, roomName),
  };
  const key = `${roomName}:${x}:${y}`;
  const existing = positionContents.get(key) ?? { structures: [], creeps: [] };
  positionContents.set(key, {
    structures: [...existing.structures, rampart],
    creeps: existing.creeps ?? [],
  });
  return rampart;
}

function occupyTile(x, y, name, roomName = "E58S28") {
  const key = `${roomName}:${x}:${y}`;
  const existing = positionContents.get(key) ?? { structures: [], creeps: [] };
  positionContents.set(key, {
    structures: existing.structures ?? [],
    creeps: [...(existing.creeps ?? []), { name }],
  });
}

function makeHostile(x, y, id = "h1", roomName = "E58S28") {
  return { id, pos: new MockRoomPosition(x, y, roomName) };
}

function makeDefender(name) {
  return { name, memory: { role: "rangedDefender" } };
}

function verticalPath(x, fromY, toY, roomName = "E58S28") {
  const step = fromY > toY ? -1 : 1;
  const path = [];
  for (let y = fromY + step; y !== toY; y += step) {
    path.push({ x, y });
  }
  const origin = new MockRoomPosition(x, fromY, roomName);
  origin.path = path;
  return origin;
}

test("plan assigns the enemy-most path rampart backed by a double-width tile", () => {
  positionContents.clear();
  Game.time = 1_000;
  const front = placeRampart(31, 30);
  const backing = placeRampart(31, 31);
  const origin = verticalPath(31, 33, 27);
  const hostile = makeHostile(31, 28);
  const room = makeRoom({ name: "E58S28", structures: [front, backing] });

  const plan = buildDefensePlan(room, origin, hostile, [makeDefender("d1")]);

  assert.deepEqual(plan.assignments.d1, { x: 31, y: 30 });
  assert.equal(plan.targetId, "h1");
  assert.deepEqual(plan.roster, ["d1"]);
  assert.equal(plan.updatedAt, 1_000);
});

test("plan rejects an exposed path rampart with no backing tile", () => {
  positionContents.clear();
  Game.time = 1_000;
  const exposedFront = placeRampart(31, 29); // no rampart at 31,30 behind it
  const backedFront = placeRampart(31, 32);
  const backing = placeRampart(31, 33);
  const origin = verticalPath(31, 35, 27);
  const hostile = makeHostile(31, 28);
  const room = makeRoom({
    name: "E58S28",
    structures: [exposedFront, backedFront, backing],
  });

  const plan = buildDefensePlan(room, origin, hostile, [makeDefender("d1")]);

  // The enemy-most (31,29) is exposed, so the defender falls back to the
  // properly backed front rather than diving onto it.
  assert.deepEqual(plan.assignments.d1, { x: 31, y: 32 });
});

test("plan slots a second defender onto a backed adjacent rampart", () => {
  positionContents.clear();
  Game.time = 1_000;
  const front = placeRampart(31, 30);
  const frontBacking = placeRampart(31, 31);
  const adjacent = placeRampart(30, 30);
  const adjacentBacking = placeRampart(30, 31);
  const origin = verticalPath(31, 33, 27);
  const hostile = makeHostile(31, 28);
  const room = makeRoom({
    name: "E58S28",
    structures: [front, frontBacking, adjacent, adjacentBacking],
  });

  const plan = buildDefensePlan(room, origin, hostile, [
    makeDefender("b"),
    makeDefender("a"),
  ]);

  assert.deepEqual(plan.assignments.a, { x: 31, y: 30 });
  assert.deepEqual(plan.assignments.b, { x: 30, y: 30 });
});

test("plan hands multiple defenders distinct deterministic ramparts", () => {
  positionContents.clear();
  Game.time = 1_000;
  const structures = [
    placeRampart(31, 30),
    placeRampart(31, 31),
    placeRampart(31, 32),
    placeRampart(31, 33),
  ];
  const origin = verticalPath(31, 34, 27);
  const hostile = makeHostile(31, 28);
  const room = makeRoom({ name: "E58S28", structures });
  const defenders = [makeDefender("a"), makeDefender("b")];

  const plan = buildDefensePlan(room, origin, hostile, defenders);
  const again = buildDefensePlan(room, origin, hostile, defenders);

  assert.deepEqual(plan.assignments.a, { x: 31, y: 30 });
  assert.deepEqual(plan.assignments.b, { x: 31, y: 31 });
  assert.notDeepEqual(plan.assignments.a, plan.assignments.b);
  assert.deepEqual(again.assignments, plan.assignments);
});

test("plan falls back to a free core rampart when no path rampart fits", () => {
  positionContents.clear();
  Game.time = 1_000;
  const nearSpawn = placeRampart(32, 33);
  const farCore = placeRampart(35, 33);
  const origin = verticalPath(31, 33, 27); // path tiles carry no ramparts
  const hostile = makeHostile(31, 28);
  const room = makeRoom({ name: "E58S28", structures: [nearSpawn, farCore] });

  const plan = buildDefensePlan(room, origin, hostile, [makeDefender("d1")]);

  assert.deepEqual(plan.assignments.d1, { x: 32, y: 33 });
});

test("plan invalidates when a held rampart is destroyed or occupied", () => {
  positionContents.clear();
  Game.time = 1_000;
  const front = placeRampart(31, 30);
  const backing = placeRampart(31, 31);
  const origin = verticalPath(31, 33, 27);
  const hostile = makeHostile(31, 28);
  const room = makeRoom({ name: "E58S28", structures: [front, backing] });
  const defenders = [makeDefender("d1")];

  const plan = buildDefensePlan(room, origin, hostile, defenders);
  assert.equal(isDefensePlanValid(room, plan, hostile, defenders), true);

  // Destroyed: the held tile no longer carries a standable rampart.
  positionContents.set("E58S28:31:30", { structures: [], creeps: [] });
  assert.equal(isDefensePlanValid(room, plan, hostile, defenders), false);

  // Occupied by a non-assigned creep.
  positionContents.set("E58S28:31:30", { structures: [front], creeps: [] });
  occupyTile(31, 30, "intruder");
  assert.equal(isDefensePlanValid(room, plan, hostile, defenders), false);
});

test("plan validity reflects target, roster, and periodic refresh", () => {
  positionContents.clear();
  Game.time = 1_000;
  const front = placeRampart(31, 30);
  const backing = placeRampart(31, 31);
  const origin = verticalPath(31, 33, 27);
  const hostile = makeHostile(31, 28);
  const room = makeRoom({ name: "E58S28", structures: [front, backing] });
  const defenders = [makeDefender("d1")];

  const plan = buildDefensePlan(room, origin, hostile, defenders);
  assert.equal(isDefensePlanValid(room, plan, hostile, defenders), true);

  // Priority hostile changed.
  assert.equal(
    isDefensePlanValid(room, plan, makeHostile(31, 28, "h2"), defenders),
    false,
  );

  // Target moved materially.
  assert.equal(
    isDefensePlanValid(room, plan, makeHostile(31, 23), defenders),
    false,
  );

  // Roster changed.
  assert.equal(
    isDefensePlanValid(room, plan, hostile, [...defenders, makeDefender("d2")]),
    false,
  );

  // Periodic refresh window elapsed.
  Game.time = 1_010;
  assert.equal(isDefensePlanValid(room, plan, hostile, defenders), false);
});

test("defenders consume only their assigned plan position", () => {
  const room = makeRoom({ name: "E58S28" });
  room.memory.defensePlan = {
    targetId: "h1",
    targetX: 31,
    targetY: 28,
    updatedAt: 1_000,
    roster: ["d1"],
    assignments: { d1: { x: 31, y: 30 } },
  };

  const assigned = getDefenseAssignment({ name: "d1", room });
  assert.equal(assigned.x, 31);
  assert.equal(assigned.y, 30);
  assert.equal(assigned.roomName, "E58S28");
  assert.equal(getDefenseAssignment({ name: "d2", room }), null);
});

test("committed breaches override saved economy delivery targets", () => {
  const tower = { id: "tower" };
  const extension = { id: "extension" };
  assert.equal(chooseDefenseDeliveryTarget(true, tower, extension), tower);
  assert.equal(chooseDefenseDeliveryTarget(false, tower, extension), extension);
});
