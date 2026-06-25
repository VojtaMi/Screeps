# Defense Review: E58S28 Raid

Date: 2026-06-24

Room history reviewed:
`https://screeps.com/a/#!/history/shard3/E58S28?t=81080000`

History window inspected:
`shard3/E58S28`, ticks `81080000` through `81080099`, with follow-up
context from ticks `81080300` through `81080499`.

## Summary

This was a planned edge/drain raid that became a full base kill, not a random
hostile visit. The attacker used a compact four-creep combat group with strong
healing, tested tower and defender response, killed local melee defenders, then
walked the same group through the room core and destroyed the storage, spawn,
towers, and most extensions.

The current bot response is vulnerable to this pattern because it spends tower
attack energy on targets that are quickly healed, does not prioritize wartime
tower refueling strongly enough, and spawns simple melee defenders that chase
into open ground.

## Observed Attack

At tick `81080000`, the hostile group had four 50-part creeps owned by user id
`61f26f882181b7ba48c7015c`:

- Two attackers: `23 ATTACK`, `2 RANGED_ATTACK`, `25 MOVE`.
- Two healers/ranged supports: `6 RANGED_ATTACK`, `19 HEAL`, `25 MOVE`.

The hostile group moved as a compact block from around `30,19` toward the
source/rampart area around `29,42` and `28,43`.

Important combat ticks:

- Around `81080055`, hostiles started ranged fire at `29,42`.
- Around `81080068`, hostiles switched fire toward `28,43`.
- Around `81080070`, a local defender at `28,43` was down to roughly `410/2200`.
- By `81080080`, that defender was gone.
- By `81080090`, no hostile creeps remained in the first inspected room history
  window, but later history shows the group returned or reappeared inside the
  room core before tick `81080300`.

## Follow-Up Destruction Window

Follow-up history reviewed:
`https://screeps.com/a/#!/history/shard3/E58S28?t=81080400`

History files inspected:
`shard3/E58S28`, ticks `81080300` through `81080499`.

By tick `81080300`, the same four-creep squad was already inside the room core:

- Hostiles were around `32,32` through `35,33`, adjacent to the controller-side
  extension and road cluster.
- The room had already lost one tower and several extensions. The remaining
  visible tower at `31,39` had only `6` energy.
- `Spawn2` at `47,48` was spawning `defender-Spawn2-81080267`.
- Two upgraders near `32,34` and `32,35` were being hit by the hostile group.

The destruction sequence was:

- At `81080304`, `upgrader-Spawn2-81079765` died at `32,34`.
- At `81080305`, `defender-Spawn2-81080153` died at `35,32`.
- At `81080310`, `upgrader-Spawn2-81079600` died at `32,35`.
- Around `81080320` to `81080324`, extensions near `41,35`, `41,36`, `42,35`,
  and `43,38` were destroyed.
- Around `81080345` to `81080354`, roads around the room core were destroyed,
  including positions near `43,37`, `39,35`, `36,32`, `35,32`, and `33,34`.
- At `81080373`, the remaining visible tower at `31,39` was destroyed with `6`
  energy still inside it.
- At `81080400`, the room still had `Spawn2`, storage, three containers, two
  ramparts, roughly thirty roads, and three extensions. No towers remained.
- At `81080406`, `carrier-Spawn2-81079183` died around `44,36`.
- At `81080407`, an extension at `44,34` was destroyed.
- At `81080414`, `defender-Spawn2-81080381` died around `47,43`.
- At `81080418`, `defender-Spawn2-81080267` died around `47,43`.
- At `81080419`, an extension at `48,41` was destroyed.
- By `81080430`, storage at `45,45` was down to roughly `5772` hits and the
  spawn at `47,48` had started taking damage.
- At `81080437`, storage at `45,45` was destroyed with about `46267` energy and
  small mineral amounts still inside.
- By `81080440`, only the spawn remained among the main owned structures.
- At `81080443`, the spawn at `47,48` was destroyed with `62` energy still
  inside.
- By `81080450`, only containers, roads, and ramparts remained from the built
  room infrastructure.
- By `81080475`, the hostile group was leaving northward around `37,24` through
  `40,21`.
- By `81080499`, no hostile creeps were visible in the room history window.

This confirms the first reviewed window was only the opening probe/drain. The
later room loss happened after the towers were empty or gone, while melee
defenders continued to engage a fully healed 50-part squad near the spawn and
storage.

## Current Room State From History

The room was RCL 5 and had safe mode available:

- Controller level: `5`.
- Safe modes available: `4`.
- Safe mode was not active during the inspected window.

Tower energy was very low:

- Tower at `34,31`: `9` energy at the start, `3` by the end.
- Tower at `31,39`: `6` energy at the start and end.

Spawn behavior:

