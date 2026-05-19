import { BuildPlanItem, STRUCTURE_COLORS, STRUCTURE_TYPE_LABELS } from "../types";

interface TilePickerProps {
  x: number;
  y: number;
  left: number;
  top: number;
  itemIndexes: number[];
  plan: BuildPlanItem[];
  isEraseMode: boolean;
  onSelect: (itemIndex: number) => void;
  onDelete: (itemIndex: number) => void;
}

export function TilePicker({
  x,
  y,
  left,
  top,
  itemIndexes,
  plan,
  isEraseMode,
  onSelect,
  onDelete,
}: TilePickerProps) {
  return (
    <div className="tile-picker" style={{ left, top }}>
      <div className="tile-picker-title">
        {isEraseMode ? "Erase" : "Select"} ({x}, {y})
      </div>
      {itemIndexes.map((itemIndex) => {
        const item = plan[itemIndex];

        return (
          <button
            key={itemIndex}
            type="button"
            className="tile-picker-option"
            onClick={() => {
              if (isEraseMode) {
                onDelete(itemIndex);
              } else {
                onSelect(itemIndex);
              }
            }}
          >
            <span
              className="tile-picker-swatch"
              style={{
                backgroundColor: STRUCTURE_COLORS[item.structureType] ?? "#ffffff",
              }}
            />
            <span>
              Step {itemIndex}:{" "}
              {STRUCTURE_TYPE_LABELS[item.structureType] ?? item.structureType}
              {item.purpose ? ` (${item.purpose})` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
