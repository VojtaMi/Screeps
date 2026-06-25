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
- `npm run deploy:screeps`: deploys `dist/main.js`; requires `SCREEPS_TOKEN`, optional `SCREEPS_BRANCH`.

## Game Access And MCP

This repo has a project-local Screeps MCP server in `.codex/config.toml` for Codex and `.mcp.json` for Claude Code. Both start through `scripts/screeps-mcp.sh`, which loads `.env` and uses `.screeps-mcp/config.json`.

For local setup on each machine, copy `.env.example` to `.env` and set `SCREEPS_MMO_TOKEN`. Use the MCP tools when live game state helps, but do not deploy or take destructive live-game actions unless explicitly requested.

Do not use generic MCP code-publishing tools such as `push_code` for this project. Use `npm run deploy:screeps` for direct local deploys, or commit/push to `development` and let GitHub Actions deploy. MCP should be used for live inspection, side-effect-free console probes, and explicitly authorized one-off live operations.

Use the repo-local `screeps-live-loop` skill when the user asks for a full edit, deploy, and live-game verification loop.

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

Default build plans are room-specific and currently defined in `src/managers/buildPlanManager.ts`. Build plan items may use `purpose: "controllerDelivery"` for special controller-container behavior.

## Deployment

GitHub Actions deploys on pushes to the `development` branch. The workflow builds, deploys to Screeps using `SCREEPS_TOKEN`, and force-publishes compiled output to the `screeps-live` branch.

Do not deploy, push, commit, or modify Git history unless explicitly requested.

## Editing Guidance

Preserve existing user changes in the working tree. If files are already modified, inspect them and work with the current state rather than reverting.

Prefer existing project patterns over new abstractions. Keep Screeps logic simple and tick-conscious. Avoid adding dependencies unless they clearly improve the bot or tooling.

Do not break scalability. New behavior must work across the bot's full lifecycle, not just the current room's state. The bot must be able to recover and rebuild a room automatically from a low RCL (after an attack, claim, or reset), so changes should degrade gracefully when assets are missing rather than assuming the current setup. Concretely:

- Do not hardcode the current RCL, room layout, structure counts, or creep counts. Derive behavior from live game state (`controller.level`, what structures actually exist, available energy) so it adapts as the room grows or is rebuilt.
- Guard for missing structures. Code that reads towers, storage, links, terminal, or key ramparts must handle their absence (e.g. early RCL or after destruction) instead of assuming they exist.
- When in doubt, ask: "would this still work if the room dropped to RCL 2 with one spawn and had to rebuild itself?" If not, generalize it.
