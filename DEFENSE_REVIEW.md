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

## Assessment

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

### Tower Refueling

Status: implemented in `src/roles/carrier/carrier.ts`.

Tower refueling was the highest-leverage short-term code improvement.

The previous carrier priority was:

1. Spawn/extensions.
2. Empty towers.
3. Storage.
4. Non-empty towers.
5. Workers/controller container.

That meant partially drained towers could lose priority to storage. During an
attack, towers are now treated as emergency delivery targets, and carriers can
withdraw directly from storage to refill them during combat.

Recommended behavior:

- If hostile combat creeps are present, refill towers before storage. *(Done:
  when `hasHostileCombatCreeps` is true, towers below the wartime reserve are
  selected ahead of storage in `findCarrierDeliveryTarget`.)*
- Keep towers above a wartime reserve threshold, not merely above zero. *(Done:
  `TOWER_WARTIME_RESERVE = 700`; `isTowerBelowWartimeReserve` drives both
  delivery priority and storage withdrawal.)*
- Allow storage-to-tower hauling during attacks. *(Done:
  `isAttackStorageRefillTarget` now gates on `hasHostileCombatCreeps` so a
  harmless scout no longer drains storage.)*
- Consider spawning or retaining extra carriers when towers are below reserve.
  *(Not done: deferred to the spawn manager.)*

### Tower Fire Discipline

Status: implemented in `src/managers/towerManager.ts` and
`src/hostileTargeting.ts`.

The towers previously attacked the priority hostile whenever one existed.

Against this kind of group, that wasted energy. Two towers at long range are not
enough to overcome two strong healers. The attacker can edge in and out,
draining tower energy when tower damage is least effective.

Recommended behavior:

- Do not fire if expected tower damage is lower than incoming hostile healing,
  unless the target is already damaged enough to finish. *(Done:
  `shouldTowersFireAtHostile` compares combined tower damage against incoming
  healing and still fires when the shot is lethal this tick.)*
- Prefer firing when hostiles are close, breaching, or on/near critical ramparts.
  *(Done: when healing wins, towers only fire if the hostile is on/next to a
  rampart or within range 3 of a spawn/storage/tower/terminal.)*
- Prefer focused fire with defenders when a kill is realistic. *(Done: towers
  share one priority target so they focus fire instead of splitting damage.)*
- Otherwise save energy for a better engagement, healing defenders, or repairing
  key ramparts. *(Partly done: when holding fire, towers heal the most-wounded
  friendly creep; rampart repair was left out to avoid energy drain.)*

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

## Recommended Implementation Order

1. ~~Add wartime tower refill priority.~~ *(Done.)*
2. ~~Add tower fire discipline so towers do not waste energy into unkillable
   healing.~~ *(Done.)*
3. Change defenders to hold defensive positions instead of chasing.
4. Add ranged defender bodies and rampart behavior.
5. Add safe-mode automation with conservative triggers.
6. Add cross-room aid and recovery behavior.
7. Add more advanced grouped defense behavior.

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
