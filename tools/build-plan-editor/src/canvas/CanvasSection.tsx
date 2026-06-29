import { useRef, useEffect } from "react";
import {
  BUILD_SELECTION_CONTROLLER_CONTAINER,
  BuildPlanItem,
  BuildPlansData,
  EditorMode,
  RoomLandmark,
} from "../types";
import { CELL_SIZE, GRID_SIZE } from "../constants";
import { rclForStep } from "../rcl";
import { validateSameTile } from "../plan/validation";
import { drawTerrain, drawGrid, drawLandmarks, drawPlan } from "./drawing";
import { StepControls } from "./StepControls";

interface ValidationError {
  step: number;
  message: string;
}

interface SelectedTile {
  x: number;
  y: number;
}

interface CanvasSectionProps {
  plans: BuildPlansData;
  selectedRoom: string;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  selectedItemIndex: number | null;
  setSelectedItemIndex: (index: number | null) => void;
  selectedTile: SelectedTile | null;
  setSelectedTile: (tile: SelectedTile | null) => void;
  editorMode: EditorMode;
  selectedStructureType: string;
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
  selectedTile,
  setSelectedTile,
  editorMode,
  selectedStructureType,
  showLandmarks,
  landmarks,
  terrain,
  validationErrors,
  commitPlans,
  deletePlanItem,
}: CanvasSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    redraw();
  }, [
    selectedRoom,
    currentStep,
    selectedItemIndex,
    selectedTile,
    terrain,
    plans,
    validationErrors,
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
    drawGrid(ctx);
    if (showLandmarks) {
      drawLandmarks(ctx, landmarks);
    }

    const plan = plans[selectedRoom]?.plan ?? [];
    drawPlan(
      ctx,
      plan,
      currentStep,
      selectedItemIndex,
      selectedTile,
      validationErrors
    );
  }

  function handleCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!canvasRef.current || !selectedRoom) return;
    e.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    const plan = plans[selectedRoom].plan;
    const tileIndexes = plan
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.x === x && item.y === y)
      .map(({ index }) => index);
    const visibleIndexes = plan
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item, index }) =>
          index < currentStep && item.x === x && item.y === y
      )
      .map(({ index }) => index);
    const selectedIndex =
      visibleIndexes.length > 0
        ? visibleIndexes[visibleIndexes.length - 1]
        : null;

    if (editorMode === "build") {
      if (canPlaceStructure(plan, x, y)) {
        addPlanItem(plan, x, y);
      } else {
        setSelectedTile({ x, y });
        setSelectedItemIndex(selectedIndex);
      }
      return;
    }

    if (editorMode === "erase") {
      if (tileIndexes.length === 1) {
        deletePlanItem(tileIndexes[0]);
        return;
      }

      setSelectedTile({ x, y });
      setSelectedItemIndex(selectedIndex);
      return;
    }

    setSelectedTile({ x, y });
    setSelectedItemIndex(selectedIndex);

    return;
  }

  function canPlaceStructure(plan: BuildPlanItem[], x: number, y: number) {
    const existingTypes = plan
      .filter((item) => item.x === x && item.y === y)
      .map((item) => item.structureType);

    if (existingTypes.length === 0) return true;

    const selectedItem = getSelectedBuildPlanItem(x, y);

    if (existingTypes.includes(selectedItem.structureType)) return false;

    return validateSameTile([...existingTypes, selectedItem.structureType]);
  }

  function addPlanItem(plan: BuildPlanItem[], x: number, y: number) {
    const newItem = getSelectedBuildPlanItem(x, y);

    const newPlan = [...plan];
    newPlan.splice(currentStep, 0, newItem);

    commitPlans({
      ...plans,
      [selectedRoom]: { plan: newPlan },
    }, Math.min(currentStep + 1, newPlan.length));
  }

  function getSelectedBuildPlanItem(x: number, y: number): BuildPlanItem {
    if (selectedStructureType === BUILD_SELECTION_CONTROLLER_CONTAINER) {
      return {
        x,
        y,
        structureType: "STRUCTURE_CONTAINER",
        purpose: "controllerDelivery",
      };
    }

    return {
      x,
      y,
      structureType: selectedStructureType,
    };
  }

  const plan = selectedRoom ? plans[selectedRoom]?.plan ?? [] : [];

  return (
    <section className="canvas-section">
      <div className="map-stack">
        <div className="map-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={GRID_SIZE * CELL_SIZE}
            height={GRID_SIZE * CELL_SIZE}
            onClick={handleCanvasClick}
            className={`room-canvas ${editorMode === "erase" ? "erase-mode" : ""}`}
          />
        </div>
        <StepControls
          currentStep={currentStep}
          totalSteps={plan.length}
          currentRcl={rclForStep(plan, currentStep)}
          onStepChange={setCurrentStep}
        />
      </div>
    </section>
  );
}
