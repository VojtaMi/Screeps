---
name: screeps-live-loop
description: Use when the user asks to make a Screeps bot change and verify it against live game state, especially requests like full loop, deploy and check, push then inspect Screeps, automated live iteration, or confirm a change worked after GitHub Actions deploys.
---

# Screeps Live Loop

Use this goal-driven workflow to connect local code changes, authorized publish/deploy actions, and live Screeps verification.

## Guardrails

- Follow project instructions from `AGENTS.md`; if they are not already in context, read `AGENTS.md` before acting.
- Start by restating the requested goal and the observable success criteria.
- Treat explicit invocation of `$screeps-live-loop`, "full live loop", "deploy and check", "push then inspect", or equivalent wording as authorization to stage relevant files, commit, push the current branch, wait for deployment, and verify live behavior.
- Do not switch active branches, mutate live Memory, or run side-effecting console commands unless the user explicitly asks for that specific live action.
- Automatically fix routine failures: typecheck, lint, build, obvious deploy-log failures, and clear live-verification mismatches.
- Ask the user before non-obvious Screeps strategy, architecture, or product-behavior decisions.
- Keep observations tied to concrete Screeps ticks, room names, creep names, branch names, workflow run IDs, or timestamps.
- Do not report success until local checks pass and, when deployed, live Screeps state confirms the goal or the remaining uncertainty is clearly stated.

## Efficient Live MCP Use

- Load likely Screeps MCP tools in one upfront `tool_search` batch.
- If live state matters, first confirm the active account and shard. This repo's MMO bot currently runs on `shard3`; pin all room-object, room-status, Memory, console, CPU, and tick-time reads to `shard3` unless account data proves otherwise.
- Prefer `execute_console` with `console.log(JSON.stringify(...))` for current live state.
- Avoid `get_room_objects` for normal live checks because responses can be huge or stale; reserve it for cases where object-position snapshots are specifically needed.
- Read full Memory once when broad state is unknown instead of probing many likely-empty paths.
- Poll console output no faster than Screeps tick cadence; wait between reads instead of making rapid empty calls.
- Do not clear the console buffer until the expected expression output is captured or deliberately abandoned.
- For deployment verification, prefer the deterministic code-update check over GitHub Actions status: after `npm run build`, run `npm run code:fingerprint -- dist/main.js`, then `npm run check:update -- --file dist/main.js`.
- Use GitHub Actions status/logs only when the code-update check times out or deployment failure details are needed.

## Workflow

0. Diagnose first when the goal is unclear.
   - If the stated goal requires understanding a symptom, unexpected behavior, or root cause before coding, run `$screeps-investigate-problem` and wait for a clear implementation target before continuing.
   - Skip this step when the goal is a concrete, already-diagnosed change.
   - If the goal is a one-off live action or a hypothesis you want to test before committing to a code change (move a creep, try a behavior manually, validate an assumption live), consider using `$screeps-remote-operate` first before writing permanent code.

1. Inspect the current state.
   - Check `git status --short`.
   - Read relevant code and any existing user changes before editing.
   - If live state matters, use read-only MCP checks for account, branch/code, console output, CPU, room state, creep/spawn state, tick time, and Memory.
   - Treat unpinned or wrong-shard room data as suspect even when room names and controller coordinates look plausible.

2. Make the local change.
   - Change code only when needed for the stated goal.
   - Follow existing TypeScript and Screeps patterns.
   - Keep logic tick-conscious and avoid new dependencies unless clearly justified.
   - Update role names, memory types, and spawn logic together when any role contract changes.

3. Verify locally.
   - Run `npm run ci` before handoff.
   - Run `npm run build` when deployment behavior or bundled output matters.
   - Fix formatting with `npm run check:write` only when Biome reports safe fixes or formatting problems.
   - Iterate automatically on routine local failures.

4. Publish when the loop is authorized.
   - If the user invoked this skill or asked for the full live loop, stage only relevant files, commit with a concise message, and push the current branch.
   - Generate the expected deployed-code fingerprint with `npm run code:fingerprint -- dist/main.js`.
   - Wait for deploy by running `npm run check:update -- --file dist/main.js`; pass `--branch` if the target branch is not `SCREEPS_BRANCH` or `default`.
   - If the code-update check times out, inspect GitHub Actions status/logs when available to diagnose why deploy did not reach Screeps.
   - If the workflow fails, inspect logs, fix routine causes, rerun local checks, and ask before pushing additional changes when the fix requires a non-obvious decision.

5. Verify live behavior.
   - After deploy completes or the code fingerprint appears, wait long enough for Screeps to tick and load the new code.
   - Use read-only MCP tools or side-effect-free console expressions to inspect branch/code state, console output, CPU, room objects, creeps, spawns, and Memory related to the change.
   - If behavior depends on multiple ticks, sample more than once and compare before/after observations.
   - Iterate automatically on clear live-verification mismatches that have an obvious local fix and are covered by the original authorization. A re-commit and re-push to fix a live mismatch caused by the same change counts as covered; a new behavioral decision does not.

6. Report the result.
   - Summarize the goal, code change, local verification, publish/deploy result, and live Screeps observations.
   - Include any remaining uncertainty, such as behavior that needs more game ticks, energy availability, spawn timing, or hostile room conditions.
   - When the change is behavioral and the diff is non-trivial, suggest running `$screeps-post-loop-cleanup` as the next step.
