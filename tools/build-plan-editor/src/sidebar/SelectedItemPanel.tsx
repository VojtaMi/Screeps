import { BuildPlanItem, STRUCTURE_TYPE_LABELS } from "../types";

interface SelectedItemPanelProps {
  selectedItem: BuildPlanItem;
  onRemove: () => void;
}

export function SelectedItemPanel({
  selectedItem,
  onRemove,
}: SelectedItemPanelProps) {
  return (
    <div className="build-plan-panel panel">
      <h2>Selected Item</h2>
      <div className="item-details">
        <p>
          <strong>Position:</strong> ({selectedItem.x}, {selectedItem.y})
        </p>
        <p>
          <strong>Type:</strong>{" "}
          {STRUCTURE_TYPE_LABELS[selectedItem.structureType]}
        </p>
        {selectedItem.purpose && (
          <p>
            <strong>Purpose:</strong> {selectedItem.purpose}
          </p>
        )}
      </div>
      <button onClick={onRemove} className="danger-btn">
        Remove
      </button>
    </div>
  );
}
