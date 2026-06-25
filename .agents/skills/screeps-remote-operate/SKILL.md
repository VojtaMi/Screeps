---
name: screeps-remote-operate
description: Use when the user wants to directly control one or more live Screeps creeps via console — moving, signing, harvesting, testing a hypothesis before a permanent code change, or performing any one-off action — without deploying a code change.
---

# Screeps Remote Operate

Use this workflow to take direct console control of live creeps for one-off tasks: signing a controller, moving a creep to a specific position, testing a manual action, etc.

## How it works

The game code checks `creep.memory.remoteOperate` on each creep at the top of the main dispatch loop. When the flag is set to a future tick (`Game.time + N`), the creep is skipped entirely — leaving your console-issued intents intact. The flag auto-expires and is deleted when `Game.time` reaches it.

The spawn manager also excludes remote-operated creeps from role headcounts, so the economy will compensate (e.g. spawn a replacement upgrader) while you have a creep offline.

## Guardrails

- Always restore `creep.memory.role` and clear `creep.memory.remoteOperate` when done.
- Set an auto-expiry tick (`Game.time + 50` is a safe default) so a crashed session cannot leave a creep permanently idle.
- Do not interrupt defenders, emergency repairers, or any creep currently in combat.
- Confirm the target room is visible (`Game.rooms['RoomName']`) before acting — console expressions silently fail on rooms with no vision.
- Poll console output at Screeps tick cadence (~15s); do not spam reads.

## Execution order (critical)

Console commands execute **before** the main loop in the same tick. This means:
- A `moveTo` issued in the console will be overridden by the main loop's `moveTo` unless the creep is excluded from normal dispatch.
- The `remoteOperate` flag (or role-swap workaround) is required to prevent the main loop from overriding console intents.

## Workflow

### With `remoteOperate` flag in game code

```javascript
// Grab a creep
const creep = Game.creeps['creep-name'];
creep.memory.remoteOperate = Game.time + 50; // expiry in 50 ticks

// Issue actions each tick until done
creep.moveTo(new RoomPosition(x, y, 'RoomName'), {reusePath: 0});
// or
creep.signController(Game.rooms['RoomName'].controller, 'text');

// Release when done
delete creep.memory.remoteOperate;
```

### Role-swap workaround (no flag in game code)

```javascript
// Grab
const creep = Game.creeps['creep-name'];
creep.memory._savedRole = creep.memory.role;
creep.memory.role = '_remote';          // unknown role → main loop skips it
creep.moveTo(target, {reusePath: 0});   // intent survives into tick resolution

// Release
creep.memory.role = creep.memory._savedRole || 'upgrader';
delete creep.memory._savedRole;
```

## Finding the right creep

```javascript
// Closest creep to a target in a room
const ctrl = Game.rooms['RoomName'].controller;
const creeps = Game.rooms['RoomName'].find(FIND_MY_CREEPS)
  .map(c => ({name: c.name, role: c.memory.role, dist: c.pos.getRangeTo(ctrl)}))
  .sort((a, b) => a.dist - b.dist);
console.log(JSON.stringify(creeps));
```

## Terrain check before moving

Not all adjacent tiles are walkable. Check before planning a path:

```javascript
const room = Game.rooms['RoomName'];
const terrain = room.getTerrain();
const target = room.controller; // or any RoomObject
const adj = [];
for (let dx = -1; dx <= 1; dx++) {
  for (let dy = -1; dy <= 1; dy++) {
    if (dx === 0 && dy === 0) continue;
    const x = target.pos.x + dx, y = target.pos.y + dy;
    adj.push({x, y, wall: terrain.get(x, y) === TERRAIN_MASK_WALL});
  }
}
console.log(JSON.stringify(adj.filter(t => !t.wall)));
```

## Verify action succeeded

```javascript
// After signController
const ctrl = Game.rooms['RoomName'].controller;
console.log(JSON.stringify({sign: ctrl.sign?.text, by: ctrl.sign?.username}));
```

## Known gotchas

- **Creep death mid-operation**: creeps can die between ticks. Re-check `Game.creeps['name']` each tick; if `undefined`, find a replacement.
- **Role not restored on crash**: always include the role restore in the success branch. If you abandon mid-operation, run `Game.creeps['name'].memory.role = 'upgrader'` manually.
- **Upgraders stay at range 3**: upgrader main-loop logic actively holds them at upgrade range. Use the role-swap to break them free.
