---
type: architecture
title: Mineral Logistics, Labs, Boosts, And Safe Mode Recovery
description: Planned resource systems for converting GO to G, sharing minerals between rooms, boosting creeps, and replenishing safe modes.
tags:
  - screeps
  - logistics
  - labs
  - boosts
  - safe-mode
timestamp: 2026-07-09T00:00:00Z
---

# Mineral Logistics, Labs, Boosts, And Safe Mode Recovery

The bot is moving toward an empire resource system rather than one-off room
logic. Terminals and labs should feed shared resource needs such as defensive
boosts and safe-mode replenishment.

## Current Planned Infrastructure

- `E59S28` has a planned terminal and a 10-lab cluster.
- The intended main production pair in `E59S28` is the central lab pair at
  `37,29` and `39,29`, with the other labs usable as outputs.
- Additional rooms have planned terminals so they can participate in mineral
  sharing.
- `E58S28` is the exposed/frontline room and may need imported defensive
  minerals because NPC resource drops are less available there.

## Needed Systems

### Lab Logic

Add lab automation for room-local chemistry.

Initial focus:

- Support `GO -> G + O` via reverse reactions.
- Use `E59S28` as the first lab hub.
- Keep the lab configuration explicit at first, including selected input/output
  labs.
- Feed produced `G` and leftover `GO` into the broader resource logistics
  system.

Later:

- Support additional reactions and boost minerals.
- Handle lab cleanup/reconfiguration when changing products.

### Between-Room Resource Sharing

Add terminal-based mineral sharing between owned rooms.

Initial focus:

- Let rooms declare desired reserves for resources such as `G`, `GO`, `H`, and
  `O`.
- Treat rooms above reserve as providers and rooms below reserve as requesters.
- Prefer terminal transfers when both rooms have terminals.
- Preserve provider reserves and terminal energy.
- Prioritize nearby providers.

Later:

- Add creep hauling for rooms without terminals or for special high-value
  transfers.
- Support exports from rooms such as `E58S28` back to lab hubs if they mine
  useful minerals like hydrogen.

### Boosting Logic

Add boost preparation and creep boosting as a consumer of the shared mineral
system.

Initial focus:

- Use imported/stored `GO` for defensive boosts once labs are available.
- Keep boost labs accessible to creeps.
- Avoid blocking normal spawning/role behavior until the boost is actually
  ready.

Later:

- Support multiple boost types and role-specific boost policies.
- Integrate boosting with defender/ranged defender spawning and staging.

### Safe Mode Replenishment

Add safe-mode recovery as a consumer of plain ghodium.

Initial focus:

- Use `RESOURCE_GHODIUM`, not `GO`, for `creep.generateSafeMode(controller)`.
- Keep higher safe-mode reserves in exposed rooms such as `E58S28`.
- Generate safe mode only when the room has enough local `G` and is below its
  desired reserve.

Later:

- Coordinate with resource sharing so rooms can request `G` before attempting
  generation.
- Coordinate with lab logic so surplus `GO` can be converted into `G` when the
  empire is low on safe-mode reserves.

## Implementation Order

1. Terminal/resource sharing policy and manager.
2. Safe-mode replenishment from local plain `G`.
3. Lab reverse reaction for `GO -> G + O` in `E59S28`.
4. Boost preparation and boosted defender flow.

Keep these systems separate: logistics moves resources, labs produce resources,
boosting consumes boost minerals, and safe-mode recovery consumes `G`.
