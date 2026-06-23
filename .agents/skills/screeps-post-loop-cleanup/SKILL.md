---
name: screeps-post-loop-cleanup
description: Use after a Screeps live loop, behavior fix, or bot change to review the changed diff, preserve behavior, clean tangled code, improve responsibility boundaries, prefer functional splits, and run local verification before handoff.
---

# Screeps Post Loop Cleanup

Use this workflow after a working Screeps change to keep the codebase clean without changing behavior.

## Guardrails

- Follow project instructions from `AGENTS.md`; if they are not already in context, read `AGENTS.md` before acting.
- Preserve behavior unless the user explicitly asks for behavior changes.
- Do not commit, push, deploy, switch active branches, mutate live Memory, or run side-effecting console commands unless the user explicitly asks for that live action.
- Clean only within the changed scope from the loop or the smallest directly related module boundary.
- Prefer simple functional splits over new classes, broad frameworks, or symmetry-driven abstractions.
- Do not weaken type, lint, or Screeps safety rules to finish cleanup.

## Workflow

1. Inspect the changed surface.
   - Check `git status --short` and inspect the relevant diff or commits.
   - Identify which behavior the loop changed and which files are directly in that path.
   - State the cleanup scope before substantial edits.

2. Identify the Screeps mental model.
   - Describe the code in game terms: room, role, spawn request, target selection, Memory field, build plan, manager, or live verification helper.
   - Separate orchestration from mechanics.
   - Treat `main.ts`, manager ordering, role dispatch, spawn priority, and cross-room coordination as orchestration.
   - Treat scoring, filtering, target lookup, request construction, role-local actions, and small calculations as mechanics.

3. Refactor conservatively.
   - Extract pure helpers for repeated or dense Screeps decisions.
   - Move role-specific mechanics near the role and manager-specific mechanics near the manager.
   - Keep shared types in existing shared type files only when more than one module owns the contract.
   - Keep role names synchronized across `CreepRole`, role maps, spawn logic, and `CreepMemory`.
   - Keep custom creep helpers synchronized between `extendCreep.ts` and `globals.d.ts`.
   - Avoid moving unrelated files or changing public behavior to satisfy a preferred folder shape.

4. Verify.
   - Run `npm run ci` before handoff.
   - Run `npm run build` when bundled output, deploy behavior, or module shape changed.
   - Use live checks only if the user asks for live verification; otherwise keep this cleanup local.

5. Report.
   - Summarize the behavior preserved, cleanup scope, responsibility split, and verification results.
   - Call out any remaining design smell that would require a behavior or architecture decision.
