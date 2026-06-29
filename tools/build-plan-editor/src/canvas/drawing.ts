import { BuildPlanItem, RoomLandmark, STRUCTURE_COLORS } from "../types";
import { CELL_SIZE, GRID_SIZE } from "../constants";
import { getTerrainAt } from "../plan/validationCore.mjs";

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
      const code = getTerrainAt(terrain, x, y);
      let color = colors.plain;
      if (code & 1) color = colors.wall;
      else if (code & 2) color = colors.swamp;

      ctx.fillStyle = color;
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }
}

export function drawGrid(ctx: CanvasRenderingContext2D): void {
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
}

export function drawLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: RoomLandmark[]
): void {
  for (const landmark of landmarks) {
    const x = landmark.x * CELL_SIZE;
    const y = landmark.y * CELL_SIZE;
    const centerX = x + CELL_SIZE / 2;
    const centerY = y + CELL_SIZE / 2;

    ctx.save();
    ctx.lineWidth = 2;
    ctx.strokeStyle = getLandmarkColor(landmark.type);
    ctx.fillStyle = "rgba(16, 19, 26, 0.72)";

    if (landmark.type === "controller") {
      ctx.beginPath();
      ctx.rect(x + 2.5, y + 2.5, CELL_SIZE - 5, CELL_SIZE - 5);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(centerX, y + 4);
      ctx.lineTo(x + CELL_SIZE - 4, centerY);
      ctx.lineTo(centerX, y + CELL_SIZE - 4);
      ctx.lineTo(x + 4, centerY);
      ctx.closePath();
      ctx.stroke();
    } else if (landmark.type === "source") {
      ctx.beginPath();
      ctx.arc(centerX, centerY, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = getLandmarkColor(landmark.type);
      ctx.beginPath();
      ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(centerX, y + 2.5);
      ctx.lineTo(x + CELL_SIZE - 2.5, centerY);
      ctx.lineTo(centerX, y + CELL_SIZE - 2.5);
      ctx.lineTo(x + 2.5, centerY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    if (landmark.label) {
      ctx.fillStyle = getLandmarkColor(landmark.type);
      ctx.font = "7px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textAlign = "center";
      ctx.fillText(landmark.label.slice(0, 2), centerX, y + CELL_SIZE - 3);
    }

    ctx.restore();
  }
}

function getLandmarkColor(type: RoomLandmark["type"]): string {
  if (type === "controller") return "#a78bfa";
  if (type === "source") return "#facc15";
  return "#38bdf8";
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
