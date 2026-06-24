import { BuildPlanItem, BuildPlansData, EditorMode } from "../types";
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
  currentStep: number;
  currentRcl: number;
  selectedRoom: string;
  selectedStructureType: string;
  setSelectedStructureType: (type: string) => void;
  editorMode: EditorMode;
  setEditorMode: (mode: EditorMode) => void;
  selectedItemIndex: number | null;
  validationErrors: ValidationError[];
  terrain: string;
  plans: BuildPlansData;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  deletePlanItem: (index: number) => void;
}

export function Sidebar({
  plan,
  currentStep,
  currentRcl,
  selectedRoom,
  selectedStructureType,
  setSelectedStructureType,
  editorMode,
  setEditorMode,
  selectedItemIndex,
  validationErrors,
  terrain,
  plans,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  deletePlanItem,
}: SidebarProps) {
  return (
    <aside className="build-plan-stack sidebar">
      <div className="build-plan-panel panel">
        <h2>Mode</h2>
        <div className="mode-button-group">
          {(["select", "build", "erase"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`mode-button ${editorMode === mode ? "active" : ""}`}
              onClick={() => setEditorMode(mode)}
              aria-pressed={editorMode === mode}
            >
              <ModeIcon mode={mode} />
              <span>{mode}</span>
            </button>
          ))}
        </div>
        <div className="history-actions">
          <button
            type="button"
            className="icon-button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo"
            aria-label="Undo"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m 5 2 c -0.265625 0 -0.519531 0.105469 -0.707031 0.292969 l -4 4 c -0.3906252 0.390625 -0.3906252 1.023437 0 1.414062 l 4 4 c 0.390625 0.390625 1.023437 0.390625 1.414062 0 s 0.390625 -1.023437 0 -1.414062 l -2.292969 -2.292969 h 8.585938 c 1.117188 0 2 0.882812 2 2 s -0.882812 2 -2 2 c -0.550781 0 -1 0.449219 -1 1 s 0.449219 1 1 1 c 2.199219 0 4 -1.800781 4 -4 s -1.800781 -4 -4 -4 h -8.585938 l 2.292969 -2.292969 c 0.390625 -0.390625 0.390625 -1.023437 0 -1.414062 c -0.1875 -0.1875 -0.441406 -0.292969 -0.707031 -0.292969 z m 0 0" />
            </svg>
          </button>
          <button
            type="button"
            className="icon-button mirror"
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo"
            aria-label="Redo"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="m 5 2 c -0.265625 0 -0.519531 0.105469 -0.707031 0.292969 l -4 4 c -0.3906252 0.390625 -0.3906252 1.023437 0 1.414062 l 4 4 c 0.390625 0.390625 1.023437 0.390625 1.414062 0 s 0.390625 -1.023437 0 -1.414062 l -2.292969 -2.292969 h 8.585938 c 1.117188 0 2 0.882812 2 2 s -0.882812 2 -2 2 c -0.550781 0 -1 0.449219 -1 1 s 0.449219 1 1 1 c 2.199219 0 4 -1.800781 4 -4 s -1.800781 -4 -4 -4 h -8.585938 l 2.292969 -2.292969 c 0.390625 -0.390625 0.390625 -1.023437 0 -1.414062 c -0.1875 -0.1875 -0.441406 -0.292969 -0.707031 -0.292969 z m 0 0" />
            </svg>
          </button>
        </div>
      </div>

      {editorMode === "build" && (
        <StructureSelector
          plan={plan}
          currentStep={currentStep}
          currentRcl={currentRcl}
          selectedStructureType={selectedStructureType}
          onTypeChange={setSelectedStructureType}
        />
      )}

      <Legend plan={plan} currentStep={currentStep} />

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

function ModeIcon({ mode }: { mode: EditorMode }) {
  if (mode === "select") {
    return (
      <svg
        className="mode-icon mode-icon-select"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.0001 5.49939C8.40993 5.49939 5.49951 8.40981 5.49951 12C5.49951 15.5902 8.40993 18.5006 12.0001 18.5006C15.5903 18.5006 18.5007 15.5902 18.5007 12C18.5007 8.40981 15.5903 5.49939 12.0001 5.49939ZM3.99951 12C3.99951 7.58139 7.58151 3.99939 12.0001 3.99939C16.4187 3.99939 20.0007 7.58139 20.0007 12C20.0007 16.4186 16.4187 20.0006 12.0001 20.0006C7.58151 20.0006 3.99951 16.4186 3.99951 12Z"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M12.0002 9.5C10.6194 9.5 9.50016 10.6193 9.50016 12C9.50016 13.3807 10.6194 14.5 12.0002 14.5C13.3809 14.5 14.5002 13.3807 14.5002 12C14.5002 10.6193 13.3809 9.5 12.0002 9.5ZM8.00016 12C8.00016 9.79086 9.79102 8 12.0002 8C14.2093 8 16.0002 9.79086 16.0002 12C16.0002 14.2091 14.2093 16 12.0002 16C9.79102 16 8.00016 14.2091 8.00016 12Z"
        />
      </svg>
    );
  }

  if (mode === "build") {
    return (
      <svg
        className="mode-icon mode-icon-build"
        viewBox="0 0 512 512"
        aria-hidden="true"
      >
        <g>
          <g>
            <polygon
              fill="#D1D0D0"
              points="273.221,120.258 106.811,286.672 147.874,327.736 314.281,161.325"
            />
            <polygon
              fill="#5881B3"
              points="29.964,434.577 0,404.624 0,374.431 144.829,229.602 204.944,289.714 60.088,434.57"
            />
          </g>
          <polygon
            fill="#ADACAD"
            points="270.399,123.081 213.768,179.704 295.896,179.704 310.958,164.649"
          />
          <g>
            <path
              fill="#5B5555"
              d="M266.248,63.565l1.226,1.524C266.983,64.479,266.567,63.943,266.248,63.565z M268.311,66.089c-0.072-0.065-0.134-0.155-0.219-0.244l0.299,0.392c-0.007-0.035-0.038-0.069-0.052-0.124C268.339,66.113,268.325,66.103,268.311,66.089z M195.516,11.69c25.847,10.341,53.407,34.451,70.11,51.144l0.1,0.1c0,0,0.01,0.02,0.044,0.044c0.951,0.979,1.803,2.012,2.541,3.111c0.014,0.014,0.027,0.024,0.027,0.024c0.347,0.467,0.718,0.934,1.092,1.401l-1.04-1.277c7.406,11.241,3.879,29.012-11.67,44.555l-6.204,20.508l53.97,53.963l21.157-5.548l19.529-19.526c9.751-9.751,26.664-12.377,42.169,3.125c8.659,8.662,4.264,21.208,6.009,31.316c0.563,3.289,1.764,6.317,4.326,8.872l37.926,37.919c5.383,5.397,14.132,5.383,19.515-0.007l52.834-52.827c5.383-5.39,5.398-14.142,0.014-19.523l-37.926-37.932c-2.561-2.548-5.582-3.76-8.879-4.313c-10.101-1.747-22.654,2.644-31.313-6.005c-10.163-10.166-0.069-23.364-8.295-37.009c-1.085-1.823-2.493-3.646-4.313-5.459c0,0-43.687-43.694-73.544-73.551c-37.908-37.908-103.373-35.618-143.857-19.828C184.038-11.283,179.056,5.084,195.516,11.69z"
            />
            <path
              fill="#6A6B6B"
              d="M461.159,126.819l-67.81,67.81c0.563,3.289,1.764,6.317,4.326,8.872l37.926,37.919c5.383,5.397,14.132,5.383,19.515-0.007l52.834-52.827c5.383-5.39,5.398-14.142,0.014-19.523l-37.926-37.932C467.477,128.584,464.456,127.372,461.159,126.819z"
            />
            <path
              fill="#6A6B6B"
              d="M195.516,11.69c25.847,10.341,53.407,34.451,70.11,51.144l0.1,0.1c0,0,0.01,0.02,0.044,0.044c0.055,0.089,0.189,0.244,0.374,0.467l0.103,0.12l1.226,1.524l0.618,0.755l0.299,0.392c7.406,11.241,3.879,29.012-11.67,44.555l-6.204,20.508l53.97,53.963l21.157-5.548l95.909-95.91c-1.085-1.823-2.493-3.646-4.313-5.459c0,0-43.687-43.694-73.544-73.551c-37.908-37.908-103.373-35.618-143.857-19.828C184.038-11.283,179.056,5.084,195.516,11.69z"
            />
            <path
              fill="#8C8C8C"
              d="M507.957,188.587l-52.82,52.834c-5.398,5.397-14.153,5.397-19.543,0l72.363-72.37C513.348,174.445,513.348,183.196,507.957,188.587z"
            />
          </g>
        </g>
      </svg>
    );
  }

  return (
    <svg
      className="mode-icon mode-icon-erase"
      viewBox="0 -1.01 20.244 20.244"
      aria-hidden="true"
    >
      <g transform="translate(-1.926 -2.881)">
        <path d="M3.29,10,9,4.29a1,1,0,0,1,1.41,0l5.4,5.4L8.69,16.76l-5.4-5.4A1,1,0,0,1,3.29,10Z" />
        <path d="M3.29,10,9,4.29a1,1,0,0,1,1.41,0l10.3,10.35a1,1,0,0,1,0,1.41l-3.66,3.66a1,1,0,0,1-.71.29H11.93L3.29,11.36A1,1,0,0,1,3.29,10Zm12.47-.26,5,5a1,1,0,0,1,0,1.41L17.1,19.81a1,1,0,0,1-.71.29H11.93L8.69,16.76ZM6,20h6" />
      </g>
    </svg>
  );
}
