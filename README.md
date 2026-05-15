# Screeps Bot

A TypeScript Screeps project.

Source code lives in `src/` and the Screeps game loop is exported from `src/main.ts`. The project is bundled to JavaScript with esbuild.

GitHub Actions builds the TypeScript project, deploys the compiled JavaScript to Screeps, and publishes the built output to the `screeps-live` branch.
