import { BuildPlanItem, BuildPlansData } from "../types";
import { StructureSelector } from "./StructureSelector";
import { Legend } from "./Legend";
import { SelectedItemPanel } from "./SelectedItemPanel";
import { ValidationErrors } from "./ValidationErrors";
import { TerrainWarning } from "./TerrainWarning";
import { ActionsPanel } from "./ActionsPanel";

interface ValidationError {
  step: number;
  message: string;
}

interface SidebarProps {
  plan: BuildPlanItem[];
  selectedRoom: string;
  selectedStructureType: string;
  setSelectedStructureType: (type: string) => void;
  selectedItemIndex: number | null;
  validationErrors: ValidationError[];
  terrain: string;
  plans: BuildPlansData;
  deletePlanItem: (index: number) => void;
}

export function Sidebar({
  plan,
  selectedRoom,
  selectedStructureType,
  setSelectedStructureType,
  selectedItemIndex,
  validationErrors,
  terrain,
  plans,
  deletePlanItem,
}: SidebarProps) {
  return (
    <aside className="build-plan-stack sidebar">
      <StructureSelector
        selectedStructureType={selectedStructureType}
        onTypeChange={setSelectedStructureType}
      />

      <Legend plan={plan} />

      {selectedItemIndex !== null && (
        <SelectedItemPanel
          selectedItem={plan[selectedItemIndex]}
          onRemove={() => deletePlanItem(selectedItemIndex)}
        />
      )}

      <ValidationErrors errors={validationErrors} />

      <TerrainWarning selectedRoom={selectedRoom} hasTerrain={!!terrain} />

      <ActionsPanel
        plans={plans}
        hasValidationErrors={validationErrors.length > 0}
      />
    </aside>
  );
}
