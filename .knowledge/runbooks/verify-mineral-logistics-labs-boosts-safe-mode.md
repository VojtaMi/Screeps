---
type: runbook
title: Verify Mineral Logistics, Labs, Boosts, And Safe Mode Recovery
description: One-use live verification checklist for the staged mineral logistics, lab, boost, and safe-mode systems after they have run in game.
tags:
  - screeps
  - logistics
  - labs
  - boosts
  - safe-mode
  - verification
timestamp: 2026-07-09T00:00:00Z
---

# Verify Mineral Logistics, Labs, Boosts, And Safe Mode Recovery

Use this after the implementation has been deployed and allowed to run for a
while. Prefer live inspection and logs. Do not mutate live game state unless the
user explicitly asks.

## Scope

Verify the staged systems from
`.knowledge/architecture/mineral-logistics-labs-boosts-safe-mode.md`:

- terminal-based mineral sharing
- `E59S28` lab production, especially `GO -> G + O`
- target-room local boost lab preparation
- safe-mode replenishment from plain `G`

## Checks

1. Build infrastructure
   - Confirm planned terminals are built or under construction.
   - Confirm the `E59S28` lab cluster is built or progressing.
   - Confirm target-room boost labs are built or progressing.
   - Confirm build-plan blocker cleanup did not destroy unexpected structures.

2. Mineral inventory
   - Inspect each owned room's storage and terminal inventory.
   - Confirm `GO`, `G`, `O`, and any local minerals are where policy expects.
   - Confirm provider rooms did not get drained below their reserve.
   - Confirm request rooms, especially `E58S28`, are receiving useful reserves.

3. Terminal sharing
   - Check recent logs for successful terminal transfers.
   - Confirm transfers respect cooldown and terminal energy.
   - Confirm transfers choose plausible provider/requester pairs.
   - Confirm there is no transfer ping-pong between rooms.

4. Lab production
   - Confirm `E59S28` selected the intended lab pair for production.
   - Confirm labs are filled with the expected resources before reactions.
   - Confirm reverse reaction converts `GO` into `G` and `O`.
   - Confirm products are moved out and returned to storage or terminal.
   - Confirm labs do not get stuck with wrong minerals.

5. Boost preparation
   - Confirm target-room boost labs receive `GO` and energy.
   - Confirm boost labs remain accessible.
   - Confirm ordinary creeps are not blocked or stranded by boost preparation.
   - If defenders spawn, confirm boost attempts are logged and roles continue
     after success or after a safe fallback.

6. Safe-mode replenishment
   - Confirm rooms below safe-mode reserve request or retain `G`.
   - Confirm only plain `G` is used for `generateSafeMode`.
   - Confirm a creep can withdraw/carry 1000 `G`, reach the controller, and call
     `generateSafeMode`.
   - Confirm the system does not spend `G` needed for more urgent boost policy.

7. Failure modes
   - Check for repeated error logs.
   - Check for creeps stuck with minerals in inventory.
   - Check for terminal energy starvation.
   - Check for CPU spikes from resource matching or lab scans.
   - Check behavior in rooms missing storage, terminal, labs, or visibility.

## Outcome

Summarize:

- What is working.
- What is partially working.
- What is blocked by construction, missing resources, cooldowns, or code bugs.
- Any code fixes needed before the next deploy.
