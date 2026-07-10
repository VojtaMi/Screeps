# AGENTS.md

## Project Context

This is a Screeps TypeScript bot. `src/main.ts` exports the Screeps `loop()` and coordinates managers plus role dispatch. The build bundles `src/main.ts` into `dist/main.js` with esbuild.

Core structure:

- `src/main.ts`: loop orchestration, manager calls, role dispatch.
- `src/roles/*`: creep role behavior. Each role implements `Role.run(creep)`.
- `src/managers/*`: memory cleanup, build plans, and spawning.
- `src/extendCreep.ts`: installs custom `Creep.prototype` helpers.
- `src/globals.d.ts`: declares custom Screeps memory fields and creep helper types.
- `src/types.ts`: shared project types such as `CreepRole` and `Role`.

## Commands

Use these npm scripts:

- `npm run ci`: typecheck plus Biome CI check. Run this before handing off code changes.
- `npm run check:write`: apply Biome safe fixes and formatting.
- `npm run build`: typecheck then bundle to `dist/main.js`.
- `npm run deploy:screeps`: deploys `dist/main.js`; requires `SCREEPS_TOKEN` (falls back to `SCREEPS_MMO_TOKEN` if unset), optional `SCREEPS_BRANCH`. Reads `.env` directly, so it works without exporting the token first.

## Game Access And MCP

This repo has a project-local Screeps MCP server in `.codex/config.toml` for Codex and `.mcp.json` for Claude Code. Both start through `scripts/screeps-mcp.sh`, which loads `.env` and uses `.screeps-mcp/config.json`.

For local setup on each machine, copy `.env.example` to `.env` and set `SCREEPS_MMO_TOKEN`. Use the MCP tools when live game state helps, but do not deploy or take destructive live-game actions unless explicitly requested.

Do not use generic MCP code-publishing tools such as `push_code` for this project. Use `npm run deploy:screeps` for direct local deploys, or commit/push to `development` and let GitHub Actions deploy. MCP should be used for live inspection, side-effect-free console probes, and explicitly authorized one-off live operations.

Use the repo-local `screeps-live-loop` skill when the user asks for a full edit, deploy, and live-game verification loop.

Use the repo-local `agent-retrospective-local` skill when the user asks why an agent got stuck, made a wrong assumption, needed manual correction, lacked tools/context, or should suggest Screeps-specific improvements for future runs.

The `.knowledge/` directory stores OKF-style Markdown notes for durable project knowledge. Prefer `AGENTS.md` for mandatory repo-wide rules and skills for repeatable workflows; use `.knowledge/` for retrievable facts, decisions, incidents, and failure modes that are useful but not themselves commands.

## Formatting And Hooks

Biome is the source of truth for formatting and linting. Do not hand-format around Biome preferences.

The repo uses Husky with `.husky/pre-commit`. The hook runs `npm run check:staged` for staged `src/**/*.ts`, `package.json`, `tsconfig.json`, or `biome.json` files, then re-stages safe fixes.

## Screeps Conventions

`extendCreep()` must run before role logic uses custom creep helpers. If adding a new creep helper, update both `src/extendCreep.ts` and the `Creep` interface in `src/globals.d.ts`.

Role names must stay synchronized across:

- `CreepRole` in `src/types.ts`
- the `roles` map in `src/main.ts`
- spawn request logic in `src/managers/spawnManager.ts`
- any `CreepMemory.role` usage

The current spawn manager assumes the primary spawn is `Game.spawns.Spawn1`.

Default build plans are room-specific data in `src/buildPlans.json` (canonical source) and `src/buildPlans.ts` (generated — do not hand-edit; run `npm run generate:build-plans` after changing the JSON). `src/managers/buildPlanManager.ts` only has the runtime scheduling/placement logic. Build plan items may use `purpose: "controllerDelivery"` for special controller-container behavior.

Room terrain and landmarks are cached per room at `tools/artifacts/terrain/<ROOM>.json` and `tools/artifacts/landmarks/<ROOM>.json` (shard3) — read from there instead of re-fetching live terrain. Agents should validate build plan changes with `npm run check:build-plan -- [room]` and inspect a single tile (plan + terrain + live state, `--json` available) with `npm run inspect:tile -- <room> <x> <y>` — both give structured output an agent can reason over directly.

## Deployment

GitHub Actions deploys on pushes to the `development` branch. The workflow builds, deploys to Screeps using `SCREEPS_TOKEN`, and force-publishes compiled output to the `screeps-live` branch.

Do not deploy, push, commit, or modify Git history unless explicitly requested.

## Editing Guidance

Preserve existing user changes in the working tree. If files are already modified, inspect them and work with the current state rather than reverting.

Prefer existing project patterns over new abstractions. Keep Screeps logic simple and tick-conscious. Avoid adding dependencies unless they clearly improve the bot or tooling.

Do not break scalability. New behavior must work across the bot's full lifecycle, not just the current room's state. Screeps Bot Must Recover From Low RCL; for details, follow `.knowledge/invariants/recovery-must-degrade-gracefully.md`.
