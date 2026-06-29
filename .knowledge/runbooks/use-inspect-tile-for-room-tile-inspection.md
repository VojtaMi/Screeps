---
type: runbook-note
title: Use Inspect Tile For Room Tile Inspection
description: The inspect-tile script is the preferred way to inspect one Screeps room tile across terrain, build plans, landmarks, validation, and live objects.
resource: scripts/inspect-tile.mjs
tags:
  - screeps
  - build-plan
  - tooling
  - terrain
timestamp: 2026-06-29T00:00:00Z
---

# Use Inspect Tile For Room Tile Inspection

Use `npm run inspect:tile -- ROOM X Y` when investigating a specific Screeps
tile.

The tool reports terrain, room-edge status, planned build-plan entries, tile
validation, landmarks such as controllers/sources/minerals/deposits, and live
room objects when available.

Prefer this over manually decoding terrain strings or separately checking build
plans and live room objects. For whole-plan validation, use
`npm run check:build-plan -- ROOM`. For visual planning, use the Build Plan
Builder via `npm run editor:dev`.
