# Screeps Bot

A TypeScript Screeps project.

Source code lives in `src/` and the Screeps game loop is exported from `src/main.ts`. The project is bundled to JavaScript with esbuild.

GitHub Actions builds the TypeScript project, deploys the compiled JavaScript to Screeps, and publishes the built output to the `screeps-live` branch.

## Build plan editor

Run the local React editor with:

```sh
npm run editor:dev
```

The editor loads `src/buildPlans.ts`, fetches and caches missing terrain snapshots in `tools/artifacts/terrain`, and writes confirmed changes back through its local Vite API. Set `SCREEPS_SHARD` to override the default terrain shard of `shard3`.
