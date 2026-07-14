---
name: screeps-history-inspection
description: Use when the user asks to inspect Screeps room history — including raid timelines, room destruction, creep deaths, structure losses, hostile movement, safe-mode context, energy economy over time, creep movement patterns, spawn throughput, or any question about what happened in a room during a past tick range — without mutating live game state.
---

# Screeps History Inspection

## Overview

Use this read-only workflow to analyze Screeps static room history. It is for
any question about what happened in a room across a tick range — defensive
("what destroyed this room?", "what were hostile creeps doing?") or peaceful
("when did energy dry up?", "how did carriers move?", "was spawn idle?").

## Guardrails

- Follow project instructions from `AGENTS.md`.
- Do not deploy, mutate live Memory, run side-effecting console commands, or
  change active Screeps state.
- Treat static history URLs and the `npm run history:inspect` helper as read-only.
- Tie claims to concrete shard, room, tick, object position, creep name, or
  structure type.
- Preserve uncertainty when there are gaps between inspected history windows.

## Quick Start

Run the helper from the repository root:

```bash
npm run history:inspect -- --shard shard3 --room E58S28 --from 81080300 --to 81080499 --ticks 81080300,81080373,81080400,81080437,81080450
```

Useful options:

- `--events all`: include summaries, ruins, deaths, hostile/friendly snapshots,
  and structure disappearance events.
- `--events ruins,deaths,summary`: compact destruction timeline.
- `--every 10`: periodic room summaries every 10 ticks.
- `--ticks 1,2,3`: exact ticks where creep details should be printed.
- `--lookahead 5`: extra ticks to read so ruins/tombstones observed after the
  requested end tick are still reported by their actual destroy/death tick.
- `--json`: structured output for further processing.

## Workflow

1. Frame the history question.
   - Identify shard, room, tick or tick range, and the specific unknown.
   - Prefer inspecting a range that starts before the suspected loss and ends
     after it.

2. Run the history helper.
   - Use a broad first pass with `--events ruins,deaths,summary`.
   - Add `--ticks` for points where hostile/friendly positions and actions
     matter.
   - Re-run with a narrower range or lower `--every` once the critical interval
     is known.

3. Cross-check the output.
   - Compare `ruin`/`death` events against periodic structure counts.
   - Check whether towers existed and had energy before claiming tower behavior.
   - Check controller `safe` and `safeAvailable` values before discussing safe
     mode.
   - For energy economy questions, track `store` values on containers, storage,
     and spawns across ticks; compare against creep counts and positions.
   - For movement/pathing questions, use `--ticks` on specific ticks and trace
     creep positions across the range rather than relying on summary events.
   - If windows are non-contiguous, say "returned or reappeared" rather than
     assuming exact movement through the gap.

4. Report the diagnosis.
   - Separate confirmed history facts from inferred bot behavior.
   - Include a compact timeline of the important ticks.
   - Point to likely code areas only after the historical sequence is clear.

## Helper Notes

The static Screeps history endpoint stores each 100-tick file as a patch stream:

`https://screeps.com/room-history/<shard>/<room>/<baseTick>.json`

The helper reconstructs object state tick by tick, including partial creep body
array patches, then emits summaries and events. Prefer improving the helper when
history analysis gets repetitive instead of writing one-off snippets.
