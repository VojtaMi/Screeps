import {
  STRUCTURE_COLORS,
  STRUCTURE_TYPE_LABELS,
} from "../types";
import type { TileInspection } from "../plan/validationCore.mjs";

interface SelectedItemPanelProps {
  tile: TileInspection;
  selectedItemIndex: number | null;
  onSelectItem: (index: number) => void;
  onRemove: (index: number) => void;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function SelectedItemPanel({
  tile,
  selectedItemIndex,
  onSelectItem,
  onRemove,
}: SelectedItemPanelProps) {
  const selectedItem =
    selectedItemIndex !== null
      ? tile.planned.find((item) => item.step === selectedItemIndex)
      : null;

  return (
    <div className="build-plan-panel panel">
      <h2>Selected Tile</h2>
      <div className="item-details">
        <p>
          <strong>{titleCase(tile.terrain)}</strong> ({tile.x}, {tile.y})
        </p>
        {tile.isEdge && (
          <p>
            <strong>Edge:</strong> Yes
          </p>
        )}
      </div>

      {tile.planned.length > 0 && (
        <div className="tile-layer-list" aria-label="Planned structures on tile">
          {tile.planned.map((item) => {
            const isSelected = item.step === selectedItemIndex;

            return (
              <button
                key={item.step}
                type="button"
                className={`tile-layer-button ${isSelected ? "active" : ""}`}
                onClick={() => onSelectItem(item.step)}
              >
                <span
                  className="tile-picker-swatch"
                  style={{
                    backgroundColor:
                      STRUCTURE_COLORS[item.structureType] ?? "#ffffff",
                  }}
                />
                <span>
                  Step {item.step}:{" "}
                  {STRUCTURE_TYPE_LABELS[item.structureType] ??
                    item.structureType}
                  {item.purpose ? ` (${item.purpose})` : ""}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tile.validation.length > 0 && (
        <div className="tile-validation-list">
          {tile.validation.map((error) => (
            <p key={`${error.step}-${error.message}`}>{error.message}</p>
          ))}
        </div>
      )}

      {selectedItem && (
        <button
          type="button"
          onClick={() => onRemove(selectedItem.step)}
          className="danger-btn"
        >
          Remove Selected
        </button>
      )}
    </div>
  );
}
