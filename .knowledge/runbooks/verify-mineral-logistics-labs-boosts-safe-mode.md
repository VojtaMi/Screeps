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

## Implementation Reference (as built)

Config lives in `src/empire/`:

- `resourcePolicy.ts` — shared minerals `[G, GO, O, H]`; per-room reserves;
  safe-mode reserves; `SAFE_MODE_GHODIUM_COST = 1000`.
- `labPlans.ts` — production + boost lab coordinates and boost targets.

Managers/roles added:

- `mineralLogisticsManager` (loop) — at most one terminal `send` per tick.
- `labManager` (loop) — runs `reverseReaction` in production hubs; also owns the
  `labTech` spawn request (1 per room with lab work).
- `safeModeReplenishManager` — spawns the `safeModeGenerator` role.
- Roles: `labTech`, `safeModeGenerator`. Boost logic: `roles/support/boost.ts`
  (`seekBoost`), consumed by `defender`/`rangedDefender`.

Resource reserves (storage + terminal), by room:

- Default owned room: `G = 1000`.
- `E59S28` (production hub): `G = 1000`, `GO = 3000`.
- `E58S28` (frontline): `G = 2000`, `GO = 2000`.

Safe-mode reserves: default `1`; `E58S28 = 2`.

Lab configuration:

- Production hub `E59S28`, reverse `GO -> G + O`: source lab `38,29` holds GO;
  output labs `37,29` (G) and `39,29` (O). Reaction skipped unless the source
  holds GO; wrong minerals are drained by `labTech`.
- Boost labs `E58S28` (`42,47`, `42,48`, `41,48`), boost `GO` for `TOUGH`.
  Targets: `900` mineral, `600` energy; usable at `MIN_BOOST_PARTS = 3`.

Log strings to grep:

- `Mineral logistics: sent ...` / `... failed to send ...`
- `Lab hub <room> reverseReaction ... failed` (throttled, every 50 ticks)
- `Safe-mode generator added a safe mode ...`
- `Boost success: ... boosted with ...` / `Boost fallback: ...`

Terminal feeding: carriers route newly collected shared minerals to the terminal
(loot) and also stage surplus shared minerals out of storage into the terminal
(up to `10000` per resource, only the amount above the room's reserve) so an
existing storage stockpile becomes sendable. Carriers also top the terminal up
to `20000` energy once storage holds `>= 50000`.

Tomorrow, specifically confirm an existing `GO` stockpile in `E59S28.storage`
(or wherever it sits) actually stages into that room's terminal and then moves to
requesters. If a provider's surplus stays stuck in storage, staging is the slice
to check first.

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
