import { BuildPlanItem, STRUCTURE_COLORS, STRUCTURE_TYPE_LABELS } from "../types";
import { LEGEND_ORDER } from "../constants";

interface LegendProps {
  plan: BuildPlanItem[];
  currentStep: number;
}

export function Legend({ plan, currentStep }: LegendProps) {
  const legendEntries = LEGEND_ORDER.map((structureType) => ({
    structureType,
    count: plan.filter(
      (item, index) => index < currentStep && item.structureType === structureType
    ).length,
  })).filter((entry) => entry.count > 0);

  return (
    <div className="build-plan-panel panel">
      <h2>Legend</h2>
      <div className="build-plan-legend-list legend-list">
        {legendEntries.map(({ structureType, count }) => (
          <div className="build-plan-legend-row legend-row" key={structureType}>
            <span
              className={`build-plan-legend-symbol build-plan-legend-symbol-${structureType
                .replace("STRUCTURE_", "")
                .toLowerCase()} legend-symbol legend-symbol-${structureType
                .replace("STRUCTURE_", "")
                .toLowerCase()}`}
              style={{
                backgroundColor:
                  STRUCTURE_COLORS[structureType] ?? "#ffffff",
              }}
            />
            <span>{STRUCTURE_TYPE_LABELS[structureType]}</span>
            <strong>{count}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
