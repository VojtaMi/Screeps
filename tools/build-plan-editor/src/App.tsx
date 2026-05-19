import { useEffect, useState } from "react";
import { STRUCTURE_TYPES } from "./types";
import "./App.css";
import { usePlan } from "./plan/usePlan";
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
    tilePicker,
    setTilePicker,
    commitPlans,
    undoPlans,
    redoPlans,
    deletePlanItem,
  } = usePlan();

  const { terrain, terrainShard } = useTerrain(selectedRoom);

  const [selectedStructureType, setSelectedStructureType] = useState<string>(
    STRUCTURE_TYPES[0]
  );
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [isEraseMode, setIsEraseMode] = useState(false);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    []
  );

  useEffect(() => {
    if (selectedRoom) {
      setValidationErrors(validatePlans(plans, selectedRoom, terrain));
    }
  }, [plans, selectedRoom, terrain]);

  useKeyboardShortcuts(undoPlans, redoPlans, () => setTilePicker(null));

  const plan = selectedRoom ? plans[selectedRoom]?.plan ?? [] : [];

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
        showCoordinates={showCoordinates}
        setShowCoordinates={setShowCoordinates}
        isEraseMode={isEraseMode}
        setIsEraseMode={setIsEraseMode}
        onUndo={undoPlans}
        onRedo={redoPlans}
        pastPlans={pastPlans}
        futurePlans={futurePlans}
        onRoomChange={(nextRoom) => {
          selectRoom(nextRoom);
        }}
        onClearTilePicker={() => setTilePicker(null)}
      />

      <div className="build-plan-layout editor-layout">
        <CanvasSection
          plans={plans}
          selectedRoom={selectedRoom}
          currentStep={currentStep}
          setCurrentStep={setCurrentStep}
          selectedItemIndex={selectedItemIndex}
          setSelectedItemIndex={setSelectedItemIndex}
          tilePicker={tilePicker}
          setTilePicker={setTilePicker}
          isEraseMode={isEraseMode}
          selectedStructureType={selectedStructureType}
          showCoordinates={showCoordinates}
          terrain={terrain}
          validationErrors={validationErrors}
          commitPlans={commitPlans}
          deletePlanItem={deletePlanItem}
        />
        <Sidebar
          plan={plan}
          selectedRoom={selectedRoom}
          selectedStructureType={selectedStructureType}
          setSelectedStructureType={setSelectedStructureType}
          selectedItemIndex={selectedItemIndex}
          validationErrors={validationErrors}
          terrain={terrain}
          plans={plans}
          deletePlanItem={deletePlanItem}
        />
      </div>
    </div>
  );
}
