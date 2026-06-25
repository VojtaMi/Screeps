# CLAUDE.md

Use `AGENTS.md` as the source of truth for this project.

## Local Skills

This project has local skills in `.claude/skills/`. They are not automatically listed in the system reminder — use them by name when relevant:

- `/screeps-live-loop` — make a change, deploy, and verify against live game state
- `/screeps-live-check` — read-only inspection of live Screeps state (account, shard, Memory, console, CPU, rooms, creeps)
- `/screeps-investigate-problem` — diagnose a bot symptom before implementing; hands off to `/screeps-live-loop`
- `/screeps-post-loop-cleanup` — clean up code after a working change without altering behavior
- `/screeps-history-inspection` — analyze static room history (raids, structure losses, creep deaths)
