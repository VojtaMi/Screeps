import { useRef, useEffect } from "react";
import {
  BuildPlanItem,
  BuildPlansData,
  EditorMode,
  RoomLandmark,
} from "../types";
import { CELL_SIZE, GRID_SIZE } from "../constants";
import { validateSameTile } from "../plan/validation";
import { drawTerrain, drawGrid, drawLandmarks, drawPlan } from "./drawing";
import { TilePicker } from "./TilePicker";
import { StepControls } from "./StepControls";

interface ValidationError {
  step: number;
  message: string;
}

interface TilePickerState {
  x: number;
  y: number;
  left: number;
  top: number;
  itemIndexes: number[];
}

interface CanvasSectionProps {
  plans: BuildPlansData;
  selectedRoom: string;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  selectedItemIndex: number | null;
  setSelectedItemIndex: (index: number | null) => void;
  tilePicker: TilePickerState | null;
  setTilePicker: (state: TilePickerState | null) => void;
  editorMode: EditorMode;
  selectedStructureType: string;
  showCoordinates: boolean;
  showLandmarks: boolean;
  landmarks: RoomLandmark[];
  terrain: string;
  validationErrors: ValidationError[];
  commitPlans: (plans: BuildPlansData, nextStep?: number) => void;
  deletePlanItem: (index: number) => void;
}

export function CanvasSection({
  plans,
  selectedRoom,
  currentStep,
  setCurrentStep,
  selectedItemIndex,
  setSelectedItemIndex,
  tilePicker,
  setTilePicker,
  editorMode,
  selectedStructureType,
  showCoordinates,
  showLandmarks,
  landmarks,
  terrain,
  validationErrors,
  commitPlans,
  deletePlanItem,
}: CanvasSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    setTilePicker(null);
  }, [currentStep, setTilePicker]);

  useEffect(() => {
    redraw();
  }, [
    selectedRoom,
    currentStep,
    selectedItemIndex,
    terrain,
    plans,
    validationErrors,
    showCoordinates,
    showLandmarks,
    landmarks,
  ]);

  function redraw() {
    if (!canvasRef.current || !selectedRoom) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const width = GRID_SIZE * CELL_SIZE;
    const height = GRID_SIZE * CELL_SIZE;

    ctx.fillStyle = "#10131a";
    ctx.fillRect(0, 0, width, height);

    drawTerrain(ctx, terrain);
    drawGrid(ctx, showCoordinates);
    if (showLandmarks) {
      drawLandmarks(ctx, landmarks);
    }

    const plan = plans[selectedRoom]?.plan ?? [];
    drawPlan(ctx, plan, currentStep, selectedItemIndex, validationErrors);
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current || !selectedRoom) return;
    e.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    const plan = plans[selectedRoom].plan;
    const visibleIndexes = plan
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item, index }) =>
          index < currentStep && item.x === x && item.y === y
      )
      .map(({ index }) => index);

    if (editorMode === "build" && canPlaceStructure(plan, x, y)) {
      addPlanItem(plan, x, y);
      return;
    }

    if (editorMode === "erase") {
      if (visibleIndexes.length === 1) {
        deletePlanItem(visibleIndexes[0]);
        setTilePicker(null);
        return;
      }

      if (visibleIndexes.length > 1) {
        openTilePicker(x, y, visibleIndexes);
        return;
      }

      setTilePicker(null);
      return;
    }

    if (visibleIndexes.length === 1) {
      setSelectedItemIndex(visibleIndexes[0]);
      setTilePicker(null);
      return;
    }

    if (visibleIndexes.length > 1) {
      openTilePicker(x, y, visibleIndexes);
      return;
    }

    if (editorMode !== "build") {
      setTilePicker(null);
      return;
    }

    addPlanItem(plan, x, y);
  }

  function canPlaceStructure(plan: BuildPlanItem[], x: number, y: number) {
    const existingTypes = plan
      .filter((item) => item.x === x && item.y === y)
      .map((item) => item.structureType);

    if (existingTypes.length === 0) return true;

    if (existingTypes.includes(selectedStructureType)) return false;

    return validateSameTile([...existingTypes, selectedStructureType]);
  }

  function openTilePicker(x: number, y: number, visibleIndexes: number[]) {
    setTilePicker({
      x,
      y,
      left: x * CELL_SIZE + CELL_SIZE,
      top: y * CELL_SIZE,
      itemIndexes: visibleIndexes,
    });
  }

  function addPlanItem(plan: BuildPlanItem[], x: number, y: number) {
    const newItem: BuildPlanItem = {
      x,
      y,
      structureType: selectedStructureType,
    };

    const newPlan = [...plan];
    newPlan.splice(currentStep, 0, newItem);

    commitPlans({
      ...plans,
      [selectedRoom]: { plan: newPlan },
    }, Math.min(currentStep + 1, newPlan.length));
    setTilePicker(null);
  }

  const plan = selectedRoom ? plans[selectedRoom]?.plan ?? [] : [];

  return (
    <section className="canvas-section" onClick={() => setTilePicker(null)}>
      <div className="map-stack">
        <div className="map-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={GRID_SIZE * CELL_SIZE}
            height={GRID_SIZE * CELL_SIZE}
            onClick={handleCanvasClick}
            className={`room-canvas ${editorMode === "erase" ? "erase-mode" : ""}`}
          />
          {tilePicker && (
            <TilePicker
              x={tilePicker.x}
              y={tilePicker.y}
              left={tilePicker.left}
              top={tilePicker.top}
              itemIndexes={tilePicker.itemIndexes}
              plan={plan}
              editorMode={editorMode}
              onSelect={(itemIndex) => {
                setSelectedItemIndex(itemIndex);
                setTilePicker(null);
              }}
              onDelete={(itemIndex) => {
                deletePlanItem(itemIndex);
                setTilePicker(null);
              }}
            />
          )}
        </div>
        <StepControls
          currentStep={currentStep}
          totalSteps={plan.length}
          onStepChange={setCurrentStep}
        />
      </div>
    </section>
  );
}
