---
type: incident
title: E59S28 Defender Swap And Wartime Civilian Spawning
description: A builder spawned during a four-creep raid, displaced an assigned defender, entered the northern kill zone, and died.
resource: src/managers/spawnManager.ts
tags:
  - screeps
  - defense
  - spawning
  - movement
  - shard3
timestamp: 2026-07-14T07:12:40Z
---

# E59S28 Defender Swap And Wartime Civilian Spawning

## Observation

Static shard3 room history showed four coordinated combat hostiles attacking
the northern perimeter of E59S28. At tick 81513343, Spawn1 started
`builder-Spawn1-81513343` while the attack was already active and three
carriers were present. The third carrier matched the intentional wartime target
and was not the problem.

At ticks 81513424-81513425,
`rangedDefender-Spawn5-81513121` held its assigned rampart at 37,16 while the
builder was blocked at 38,17. At tick 81513426 they exchanged positions. Swap
handling consumed the defender's role tick, and the builder occupying 37,16
invalidated the room defense plan. The defender moved through 38,18, 37,19, and
36,20 before recovering. The builder continued to 35,15 and was killed by
ranged fire at tick 81513433.

## Cause

- Generic traffic swaps allowed a civilian to displace a defender from its
  assigned tactical tile and made the defender skip its role for that tick.
- Unsafe-attack spawning prioritized three carriers and defenders but then fell
  through to ordinary civilian requests. A required defender that was not yet
  affordable could also return no request, allowing the room to spend partial
  energy on a cheaper civilian.
- Existing builders could continue selecting work and routing through the room
  during the unsafe attack.

## Decision And Implementation

Commit `de060ec` implemented the policy on 2026-07-14, with the civilian
standdown revised immediately afterwards (see below):

- An assigned defender holding its tactical tile does not yield to swaps while
  combat hostiles are present. Peaceful traffic swaps remain enabled.
- One shared unsafe-attack signal is used when at least one combat hostile
  cannot be overpowered by the room's currently energized towers.
- Unsafe spawning restores the first harvester needed for recovery, maintains
  the intentional wartime target of three carriers, fills the defense squad,
  and otherwise holds energy instead of spawning discretionary or cross-room
  creeps. An unaffordable defender produces an explicit hold decision.
- Existing builders and repairers stand down for the whole unsafe attack: they
  walk to a same-room spawn and are recycled there. Carriers remain active to
  supply towers and spawning.

A first pass had the two roles shelter beside the spawn instead of recycling.
That was replaced the same day, because an idle civilian is not neutral: it
loiters on the tiles the carriers use to keep the towers loaded and the
defenders use to reach their ramparts, which is the busiest traffic in the room
precisely when traffic matters most. Recycling removes the congestion, returns
most of the body cost as energy the spawn can immediately turn into defenders,
and is self-limiting because the discretionary builder probe and the desired
repairer count rebuild the roles once the attack ends. The trade accepted is the
full respawn cost afterwards, and the loss of building and repair the room could
in principle still have done safely during the attack.

Standing civilians down also removed the need for the follow-up this incident
originally recommended. Danger-aware builder retreat and safe construction path
selection are not required: a creep that does no work during an unsafe attack
cannot route itself through a hostile's weapon range, so there is no cost matrix
to build and no retreat boundary to damp.

The swap protection is not made redundant by the standdown. Carriers are exempt
from it by design, and they are the creeps that thread the base during an
attack, so they are now the likeliest requester to try to displace a defender
from its rampart.

## Verification Status

`npm run ci`, the existing `npm run test:defense` suite, and `npm run build`
pass locally on 2026-07-14. The historical replay confirms the original failure
but cannot validate the changed code, and the defense test suite is deliberately
kept minimal, so swap rejection, the hold decision, and the civilian standdown
carry no direct test coverage. No deployment or live combat verification was
performed; observe the next unsafe attack for spawn holds, builders and
repairers recycling instead of loitering, three-carrier wartime logistics, and
stable defender assignments.
