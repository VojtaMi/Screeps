---
name: screeps-live-check
description: Use when the user asks to inspect, diagnose, summarize, or monitor live Screeps state without changing code or mutating the game, especially account, shard, branch, code, console, CPU, Memory, room, creep, spawn, or tick-time checks.
---

# Screeps Live Check

Use this read-only workflow to inspect live Screeps state efficiently and report concrete observations.

## Guardrails

- Follow project instructions from `AGENTS.md`; if they are not already in context, read `AGENTS.md` before acting.
- Do not edit files, commit, push, deploy, switch active branches, mutate live Memory, or run side-effecting console commands.
- Use only read-only MCP tools and side-effect-free console expressions.
- Keep observations tied to concrete Screeps ticks, room names, creep names, spawn names, branch names, shard names, or timestamps.
- If the requested diagnosis would require a code change or live mutation, report what you found and stop before acting.

## Efficient Live MCP Use

- Load likely Screeps MCP tools in one upfront `tool_search` batch.
- First confirm the active account and shard. This repo's MMO bot currently runs on `shard3`; pin all room-object, room-status, Memory, console, CPU, and tick-time reads to `shard3` unless account data proves otherwise.
- Prefer `execute_console` with `console.log(JSON.stringify(...))` for current live state.
- Avoid `get_room_objects` for normal live checks because responses can be huge or stale; reserve it for cases where object-position snapshots are specifically needed.
- Read full Memory once when broad state is unknown instead of probing many likely-empty paths.
- Poll console output no faster than Screeps tick cadence; wait between reads instead of making rapid empty calls.
- Do not clear the console buffer until the expected expression output is captured or deliberately abandoned.
- For deployed-code checks, prefer the deterministic code-update check over GitHub Actions status: run `npm run check:update -- --file dist/main.js --once` when the local bundle is available, or use `--sha256` / `--fingerprint` when a known expected value is provided.
- Use GitHub Actions status/logs only when the code-update check fails and deployment failure details are needed.

## Workflow

1. Identify the question.
   - Restate what live state needs to be inspected and what would count as a useful answer.
   - Prefer the smallest read-only query set that can answer the question.

2. Inspect live state.
   - Confirm account, active branch/code context, and shard before room or Memory reads.
   - Check console output, CPU, tick time, Memory, rooms, creeps, and spawns relevant to the question.
   - Use side-effect-free console expressions for current room and creep summaries when direct MCP reads would be oversized or stale.

3. Sample over time when needed.
   - If behavior depends on ticks, wait for Screeps tick cadence and take at least two timestamped or tick-numbered samples.
   - Compare samples directly instead of relying on stale or unpinned data.

4. Report findings.
   - Summarize live observations with shard, tick/time, room, creep/spawn, branch, and code details where relevant.
   - Call out uncertainty from stale data, missing visibility, insufficient ticks, empty Memory, CPU limits, or unavailable tool access.
   - Recommend next actions only as suggestions; do not make code or live-game changes from this skill.
