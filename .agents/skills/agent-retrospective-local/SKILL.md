---
name: agent-retrospective-local
description: Screeps project-specific agent retrospective. Use when the user asks to analyze an agent mistake, bad assumption, manual correction, repeated investigation, missing context, missing tool, failed workflow, Screeps live/history confusion, or "why did the agent get stuck?" Produce improvement recommendations across code, tests, AGENTS.md, Screeps skills, scripts/tooling, and OKF-style project knowledge notes.
---

# Screeps Agent Retrospective

## Purpose

Use this skill to turn agent misses into durable project improvements. The goal
is not to assign blame; it is to identify what would have let a future agent do
better sooner.

## Inputs To Collect

Start from the user's description, then inspect available artifacts as needed:

- Conversation summary, failed output, manual correction, diff, logs, or command
  output.
- Relevant code, docs, skills, scripts, and project instructions.
- For Screeps incidents, use read-only history/live-inspection skills when the
  underlying game behavior matters. Do not deploy or mutate live game state
  during the retrospective unless the user explicitly asks.

## Analysis Workflow

1. Identify the miss.
   - Name the incorrect assumption, missing context, underused tool, bad
     workflow step, or unclear handoff.
   - Separate confirmed facts from plausible inferences.

2. Find the earliest detectable signal.
   - Ask what file, command, history window, live check, test, or existing
     instruction should have changed the agent's path.
   - Prefer concrete signals over broad advice.

3. Classify the cause.
   - Knowledge gap: durable project fact was missing or hard to find.
   - Workflow gap: the right procedure exists only in the user's head.
   - Tooling gap: repeated manual inspection should become a script or helper.
   - Validation gap: tests, typechecks, history checks, or live checks did not
     catch the issue.
   - Instruction gap: `AGENTS.md` or a skill needs a sharper rule.
   - Execution gap: the agent ignored or misapplied existing instructions.

4. Recommend destinations.
   - Code fix: behavior is wrong or brittle.
   - Test: regression risk is meaningful and locally testable.
   - `AGENTS.md`: every future agent in this repo must follow the rule.
   - Skill update: a recurring workflow needs a procedural step or guardrail.
   - Script/tool: the user repeatedly performs the same manual inspection.
   - OKF-style knowledge note: a durable project fact should be retrievable but
     is not a commandment or workflow by itself.
   - No change: the issue is one-off, already covered, or not worth preserving.

5. Produce a concise recommendation.
   - Lead with the highest-impact improvement.
   - Include exact files or folders.
   - Draft text or patch ideas when useful.
   - Call out when an OKF note is not the right destination.

## OKF-Style Project Knowledge

Use `.knowledge/` for durable notes that help future agents reason about this
project. Notes should be short, factual, and portable.

Before adding a note:

- Search `.knowledge/` for related content and update an existing note when it
  fits.
- Do not store secrets, temporary command output, full source copies, or broad
  agent diary entries.
- Prefer `AGENTS.md` for mandatory repo rules and skills for repeatable
  workflows.

Recommended frontmatter:

```yaml
---
type: invariant | incident | decision | runbook-note | failure-mode
title: Short Title
description: One-sentence summary.
resource: path/to/most/relevant/file-or-folder
tags:
  - screeps
  - short-tag
timestamp: YYYY-MM-DDTHH:MM:SSZ
---
```

Recommended body:

- Explain the durable fact.
- Link it to relevant files, scripts, skills, rooms, or ticks.
- State what future agents should check or avoid.
- Keep it short enough to scan.

## Output Shape

Use this shape unless the user asks for patches directly:

```text
Finding:
...

Cause:
...

Earliest signal:
...

Recommended improvements:
- Destination: ...
  Change: ...
  Why: ...
```

When implementing the improvements, keep edits scoped and run the relevant
validation. For this repo, run `npm run ci` before handing off code changes;
for docs-only skill/knowledge updates, validate the skill with the skill
creator's `quick_validate.py`.
