# Defense Review: E58S28 Raid

Date: 2026-06-24

Room history reviewed:
`https://screeps.com/a/#!/history/shard3/E58S28?t=81080000`

History window inspected:
`shard3/E58S28`, ticks `81080000` through `81080099`.

## Summary

This was a planned edge/drain raid, not a random hostile visit. The attacker used a
compact four-creep combat group with strong healing, tested tower and defender
response, killed at least one local melee defender, then left the room.

The current bot response is vulnerable to this pattern because it spends tower
energy into heavy healing, does not prioritize wartime tower refueling strongly
enough, and spawns simple melee defenders that chase into open ground.

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
- By `81080090`, no hostile creeps remained in the inspected room history window.

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

Structures mostly survived in the inspected 100-tick window:

- Spawn, storage, towers, containers, and ramparts were still present.
- The rampart at `29,42` only dropped from about `122881` to `121657` hits.
- If most structures were destroyed, that likely happened outside this specific
  inspected window.

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

Tower refueling is the highest-leverage short-term code improvement.

The current carrier priority appears to be:

1. Spawn/extensions.
2. Empty towers.
3. Storage.
4. Non-empty towers.
5. Workers/controller container.

That means partially drained towers can lose priority to storage. During an
attack, towers should be treated as emergency delivery targets. Carriers should
also be allowed to withdraw directly from storage to refill towers during combat.

Recommended behavior:

- If hostile combat creeps are present, refill towers before storage.
- Keep towers above a wartime reserve threshold, not merely above zero.
- Allow storage-to-tower hauling during attacks.
- Consider spawning or retaining extra carriers when towers are below reserve.

### Tower Fire Discipline

The towers currently attack the priority hostile whenever one exists.

Against this kind of group, that can waste energy. Two towers at long range are
not enough to overcome two strong healers. The attacker can edge in and out,
draining tower energy when tower damage is least effective.

Recommended behavior:

- Do not fire if expected tower damage is lower than incoming hostile healing,
  unless the target is already damaged enough to finish.
- Prefer firing when hostiles are close, breaching, or on/near critical ramparts.
- Prefer focused fire with defenders when a kill is realistic.
- Otherwise save energy for a better engagement, healing defenders, or repairing
  key ramparts.

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

1. Add wartime tower refill priority.
2. Add tower fire discipline so towers do not waste energy into unkillable
   healing.
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
