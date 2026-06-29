---
type: invariant
title: Screeps Bot Must Recover From Low RCL
description: Bot behavior must derive from live game state and tolerate missing structures after attacks, claims, or resets.
resource: AGENTS.md
tags:
  - screeps
  - recovery
  - scalability
  - low-rcl
timestamp: 2026-06-29T00:00:00Z
---

# Screeps Bot Must Recover From Low RCL

Code changes should keep working if a room drops to RCL 2 with one spawn and
must rebuild itself.

Do not hardcode the current room level, layout, structure counts, or creep
counts. Prefer live game state such as `controller.level`, visible structures,
available energy, and construction sites.

When logic touches towers, storage, links, terminals, labs, ramparts, or other
optional structures, handle absence gracefully. Missing assets can mean early
RCL, post-attack damage, an incomplete build plan, or recovery after a reset.

When in doubt, ask: "Would this still work if the room dropped to RCL 2 with
one spawn and had to rebuild itself?" If not, generalize it.
