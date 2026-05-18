import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourcePath = path.join(root, "src", "buildPlans.ts");
const terrainDir = path.join(root, "tools", "artifacts", "terrain");
const outputPath = path.join(root, "tools", "artifacts", "build-plan-viewer.html");

const structureConstants = {
  STRUCTURE_CONTAINER: "container",
  STRUCTURE_EXTENSION: "extension",
  STRUCTURE_RAMPART: "rampart",
  STRUCTURE_ROAD: "road",
  STRUCTURE_TOWER: "tower",
  STRUCTURE_WALL: "constructedWall",
};

const source = await readFile(sourcePath, "utf8");

function parseBuildPlans(text) {
  const plans = {};
  const defaultPlansIndex = text.indexOf("export const DEFAULT_BUILD_PLANS");
  if (defaultPlansIndex === -1) {
    throw new Error("Could not find DEFAULT_BUILD_PLANS.");
  }

  const roomBlockPattern = /([WE]\d+[NS]\d+):\s*{\s*plan:\s*\[([\s\S]*?)\]\s*,?\s*}/g;
  const planText = text.slice(defaultPlansIndex);
  let roomMatch;

  while ((roomMatch = roomBlockPattern.exec(planText))) {
    const [, roomName, itemsText] = roomMatch;
    const items = [];
    const itemPattern = /\{([^{}]+)\}/g;
    let itemMatch;

    while ((itemMatch = itemPattern.exec(itemsText))) {
      const rawItem = itemMatch[1];
      const structureConstant = rawItem.match(
        /structureType:\s*(STRUCTURE_[A-Z_]+)/,
      )?.[1];

      if (!structureConstant) {
        continue;
      }

      items.push({
        x: Number(rawItem.match(/\bx:\s*(\d+)/)?.[1]),
        y: Number(rawItem.match(/\by:\s*(\d+)/)?.[1]),
        structureType:
          structureConstants[structureConstant] ?? structureConstant,
        purpose: rawItem.match(/purpose:\s*"([^"]+)"/)?.[1],
      });
    }

    plans[roomName] = { plan: items };
  }

  if (Object.keys(plans).length === 0) {
    throw new Error("Could not parse any default build plans.");
  }

  return plans;
}

