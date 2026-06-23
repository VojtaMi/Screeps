---
name: screeps-investigate-problem
description: Use when the user reports a Screeps bot symptom or issue and wants the problem understood before implementation, especially requests to analyze behavior, inspect relevant code, optionally check live game state, form hypotheses, or prepare a handoff into the Screeps live loop.
---

# Screeps Investigate Problem

Use this read-only workflow to turn a Screeps bot symptom into a clear diagnosis, compare solution shapes, and prepare an implementation-ready handoff.

## Guardrails

- Follow project instructions from `AGENTS.md`; if they are not already in context, read `AGENTS.md` before acting.
- Do not edit files, commit, push, deploy, switch active branches, mutate live Memory, or run side-effecting console commands.
- Start by restating the symptom, expected behavior, affected room/role/system when known, and what evidence would confirm the problem.
- Prefer discovering code context before asking questions; ask only when intent or expected behavior cannot be inferred.
- Use live Screeps checks only when current game state would materially improve the diagnosis, and keep them read-only.
- Look beyond the nearest local fix when the surrounding design is likely causing repeated complexity, duplicated rules, or fragile behavior.
- End with analysis and a concrete proposed `$screeps-live-loop` goal; do not start implementation unless the user asks to continue.

## Investigation Workflow

1. Frame the problem.
   - Restate the reported symptom and likely user-facing impact.
   - Define the suspected success criteria in observable Screeps terms.
   - Identify missing intent questions only after checking available code context.

2. Inspect code context.
   - Use `rg` to find relevant roles, managers, memory fields, constants, and tests or checks.
   - Read the smallest set of files needed to understand the behavior path.
   - Trace data flow from decision input to action output, such as spawn request selection, role assignment, target selection, or room routing.
   - Note important existing constraints from types, Memory shape, build plans, and manager ordering.

3. Optionally inspect live state.
   - Use `$screeps-live-check` rules for any live reads.
   - Pin MMO reads to the active shard, currently `shard3` unless account data proves otherwise.
   - Prefer compact read-only console summaries over large room-object dumps.
   - Tie observations to tick/time, room, creep, spawn, Memory path, branch, or code fingerprint.

4. Produce the diagnosis.
   - Separate confirmed facts from hypotheses.
   - Name the likely cause, competing explanations, and evidence for or against each.
   - Identify the likely implementation area without writing code.
   - Compare the narrow fix against any cleaner architecture or point-of-view change that would simplify future logic.
   - Recommend the smallest solution that actually improves the underlying model, not just the observed symptom.
   - Call out any architectural or strategy decision the user should choose before implementation.

5. Hand off cleanly.
   - Propose a concise `$screeps-live-loop` goal with the recommended solution shape, success criteria, and verification steps.
   - Ask whether the user wants to continue with `$screeps-live-loop`.
   - If the diagnosis is not strong enough, ask the smallest useful question or recommend one more read-only check.

## Output Shape

- **Problem:** the symptom and expected behavior.
- **Context:** relevant code paths and optional live observations.
- **Likely Cause:** best-supported explanation plus alternatives if meaningful.
- **Solution Shape:** narrow fix, broader simplification if useful, and recommended path.
- **Loop Handoff:** implementation goal, success criteria, and verification approach for `$screeps-live-loop`.