- `Spawn2` was already spawning `defender-Spawn2-81079925`.
- A later defender, `defender-Spawn2-81080039`, was queued/spawning afterward.

Structures mostly survived in the first inspected 100-tick window:

- Spawn, storage, towers, containers, and ramparts were still present.
- The rampart at `29,42` only dropped from about `122881` to `121657` hits.

Follow-up history confirms most important structures were destroyed later:

- The remaining visible tower was destroyed at `81080373`.
- Storage was destroyed at `81080437`.
- The spawn was destroyed at `81080443`.

## Implemented

These items from the original review are now in code (commit `b11f078`).

### Tower Refueling — `src/roles/carrier/carrier.ts`

During an attack, towers are treated as emergency delivery targets: any tower
below the wartime reserve (`TOWER_WARTIME_RESERVE = 700`) is refilled ahead of
storage, and carriers may withdraw directly from storage to refuel them. The
attack gate uses `hasHostileCombatCreeps`, so a harmless scout no longer drains
storage. This fixes the previous priority where partially drained towers lost
out to storage.

Still open: spawning or retaining extra carriers when towers are below reserve
(deferred to the spawn manager).

### Tower Fire Discipline — `src/managers/towerManager.ts`, `src/hostileTargeting.ts`

Towers no longer blindly fire on the priority hostile. `shouldTowersFireAtHostile`
fires only when the shot is lethal this tick or when combined tower damage
out-paces incoming hostile healing; otherwise it holds fire unless the hostile is
breaching a rampart or within range 3 of a spawn/storage/tower/terminal. Towers
focus one shared target and heal the most-wounded friendly creep when holding
fire.

Still open: repairing key ramparts while holding fire (left out to avoid energy
drain).

## Remaining Work

### Safe Mode

Manual safe mode was probably the correct immediate action.

The bot should eventually have automated safe-mode logic, but it should not fire
on every hostile. Safe modes are limited, so the trigger should be reserved for
clear base-risk conditions, such as:

- Hostile combat creeps are in the room.
- Tower damage cannot overpower hostile healing.
- Spawn, storage, towers, or key ramparts are threatened.
- A defender dies or is critically damaged near the core.
- A hostile is inside the defended area or adjacent to critical structures.

Safe mode should probably not trigger for pure edge-draining unless the attacker
commits deeper or starts damaging important assets.

### Defender Tactics

The current melee defender behavior is too simple for this kind of fight. A
melee defender that chases a coordinated ranged/heal group will usually die.

Recommended behavior:

- Defenders should hold ramparts or choke positions instead of chasing into open
  ground.
- Melee defenders should block breach points.
- Ranged defenders should sit on ramparts and focus fire with towers.
- Healers can be added later, but defenders should still be useful if the full
  group has not spawned yet.

The proposed complete defense group idea is sound:

- One melee/blocker.
- One ranged attacker.
- One healer.
- Group chooses a defense point and guards it once complete.

The main caution is that partial groups must not be useless while waiting for the
rest of the group. Start with independently useful ranged defenders on ramparts,
then add squad coordination later.

### Cross-Room Aid

Other rooms should help, but this should probably be phase two.

First priority is making the attacked room stop wasting tower energy and stop
suiciding defenders. After that, add regional defense:

- Mark `Memory.rooms[roomName].underAttack`.
- Nearby rooms spawn responders.
- Responders travel to a rally point or computed defensive position.
- After the attack, nearby rooms send builders/carriers for recovery.

Cross-room aid should cover both active defense and post-attack rebuilding.

## Controller Sign

The controller sign was:

`Love Keqing`

The sign was created by the same hostile user id seen on the attacking creeps.
It has no direct mechanical effect. It is best treated as a calling card or
taunt.

Possible response:

- Ignore it.
- Overwrite it later with one of our creeps using `signController`.
- Do not treat the sign alone as a threat signal.

## Remaining Implementation Order

Wartime tower refill priority and tower fire discipline are done (see
**Implemented** above). Remaining work, in order:

1. Change defenders to hold defensive positions instead of chasing.
2. Add ranged defender bodies and rampart behavior.
3. Add safe-mode automation with conservative triggers.
4. Add cross-room aid and recovery behavior.
5. Add more advanced grouped defense behavior.

## Candidate Live-Loop Goal

Implement basic wartime defense improvements for E58S28:

- Carriers prioritize tower refueling during attacks and can withdraw from
  storage for towers.
- Towers only attack when damage is likely useful or when critical structures are
  threatened.
- Melee defenders avoid chasing outside the defended area and prefer holding
  rampart/choke positions.

Success criteria:

- During a hostile combat presence, tower energy is actively replenished from
  available room energy/storage.
- Towers do not spend every tick on distant fully healed attackers.
- Defenders do not walk into open-ground focus fire when a defensive position is
  available.
- `npm run ci` passes before handoff.