async function loadTerrainSnapshots(roomNames) {
  const snapshots = {};

  for (const roomName of roomNames) {
    const snapshotPath = path.join(terrainDir, `${roomName}.json`);

    try {
      const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
      if (snapshot.terrain?.length === 2500) {
        snapshots[roomName] = snapshot;
      }
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return snapshots;
}

const plans = parseBuildPlans(source);
const terrainSnapshots = await loadTerrainSnapshots(Object.keys(plans));
const generatedAt = new Date().toISOString();

const html = String.raw`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Screeps Build Plan Viewer</title>
    <style>
      :root {
        color-scheme: dark;
        --bg: #10131a;
        --panel: #181d26;
        --panel-soft: #202634;
        --text: #eef2f7;
        --muted: #98a2b3;
        --grid: #2c3444;
        --plain: rgb(44, 44, 44);
        --swamp: rgb(40, 51, 29);
        --wall: rgb(19, 19, 19);
        --road: #9ca3af;
        --extension: #f4c542;
        --container: #c98943;
        --tower: #ef6f6c;
        --rampart: #4fd1a5;
        --constructedWall: #aeb6c2;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background: var(--bg);
        color: var(--text);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
          "Segoe UI", sans-serif;
      }

      main {
        width: min(1180px, calc(100vw - 32px));
        margin: 0 auto;
        padding: 24px 0 36px;
      }

      header {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 18px;
      }

      h1,
      h2 {
        margin: 0;
        letter-spacing: 0;
      }

      h1 {
        font-size: clamp(1.5rem, 2.5vw, 2.2rem);
      }

      h2 {
        font-size: 1rem;
      }

      .muted {
        color: var(--muted);
        font-size: 0.9rem;
      }

      .toolbar,
      .panel,
      .legend {
        border: 1px solid #303849;
        background: var(--panel);
      }

      .toolbar {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        padding: 12px;
        margin-bottom: 16px;
      }

      select,
      button {
        border: 1px solid #384254;
        border-radius: 6px;
        background: var(--panel-soft);
        color: var(--text);
        font: inherit;
      }

      select,
      button {
        min-height: 36px;
        padding: 0 12px;
      }

      button {
        cursor: pointer;
      }

      .layout {
        display: grid;
        grid-template-columns: minmax(320px, 1fr) 280px;
        gap: 16px;
        align-items: start;
      }

      .panel {
        padding: 14px;
      }

      .canvas-wrap {
        width: 100%;
        overflow: auto;
      }

      canvas {
        display: block;
        width: min(100%, 750px);
        height: auto;
        image-rendering: pixelated;
      }

      .stack {
        display: grid;
        gap: 16px;
      }

      .legend {
        display: grid;
        gap: 10px;
        padding: 14px;
      }

      .legend-row {
        display: grid;
        grid-template-columns: 18px 1fr auto;
        gap: 8px;
        align-items: center;
        font-size: 0.92rem;
      }

      .swatch {
        width: 18px;
        height: 18px;
        border: 1px solid #ffffff55;
      }

      @media (max-width: 860px) {
        header {
          align-items: start;
          flex-direction: column;
        }

        .layout {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <header>
        <div>
          <h1>Screeps Build Plan Viewer</h1>
          <div class="muted">Generated ${generatedAt}</div>
        </div>
        <div class="muted" id="summary"></div>
      </header>

      <div class="toolbar">
        <label>
          Room
          <select id="roomSelect"></select>
        </label>
        <button id="toggleCoords" type="button">Coordinates</button>
      </div>

      <div class="layout">
        <section class="panel">
          <h2>Build Plan</h2>
          <div class="canvas-wrap">
            <canvas id="planCanvas" width="750" height="750"></canvas>
          </div>
        </section>

        <aside class="stack">
          <section class="legend" id="legend">
            <h2>Legend</h2>
          </section>
        </aside>
      </div>
    </main>

    <script>
      const buildPlans = ${JSON.stringify(plans, null, 2)};
      const terrainSnapshots = ${JSON.stringify(terrainSnapshots, null, 2)};
      const colors = {
        plain: "rgb(44, 44, 44)",
        swamp: "rgb(40, 51, 29)",
        wall: "rgb(19, 19, 19)",
        grid: "#2c3444",
        road: "#9ca3af",
        extension: "#f4c542",
        container: "#c98943",
        tower: "#ef6f6c",
        rampart: "#4fd1a5",
        constructedWall: "#aeb6c2",
      };
      const labels = {
        road: "Road",
        extension: "Extension",
        container: "Container",
        tower: "Tower",
        rampart: "Rampart",
        constructedWall: "Wall",
      };

      const roomSelect = document.querySelector("#roomSelect");
      const planCanvas = document.querySelector("#planCanvas");
      const legend = document.querySelector("#legend");
      const summary = document.querySelector("#summary");
      const toggleCoords = document.querySelector("#toggleCoords");
      const cellSize = 15;
      let showCoords = true;

      for (const roomName of Object.keys(buildPlans)) {
        const option = document.createElement("option");
        option.value = roomName;
        option.textContent = roomName;
        roomSelect.append(option);
      }

      function getTerrain(roomName) {
        return terrainSnapshots[roomName]?.terrain ?? "";
      }

      function drawBase(ctx, terrain) {
        ctx.clearRect(0, 0, 750, 750);

        for (let y = 0; y < 50; y += 1) {
          for (let x = 0; x < 50; x += 1) {
            const terrainCode = Number(terrain[y * 50 + x] ?? 0);
            ctx.fillStyle =
              terrainCode & 1 ? colors.wall : terrainCode & 2 ? colors.swamp : colors.plain;
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }

        ctx.strokeStyle = colors.grid;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 50; i += 1) {
          const pos = i * cellSize + 0.5;
          ctx.beginPath();
          ctx.moveTo(pos, 0);
          ctx.lineTo(pos, 750);
          ctx.moveTo(0, pos);
          ctx.lineTo(750, pos);
          ctx.stroke();
        }

        if (!showCoords) {
          return;
        }

        ctx.fillStyle = "#cad1dd";
        ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, monospace";
        for (let i = 0; i < 50; i += 5) {
          ctx.fillText(String(i), i * cellSize + 2, 9);
          ctx.fillText(String(i), 2, i * cellSize + 10);
        }
      }

      function drawPlan(ctx, plan) {
        for (const item of plan) {
          const centerX = item.x * cellSize + cellSize / 2;
          const centerY = item.y * cellSize + cellSize / 2;
          ctx.fillStyle = colors[item.structureType] ?? "#ffffff";
          ctx.strokeStyle = "#0b0f14";
          ctx.lineWidth = 2;

          if (item.structureType === "road") {
            ctx.beginPath();
            ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
            ctx.fill();
            continue;
          }

          if (item.structureType === "rampart") {
            ctx.fillRect(item.x * cellSize + 2, item.y * cellSize + 2, 11, 11);
            ctx.strokeRect(item.x * cellSize + 2, item.y * cellSize + 2, 11, 11);
            continue;
          }

          ctx.beginPath();
          ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          if (item.purpose) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(centerX - 2, centerY - 2, 4, 4);
          }
        }
      }

      function renderLegend(plan) {
        const counts = plan.reduce((acc, item) => {
          acc[item.structureType] = (acc[item.structureType] ?? 0) + 1;
          return acc;
        }, {});

        legend.replaceChildren(Object.assign(document.createElement("h2"), { textContent: "Legend" }));
        for (const [type, count] of Object.entries(counts).sort()) {
          const row = document.createElement("div");
          row.className = "legend-row";
          row.innerHTML = '<span class="swatch"></span><span></span><strong></strong>';
          row.querySelector(".swatch").style.background = colors[type] ?? "#ffffff";
          row.querySelector("span:nth-child(2)").textContent = labels[type] ?? type;
          row.querySelector("strong").textContent = count;
          legend.append(row);
        }
      }

      function render() {
        const roomName = roomSelect.value;
        const plan = buildPlans[roomName].plan;
        const terrain = getTerrain(roomName);

        drawBase(planCanvas.getContext("2d"), terrain);
        drawPlan(planCanvas.getContext("2d"), plan);
        renderLegend(plan);
        const terrainShard = terrainSnapshots[roomName]?.shard;
        summary.textContent =
          roomName +
          " · " +
          plan.length +
          " planned structures" +
          (terrainShard ? " · terrain " + terrainShard : "");
      }

      roomSelect.addEventListener("change", render);
      toggleCoords.addEventListener("click", () => {
        showCoords = !showCoords;
        render();
      });

      render();
    </script>
  </body>
</html>
`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, html);
console.log(`Wrote ${path.relative(root, outputPath)}`);
