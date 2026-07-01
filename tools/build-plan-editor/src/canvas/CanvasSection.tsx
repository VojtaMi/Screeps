import { useEffect, useRef, useState } from "react";
import {
  BUILD_SELECTION_CONTROLLER_CONTAINER,
  BuildPlanItem,
  BuildPlansData,
  EditorMode,
  RoomLandmark,
  STRUCTURE_TYPE_LABELS,
} from "../types";
import { CELL_SIZE, GRID_SIZE } from "../constants";
import { rclForStep } from "../rcl";
import { validateSameTile } from "../plan/validation";
import {
  canPlaceNearEdge,
  isTileAfterEdge,
  wouldBlockExit,
} from "../plan/validationCore";
import { drawTerrain, drawGrid, drawLandmarks, drawPlan } from "./drawing";
import { StepControls } from "./StepControls";

const PLACEMENT_ERROR_DURATION_MS = 2500;

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
  // Explicit step navigation from the step controls. Unlike setCurrentStep
  // (also used for placement-driven advances), this syncs the toolbar RCL to
  // the step being viewed.
  onStepNavigate: (step: number) => void;
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
  onStepNavigate,
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
  const [placementError, setPlacementError] = useState<string | null>(null);
  const placementErrorTimeoutRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => window.clearTimeout(placementErrorTimeoutRef.current);
  }, []);

  function showPlacementError(message: string) {
    window.clearTimeout(placementErrorTimeoutRef.current);
    setPlacementError(message);
    placementErrorTimeoutRef.current = window.setTimeout(() => {
      setPlacementError(null);
    }, PLACEMENT_ERROR_DURATION_MS);
  }

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
      const blockReason = getPlacementBlockReason(plan, x, y);
      if (!blockReason) {
        addPlanItem(plan, x, y);
      } else {
        showPlacementError(blockReason);
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

  // Returns a human-readable reason placement is blocked, or null if it's allowed.
  function getPlacementBlockReason(
    plan: BuildPlanItem[],
    x: number,
    y: number
  ): string | null {
    const selectedItem = getSelectedBuildPlanItem(x, y);
    const structureLabel =
      STRUCTURE_TYPE_LABELS[selectedItem.structureType] ??
      selectedItem.structureType;

    if (
      !canPlaceNearEdge(selectedItem.structureType) &&
      isTileAfterEdge(x, y) &&
      wouldBlockExit(terrain, x, y)
    ) {
      return `Cannot place ${structureLabel} here — it would block an exit`;
    }

    const destroyedTypes = new Set(
      plan
        .filter((item) => item.x === x && item.y === y && item.action === "destroy")
        .map((item) => item.structureType),
    );

    const existingTypes = plan
      .filter(
        (item) =>
          item.x === x &&
          item.y === y &&
          !item.action &&
          !destroyedTypes.has(item.structureType),
      )
      .map((item) => item.structureType);

    if (existingTypes.length === 0) return null;

    if (existingTypes.includes(selectedItem.structureType)) {
      return `A ${structureLabel} is already planned on this tile`;
    }

    if (!validateSameTile([...existingTypes, selectedItem.structureType])) {
      return `${structureLabel} cannot share a tile with the existing structure(s) here`;
    }

    return null;
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
          {placementError && (
            <div className="placement-error-toast" role="alert">
              {placementError}
            </div>
          )}
        </div>
        <StepControls
          currentStep={currentStep}
          totalSteps={plan.length}
          currentRcl={rclForStep(plan, currentStep)}
          onStepChange={onStepNavigate}
        />
      </div>
    </section>
  );
}
