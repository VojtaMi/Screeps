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

Commit `de060ec` implemented the policy on 2026-07-14:

- An assigned defender holding its tactical tile does not yield to swaps while
  combat hostiles are present. Peaceful traffic swaps remain enabled.
- One shared unsafe-attack signal is used when at least one combat hostile
  cannot be overpowered by the room's currently energized towers.
- Unsafe spawning restores the first harvester needed for recovery, maintains
  the intentional wartime target of three carriers, fills the defense squad,
  and otherwise holds energy instead of spawning discretionary or cross-room
  creeps. An unaffordable defender produces an explicit hold decision.
- Existing builders and repairers shelter near a same-room spawn for the whole
  unsafe attack. Carriers remain active to supply towers and spawning.

## Verification Status

`npm run ci`, the existing `npm run test:defense` suite, and `npm run build`
passed locally on 2026-07-14. The historical replay confirms the original
failure but cannot validate the changed code. No deployment or meaningful live
combat verification was performed; observe the next unsafe attack for spawn
holds, civilian sheltering, three-carrier wartime logistics, and stable defender
assignments.
