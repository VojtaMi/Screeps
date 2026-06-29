import { useEffect, useState } from "react";
import { EditorMode, STRUCTURE_TYPES } from "./types";
import { endStepForRcl, planMaxRcl } from "./rcl";
import { inspectTile, type TileInspection } from "./plan/validationCore.mjs";
import "./App.css";
import { usePlan } from "./plan/usePlan";
import { useLandmarks } from "./terrain/useLandmarks";
import { useTerrain } from "./terrain/useTerrain";
import { validatePlans } from "./plan/validation";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts";
import { Toolbar } from "./toolbar/Toolbar";
import { CanvasSection } from "./canvas/CanvasSection";
import { Sidebar } from "./sidebar/Sidebar";

interface ValidationError {
  step: number;
  message: string;
}

export default function App() {
  const {
    plans,
    selectedRoom,
    selectRoom,
    currentStep,
    setCurrentStep,
    pastPlans,
    futurePlans,
    selectedItemIndex,
    setSelectedItemIndex,
    selectedTile,
    setSelectedTile,
    commitPlans,
    undoPlans,
    redoPlans,
    deletePlanItem,
  } = usePlan();

  const { terrain, terrainShard } = useTerrain(selectedRoom);
  const { landmarks } = useLandmarks(selectedRoom);

  const [selectedStructureType, setSelectedStructureType] = useState<string>(
    STRUCTURE_TYPES[0]
  );
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [editorMode, setEditorMode] = useState<EditorMode>("select");
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    []
  );
  // Target RCL the user is authoring at. Explicit (not derived from the plan) so
  // it can be raised above the plan's current max to unlock the next tier's
  // structures before any of them exist.
  const [selectedRcl, setSelectedRcl] = useState(0);

  useEffect(() => {
    if (selectedRoom) {
      setValidationErrors(validatePlans(plans, selectedRoom, terrain));
    }
  }, [plans, selectedRoom, terrain]);

  // When switching rooms, default the target RCL to that room's highest level.
  useEffect(() => {
    setSelectedRcl(planMaxRcl(plans[selectedRoom]?.plan ?? []));
  }, [selectedRoom]);

  useKeyboardShortcuts(undoPlans, redoPlans, () => {
    setSelectedItemIndex(null);
    setSelectedTile(null);
  });

  const plan = selectedRoom ? plans[selectedRoom]?.plan ?? [] : [];
  const selectedTileInspection: TileInspection | null =
    selectedRoom && selectedTile
      ? inspectTile({
          roomName: selectedRoom,
          x: selectedTile.x,
          y: selectedTile.y,
          plan,
          terrain,
          currentStep,
        })
      : null;

  function changeRcl(rcl: number) {
    setSelectedRcl(rcl);
    setCurrentStep(endStepForRcl(plan, rcl));
  }

  return (
    <div className="editor">
      <header className="build-plan-header editor-header">
        <div>
          <h1>Screeps Build Plan Builder</h1>
        </div>
        <div className="build-plan-summary editor-summary">
          {selectedRoom
            ? `${selectedRoom} · ${plan.length} planned structures${
                terrainShard ? ` · terrain ${terrainShard}` : ""
              }`
            : ""}
        </div>
      </header>

      <Toolbar
        selectedRoom={selectedRoom}
        plans={plans}
        currentRcl={selectedRcl}
        onRclChange={changeRcl}
        showLandmarks={showLandmarks}
        setShowLandmarks={setShowLandmarks}
        onRoomChange={(nextRoom) => {
          selectRoom(nextRoom);
        }}
      />

      <div className="build-plan-layout editor-layout">
        <CanvasSection
          plans={plans}
          selectedRoom={selectedRoom}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          selectedItemIndex={selectedItemIndex}
          setSelectedItemIndex={setSelectedItemIndex}
          selectedTile={selectedTile}
          setSelectedTile={setSelectedTile}
          editorMode={editorMode}
          selectedStructureType={selectedStructureType}
          showLandmarks={showLandmarks}
          landmarks={landmarks}
          terrain={terrain}
          validationErrors={validationErrors}
          commitPlans={commitPlans}
          deletePlanItem={deletePlanItem}
        />
        <Sidebar
          plan={plan}
          currentStep={currentStep}
          currentRcl={selectedRcl}
          selectedRoom={selectedRoom}
          selectedStructureType={selectedStructureType}
          setSelectedStructureType={setSelectedStructureType}
          editorMode={editorMode}
          setEditorMode={(mode) => {
            setEditorMode(mode);
          }}
          selectedItemIndex={selectedItemIndex}
          selectedTileInspection={selectedTileInspection}
          onSelectItem={setSelectedItemIndex}
          validationErrors={validationErrors}
          terrain={terrain}
          plans={plans}
          onUndo={undoPlans}
          onRedo={redoPlans}
          canUndo={pastPlans.length > 0}
          canRedo={futurePlans.length > 0}
          deletePlanItem={deletePlanItem}
        />
      </div>
    </div>
  );
}
