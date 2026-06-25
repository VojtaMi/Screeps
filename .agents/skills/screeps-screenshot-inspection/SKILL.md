---
name: screeps-screenshot-inspection
description: Use when Screeps diagnosis needs visual room context after structured JSON or MCP checks, especially pathing, ramparts, choke points, defender positioning, traffic jams, breach routes, rally points, or human-readable raid/room report visuals.
---

# Screeps Screenshot Inspection

## Overview

Use this escalation workflow when coordinates and structured Screeps data are
not enough. It produces or inspects small visual room snapshots for spatial
questions: breach routes, pathing, rampart/choke choices, defender placement,
rally points, traffic jams, or raid report visuals.

## Guardrails

- Follow project instructions from `AGENTS.md`.
- Do not deploy, mutate live Memory, or run side-effecting Screeps console
  commands.
- Do not use visuals as the first step. Use JSON history helpers or read-only
  MCP/live checks first to identify the room, tick, objects, and question.
- Capture the smallest useful set of visuals, usually 3-5 key ticks or 1-2 live
  room views.
- Treat visuals as spatial evidence. Use structured data for exact ticks, body
  parts, store contents, tower energy, and Memory.

## History Visuals

Render static history snapshots from the repository root:

```bash
npm run history:render -- --shard shard3 --room E58S28 --ticks 81080300,81080373,81080437,81080443 --labels
```

The renderer writes SVG files under:

`tools/artifacts/history/<room>/<shard>-<room>-<tick>.svg`

Use these after `npm run history:inspect` has identified key ticks. The SVGs are
repo-local artifacts and should not be committed.

## Live Visuals

For live rooms, prefer read-only MCP state first. Escalate to visual inspection
only when spatial layout is the question. If the Screeps MCP image tool is
available, use `get_encoded_room_image` for a room overview. If browser tools are
available and authenticated, a Screeps room or history page screenshot is also
acceptable.

Tie live visual claims to the current shard, room, timestamp or game tick, and
the structured object data that motivated the screenshot.

## Reporting

When visuals help, say exactly what they added:

- "Confirmed the hostile route followed the road spine into the southeast core."
- "Showed the defender was not on a rampart/choke despite one being nearby."
- "Made the report easier to read, but did not change the JSON diagnosis."

If visuals do not change the conclusion, say so and keep the final diagnosis
grounded in structured data.
