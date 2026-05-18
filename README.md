# Screeps Bot

A TypeScript Screeps project.

Source code lives in `src/` and the Screeps game loop is exported from `src/main.ts`. The project is bundled to JavaScript with esbuild.

GitHub Actions builds the TypeScript project, deploys the compiled JavaScript to Screeps, and publishes the built output to the `screeps-live` branch.

## Build plan viewer

Generate a local HTML view of `DEFAULT_BUILD_PLANS` with:

```sh
npm run visualize:build-plan
```

Open `tools/artifacts/build-plan-viewer.html` in a browser to inspect the room grid, structure legend, and optional saved terrain snapshot.

Fetch the room terrain snapshot first with:

```sh
npm run fetch:terrain
```

The terrain fetch defaults to `E59S28` on `shard3`. To fetch another room or shard, pass them as arguments:

```sh
npm run fetch:terrain -- E59S28 shard3
```

## Build plan editor

Run the local React editor with:

```sh
npm run editor:dev
```

The editor loads `src/buildPlans.ts`, uses terrain snapshots from `tools/artifacts/terrain`, and writes confirmed changes back through its local Vite API.
