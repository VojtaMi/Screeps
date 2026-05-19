import { STRUCTURE_TYPES, STRUCTURE_TYPE_LABELS } from "../types";

interface StructureSelectorProps {
  selectedStructureType: string;
  onTypeChange: (type: string) => void;
}

export function StructureSelector({
  selectedStructureType,
  onTypeChange,
}: StructureSelectorProps) {
  return (
    <div className="build-plan-panel panel">
      <h2>Structure</h2>
      <select
        value={selectedStructureType}
        onChange={(event) => onTypeChange(event.target.value)}
      >
        {STRUCTURE_TYPES.map((type) => (
          <option key={type} value={type}>
            {STRUCTURE_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      <p className="hint">
        Click on canvas to add {STRUCTURE_TYPE_LABELS[selectedStructureType]}
      </p>
    </div>
  );
}
