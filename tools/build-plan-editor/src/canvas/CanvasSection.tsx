import { useRef, useEffect } from "react";
import { BuildPlanItem, BuildPlansData } from "../types";
import { CELL_SIZE, GRID_SIZE } from "../constants";
import {
  drawTerrain,
  drawGrid,
  drawPlan,
} from "./drawing";
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
  isEraseMode: boolean;
  selectedStructureType: string;
  showCoordinates: boolean;
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
  isEraseMode,
  selectedStructureType,
  showCoordinates,
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

    if (visibleIndexes.length === 1) {
      if (isEraseMode) {
        deletePlanItem(visibleIndexes[0]);
      } else {
        setSelectedItemIndex(visibleIndexes[0]);
      }
      setTilePicker(null);
      return;
    }

    if (visibleIndexes.length > 1) {
      setTilePicker({
        x,
        y,
        left: x * CELL_SIZE + CELL_SIZE,
        top: y * CELL_SIZE,
        itemIndexes: visibleIndexes,
      });
      return;
    }

    if (isEraseMode) {
      setTilePicker(null);
      return;
    }

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
            className={`room-canvas ${isEraseMode ? "erase-mode" : ""}`}
          />
          {tilePicker && (
            <TilePicker
              x={tilePicker.x}
              y={tilePicker.y}
              left={tilePicker.left}
              top={tilePicker.top}
              itemIndexes={tilePicker.itemIndexes}
              plan={plan}
              isEraseMode={isEraseMode}
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
