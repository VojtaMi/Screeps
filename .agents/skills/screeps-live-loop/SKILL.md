---
name: screeps-live-loop
description: Use when the user asks to make a Screeps bot change and verify it against live game state, especially requests like full loop, deploy and check, push then inspect Screeps, or confirm a change worked after GitHub Actions deploys.
---

# Screeps Live Loop

Use this workflow to connect local code changes, GitHub Actions deployment, and live Screeps inspection.

## Guardrails

- Read `AGENTS.md` first and follow its deployment and editing rules.
- Do not commit, push, deploy, switch active branches, mutate live Memory, or run side-effecting console commands unless the user explicitly asks for that live action.
- Prefer read-only MCP checks before and after changes: account, branches, code, console output, CPU, room objects, creep/spawn state, and Memory reads.
- Keep observations tied to concrete Screeps ticks, room names, creep names, branch names, workflow run IDs, or timestamps.

## Workflow

1. Inspect the current state.
   - Check `git status --short`.
   - Read the relevant code and any existing user changes before editing.
   - If live state matters, use Screeps MCP read tools to inspect the current branch, console output, CPU, room state, and relevant Memory.

2. Make the change locally.
   - Follow existing TypeScript and Screeps patterns.
   - Keep logic tick-conscious and avoid new dependencies unless clearly justified.
   - Update role names, memory types, and spawn logic together when any role contract changes.

3. Verify locally.
   - Run `npm run ci` before handoff.
   - Run `npm run build` when deployment behavior or bundled output matters.
   - Fix formatting with `npm run check:write` only when Biome reports safe fixes or formatting problems.

4. Publish only when requested.
   - If the user asked for the full live loop, stage only relevant files, commit with a concise message, and push the current branch.
   - If deployment is through GitHub Actions, watch the relevant workflow run until it succeeds or fails.
   - If the workflow fails, inspect logs, fix the cause, rerun local checks, and ask before pushing additional changes unless the original request clearly covers that iteration.

5. Verify live behavior.
   - After the deploy completes, wait long enough for Screeps to tick and load the new code.
   - Use MCP read tools to inspect branch/code state, console output, CPU, room objects, creeps, spawns, and Memory related to the change.
   - If behavior depends on multiple ticks, sample more than once and compare before/after observations.

6. Report the result.
   - Summarize the code change, local verification, GitHub Actions result, and live Screeps observations.
   - Include any remaining uncertainty, such as behavior that needs more game ticks or energy availability.
