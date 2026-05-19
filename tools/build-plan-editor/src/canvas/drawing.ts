import { BuildPlanItem, BuildPlansData, STRUCTURE_COLORS } from "../types";
import { CELL_SIZE, GRID_SIZE } from "../constants";

interface ValidationError {
  step: number;
  message: string;
}

export function drawTerrain(
  ctx: CanvasRenderingContext2D,
  terrain: string
): void {
  if (!terrain) return;

  const colors = {
    plain: "rgb(44, 44, 44)",
    swamp: "rgb(40, 51, 29)",
    wall: "rgb(19, 19, 19)",
  };

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const code = Number(terrain[y * GRID_SIZE + x] ?? 0);
      let color = colors.plain;
      if (code & 1) color = colors.wall;
      else if (code & 2) color = colors.swamp;

      ctx.fillStyle = color;
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  showCoordinates: boolean
): void {
  ctx.strokeStyle = "#2c3444";
  ctx.lineWidth = 1;

  for (let i = 0; i <= GRID_SIZE; i++) {
    const pos = i * CELL_SIZE + 0.5;
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, GRID_SIZE * CELL_SIZE);
    ctx.moveTo(0, pos);
    ctx.lineTo(GRID_SIZE * CELL_SIZE, pos);
    ctx.stroke();
  }

  if (!showCoordinates) {
    return;
  }

  ctx.fillStyle = "#cad1dd";
  ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, monospace";
  for (let i = 0; i < GRID_SIZE; i += 5) {
    ctx.fillText(String(i), i * CELL_SIZE + 2, 9);
    ctx.fillText(String(i), 2, i * CELL_SIZE + 10);
  }
}

export function drawPlan(
  ctx: CanvasRenderingContext2D,
  plan: BuildPlanItem[],
  currentStep: number,
  selectedItemIndex: number | null,
  validationErrors: ValidationError[]
): void {
  const tileItems = new Map<
    string,
    Array<{ item: BuildPlanItem; index: number }>
  >();

  for (const [index, item] of plan.entries()) {
    const key = `${item.x},${item.y}`;
    tileItems.set(key, [...(tileItems.get(key) ?? []), { item, index }]);
  }

  for (const items of tileItems.values()) {
    drawTileStructures(
      ctx,
      items,
      currentStep,
      selectedItemIndex,
      validationErrors
    );
  }
}

function drawTileStructures(
  ctx: CanvasRenderingContext2D,
  items: Array<{ item: BuildPlanItem; index: number }>,
  currentStep: number,
  selectedItemIndex: number | null,
  validationErrors: ValidationError[]
): void {
  const [{ item: firstItem }] = items;
  const x = firstItem.x * CELL_SIZE;
  const y = firstItem.y * CELL_SIZE;
  const centerX = x + CELL_SIZE / 2;
  const centerY = y + CELL_SIZE / 2;
  const rampart = items.find(
    ({ item }) => item.structureType === "STRUCTURE_RAMPART"
  );
  const road = items.find(
    ({ item }) => item.structureType === "STRUCTURE_ROAD"
  );
  const mainStructure = items.find(
    ({ item }) =>
      item.structureType !== "STRUCTURE_RAMPART" &&
      item.structureType !== "STRUCTURE_ROAD"
  );
  const selected = items.find(({ index }) => index === selectedItemIndex);
  const hasError = items.some(({ index }) =>
    validationErrors.some((error) => error.step === index)
  );

  if (rampart) {
    ctx.fillStyle = getStructureColor(
      rampart.item,
      rampart.index >= currentStep
    );
    ctx.fillRect(x + 2, y + 2, 11, 11);
  }

  if (mainStructure) {
    ctx.fillStyle = getStructureColor(
      mainStructure.item,
      mainStructure.index >= currentStep
    );
    ctx.beginPath();
    ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
    ctx.fill();

    if (mainStructure.item.purpose) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(centerX - 2, centerY - 2, 4, 4);
    }
  }

  if (road) {
    ctx.fillStyle = getStructureColor(road.item, road.index >= currentStep);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  if (hasError || selected) {
    ctx.strokeStyle = hasError ? "#ff0000" : "#00ff00";
    ctx.lineWidth = hasError ? 3 : 2.5;
    ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);
  }
}

export function getStructureColor(
  item: BuildPlanItem,
  isAfterStep: boolean
): string {
  const color = STRUCTURE_COLORS[item.structureType] || "#ffffff";
  return isAfterStep ? adjustBrightness(color, 0.5) : color;
}

export function adjustBrightness(color: string, factor: number): string {
  const num = parseInt(color.replace("#", ""), 16);
  const r = Math.round((num >> 16) * factor);
  const g = Math.round(((num >> 8) & 0x00ff) * factor);
  const b = Math.round((num & 0x0000ff) * factor);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
