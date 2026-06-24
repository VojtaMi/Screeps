import { useEffect } from "react";
import {
  BuildPlanItem,
  STRUCTURE_TYPES,
  STRUCTURE_TYPE_LABELS,
} from "../types";
import { remainingForRcl } from "../rcl";

interface StructureSelectorProps {
  plan: BuildPlanItem[];
  currentStep: number;
  currentRcl: number;
  selectedStructureType: string;
  onTypeChange: (type: string) => void;
}

export function StructureSelector({
  plan,
  currentStep,
  currentRcl,
  selectedStructureType,
  onTypeChange,
}: StructureSelectorProps) {
  const available = STRUCTURE_TYPES.map((type) => ({
    type,
    remaining: remainingForRcl(plan, currentStep, type, currentRcl),
  })).filter((entry) => entry.remaining > 0);

  const isSelectedAvailable = available.some(
    (entry) => entry.type === selectedStructureType,
  );

  // When the RCL view changes and the current selection is no longer placeable,
  // fall back to the first available type.
  useEffect(() => {
    if (!isSelectedAvailable && available.length > 0) {
      onTypeChange(available[0].type);
    }
  }, [isSelectedAvailable, available, onTypeChange]);

  if (available.length === 0) {
    return (
      <div className="build-plan-panel panel">
        <h2>Structure</h2>
        <p className="hint">No structures available at RCL {currentRcl}.</p>
      </div>
    );
  }

  const effectiveType = isSelectedAvailable
    ? selectedStructureType
    : available[0].type;

  return (
    <div className="build-plan-panel panel">
      <h2>Structure</h2>
      <select
        value={effectiveType}
        onChange={(event) => onTypeChange(event.target.value)}
      >
        {available.map(({ type, remaining }) => (
          <option key={type} value={type}>
            {STRUCTURE_TYPE_LABELS[type]} ({remaining} left)
          </option>
        ))}
      </select>
      <p className="hint">
        Click on canvas to add {STRUCTURE_TYPE_LABELS[effectiveType]} at RCL{" "}
        {currentRcl}
      </p>
    </div>
  );
}
