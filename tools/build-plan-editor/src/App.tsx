import React, { useEffect, useRef, useState } from "react";
import {
  BuildPlanItem,
  BuildPlansData,
  STRUCTURE_COLORS,
  STRUCTURE_TYPES,
  STRUCTURE_TYPE_LABELS,
} from "./types";
import "./App.css";

interface ValidationError {
  step: number;
  message: string;
}

interface ApiResponse {
  plans: BuildPlansData;
  availableTerrains: string[];
}

interface TerrainSnapshot {
  room: string;
  shard: string;
  terrain: string;
}

const CELL_SIZE = 15;
const GRID_SIZE = 50;

export default function App() {
  const [plans, setPlans] = useState<BuildPlansData>({});
  const [selectedRoom, setSelectedRoom] = useState<string>("");
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedStructureType, setSelectedStructureType] = useState<string>(
    STRUCTURE_TYPES[0]
  );
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(
    null
  );
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>(
    []
  );
  const [terrain, setTerrain] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingSave, setIsConfirmingSave] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      loadTerrain(selectedRoom);
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (selectedRoom) {
      validatePlans();
    }
  }, [plans, selectedRoom]);

  useEffect(() => {
    redraw();
  }, [
    selectedRoom,
    currentStep,
    selectedItemIndex,
    terrain,
    plans,
    validationErrors,
  ]);

  async function loadPlans() {
    try {
      const response = await fetch("/api/build-plans");
      const data: ApiResponse = await response.json();
      setPlans(data.plans);
      const roomNames = Object.keys(data.plans);
      if (roomNames.length > 0) {
        setSelectedRoom(roomNames[0]);
        setCurrentStep(0);
      }
    } catch (error) {
      console.error("Failed to load plans:", error);
    }
  }

  async function loadTerrain(roomName: string) {
    try {
      const response = await fetch(`/api/terrain/${roomName}`);
      if (response.ok) {
        const data: TerrainSnapshot = await response.json();
        setTerrain(data.terrain);
      } else {
        setTerrain("");
      }
    } catch (error) {
      console.error("Failed to load terrain:", error);
      setTerrain("");
    }
  }

  function validatePlans() {
    if (!selectedRoom) return;

    const errors: ValidationError[] = [];
    const plan = plans[selectedRoom]?.plan ?? [];

    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];

      // Validate coordinates
      if (!Number.isInteger(item.x) || item.x < 0 || item.x > 49) {
        errors.push({
          step: i,
          message: `Invalid x coordinate: ${item.x}`,
        });
        continue;
      }
      if (!Number.isInteger(item.y) || item.y < 0 || item.y > 49) {
        errors.push({
          step: i,
          message: `Invalid y coordinate: ${item.y}`,
        });
        continue;
      }

      // Check for duplicates at same position with same type
      const duplicates = plan.filter(
        (other, j) =>
          j !== i &&
          other.x === item.x &&
          other.y === item.y &&
          other.structureType === item.structureType
      );
      if (duplicates.length > 0) {
        errors.push({
          step: i,
          message: `Duplicate structure at (${item.x}, ${item.y})`,
        });
        continue;
      }

      // Check same-tile rules
      const samePos = plan.filter(
        (other, j) => j !== i && other.x === item.x && other.y === item.y
      );
      if (samePos.length > 0) {
        const types = [item.structureType, ...samePos.map((s) => s.structureType)];
        const isValid = validateSameTile(types);
        if (!isValid) {
          errors.push({
            step: i,
            message: `Invalid same-tile combination at (${item.x}, ${item.y})`,
          });
        }
      }

      // Check terrain rules
      if (terrain) {
        const terrainCode = Number(terrain[item.y * 50 + item.x] ?? 0);
        const isWall = terrainCode & 1;
        if (
          isWall &&
          item.structureType !== "STRUCTURE_ROAD"
        ) {
          errors.push({
            step: i,
            message: `Cannot place ${STRUCTURE_TYPE_LABELS[item.structureType] || item.structureType} on natural wall`,
          });
        }
      }
    }

    setValidationErrors(errors);
  }

  function validateSameTile(types: string[]): boolean {
    if (types.length === 1) {
      return true;
    }

    const sortedTypes = [...types].sort();
    const hasRampart = sortedTypes.includes("STRUCTURE_RAMPART");
    const withoutRampart = sortedTypes.filter(
      (type) => type !== "STRUCTURE_RAMPART"
    );

    if (hasRampart && withoutRampart.length === sortedTypes.length - 1) {
      return validateSameTile(withoutRampart);
    }

    return (
      sortedTypes.length === 2 &&
      sortedTypes[0] === "STRUCTURE_CONTAINER" &&
      sortedTypes[1] === "STRUCTURE_ROAD"
    );
  }

  function redraw() {
    if (!canvasRef.current || !selectedRoom) return;

    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;

    const width = GRID_SIZE * CELL_SIZE;
    const height = GRID_SIZE * CELL_SIZE;

    ctx.fillStyle = "#10131a";
    ctx.fillRect(0, 0, width, height);

    drawTerrain(ctx);
    drawGrid(ctx);
    drawPlan(ctx);
  }

  function drawTerrain(ctx: CanvasRenderingContext2D) {
    if (!terrain) return;

    const colors = {
      plain: "rgb(44, 44, 44)",
      swamp: "rgb(40, 51, 29)",
      wall: "rgb(19, 19, 19)",
    };

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const code = Number(terrain[y * GRID_SIZE + x] ?? 0);
        let color = colors.plain;
        if (code & 1) color = colors.wall;
        else if (code & 2) color = colors.swamp;

        ctx.fillStyle = color;
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  function drawGrid(ctx: CanvasRenderingContext2D) {
    ctx.strokeStyle = "#2c3444";
    ctx.lineWidth = 1;

    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = i * CELL_SIZE + 0.5;
      ctx.beginPath();
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, GRID_SIZE * CELL_SIZE);
      ctx.moveTo(0, pos);
      ctx.lineTo(GRID_SIZE * CELL_SIZE, pos);
      ctx.stroke();
    }
  }

  function drawPlan(ctx: CanvasRenderingContext2D) {
    if (!selectedRoom) return;

    const plan = plans[selectedRoom]?.plan ?? [];
    for (let i = 0; i < plan.length; i++) {
      const item = plan[i];
      const isSelected = i === selectedItemIndex;
      const hasError = validationErrors.some((e) => e.step === i);
      const isAfterStep = i >= currentStep;

      drawStructure(ctx, item, isSelected, hasError, isAfterStep);
    }
  }

  function drawStructure(
    ctx: CanvasRenderingContext2D,
    item: BuildPlanItem,
    isSelected: boolean,
    hasError: boolean,
    isAfterStep: boolean
  ) {
    const x = item.x * CELL_SIZE;
    const y = item.y * CELL_SIZE;
    const centerX = x + CELL_SIZE / 2;
    const centerY = y + CELL_SIZE / 2;

    let color = STRUCTURE_COLORS[item.structureType] || "#ffffff";
    if (isAfterStep) {
      color = adjustBrightness(color, 0.5);
    }

    ctx.fillStyle = color;
    ctx.strokeStyle = hasError ? "#ff0000" : isSelected ? "#00ff00" : "#0b0f14";
    ctx.lineWidth = hasError ? 3 : isSelected ? 2.5 : 2;

    if (item.structureType === "STRUCTURE_ROAD") {
      ctx.beginPath();
      ctx.arc(centerX, centerY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (item.structureType === "STRUCTURE_RAMPART") {
      ctx.fillRect(x + 2, y + 2, 11, 11);
      ctx.strokeRect(x + 2, y + 2, 11, 11);
    } else {
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (item.purpose) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(centerX - 2, centerY - 2, 4, 4);
      }
    }
  }

  function adjustBrightness(color: string, factor: number): string {
    const num = parseInt(color.replace("#", ""), 16);
    const r = Math.round((num >> 16) * factor);
    const g = Math.round(((num >> 8) & 0x00ff) * factor);
    const b = Math.round((num & 0x0000ff) * factor);
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
  }

  function handleCanvasClick(
    e: React.MouseEvent<HTMLCanvasElement>
  ) {
    if (!canvasRef.current || !selectedRoom) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    const plan = plans[selectedRoom].plan;
    const clickedIndex = plan.findIndex(
      (item) => item.x === x && item.y === y
    );

    if (clickedIndex >= 0 && clickedIndex < currentStep) {
      // Clicked on existing structure
      setSelectedItemIndex(clickedIndex);
    } else if (clickedIndex < 0 || clickedIndex >= currentStep) {
      // Add new structure
      const newItem: BuildPlanItem = {
        x,
        y,
        structureType: selectedStructureType,
      };

      const newPlan = [...plan];
      newPlan.splice(currentStep, 0, newItem);

      setPlans({
        ...plans,
        [selectedRoom]: { plan: newPlan },
      });

      setCurrentStep(Math.min(currentStep + 1, newPlan.length));
      setSelectedItemIndex(null);
    }
  }

  function removeSelectedItem() {
    if (selectedItemIndex === null || !selectedRoom) return;

    const plan = plans[selectedRoom].plan;
    const newPlan = plan.filter((_, i) => i !== selectedItemIndex);

    setPlans({
      ...plans,
      [selectedRoom]: { plan: newPlan },
    });

    setSelectedItemIndex(null);
  }

  async function savePlans() {
    const hasErrors = validationErrors.length > 0;
    if (hasErrors) {
      setSaveMessage("Cannot save: validation errors exist");
      return;
    }

    setIsConfirmingSave(true);
  }

  async function confirmSavePlans() {
    setIsSaving(true);
    setSaveMessage("Saving...");
    setIsConfirmingSave(false);

    try {
      const response = await fetch("/api/build-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans }),
      });

      if (response.ok) {
        setSaveMessage("Saved successfully!");
        setTimeout(() => setSaveMessage(""), 3000);
      } else {
        const error = await response.json();
        setSaveMessage(`Save failed: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      setSaveMessage(
        `Save failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsSaving(false);
    }
  }

  const plan = selectedRoom ? plans[selectedRoom]?.plan ?? [] : [];
  const visiblePlan = plan.slice(0, currentStep);

  return (
    <div className="editor">
      <header className="editor-header">
        <h1>Build Plan Editor</h1>
      </header>

      <div className="editor-layout">
        <section className="canvas-section">
          <div className="map-stack">
            <canvas
              ref={canvasRef}
              width={GRID_SIZE * CELL_SIZE}
              height={GRID_SIZE * CELL_SIZE}
              onClick={handleCanvasClick}
              className="room-canvas"
            />
            <div className="map-step-controls">
              <button
                type="button"
                onClick={() => setCurrentStep(0)}
                disabled={currentStep === 0}
                title="First step"
              >
                &lt;&lt;
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                disabled={currentStep === 0}
                title="Previous step"
              >
                &lt;
              </button>
              <div className="map-step-display">
                Step {currentStep} / {plan.length}
              </div>
              <button
                type="button"
                onClick={() =>
                  setCurrentStep(Math.min(plan.length, currentStep + 1))
                }
                disabled={currentStep === plan.length}
                title="Next step"
              >
                &gt;
              </button>
              <button
                type="button"
                onClick={() => setCurrentStep(plan.length)}
                disabled={currentStep === plan.length}
                title="Last step"
              >
                &gt;&gt;
              </button>
            </div>
          </div>
        </section>

        <aside className="sidebar">
          <div className="panel">
            <h2>Room</h2>
            <select
              value={selectedRoom}
              onChange={(e) => {
                setSelectedRoom(e.target.value);
                setCurrentStep(0);
                setSelectedItemIndex(null);
              }}
            >
              {Object.keys(plans).map((room) => (
                <option key={room} value={room}>
                  {room}
                </option>
              ))}
            </select>
          </div>

          <div className="panel">
            <h2>Structure Palette</h2>
            <div className="palette">
              {STRUCTURE_TYPES.map((type) => (
                <button
                  key={type}
                  className={`palette-item ${selectedStructureType === type ? "active" : ""}`}
                  style={{
                    backgroundColor: STRUCTURE_COLORS[type],
                    borderColor:
                      selectedStructureType === type ? "#00ff00" : "#0b0f14",
                  }}
                  onClick={() => setSelectedStructureType(type)}
                  title={STRUCTURE_TYPE_LABELS[type]}
                >
                  {STRUCTURE_TYPE_LABELS[type].substring(0, 3)}
                </button>
              ))}
            </div>
            <p className="hint">Click on canvas to add {STRUCTURE_TYPE_LABELS[selectedStructureType]}</p>
          </div>

          {selectedItemIndex !== null && (
            <div className="panel">
              <h2>Selected Item</h2>
              <div className="item-details">
                <p>
                  <strong>Position:</strong> ({plan[selectedItemIndex].x},
                  {plan[selectedItemIndex].y})
                </p>
                <p>
                  <strong>Type:</strong>{" "}
                  {STRUCTURE_TYPE_LABELS[plan[selectedItemIndex].structureType]}
                </p>
                {plan[selectedItemIndex].purpose && (
                  <p>
                    <strong>Purpose:</strong> {plan[selectedItemIndex].purpose}
                  </p>
                )}
              </div>
              <button onClick={removeSelectedItem} className="danger-btn">
                Remove
              </button>
            </div>
          )}

          {validationErrors.length > 0 && (
            <div className="panel error-panel">
              <h2>Validation Errors</h2>
              <ul>
                {validationErrors.slice(0, 5).map((error, i) => (
                  <li key={i}>
                    Step {error.step}: {error.message}
                  </li>
                ))}
                {validationErrors.length > 5 && (
                  <li>... and {validationErrors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}

          {selectedRoom && !terrain && (
            <div className="panel warning-panel">
              <h2>Terrain Missing</h2>
              <p>Natural wall placement cannot be validated for {selectedRoom}.</p>
            </div>
          )}

          <div className="panel">
            <h2>Actions</h2>
            <button
              onClick={savePlans}
              disabled={isSaving || validationErrors.length > 0 || isConfirmingSave}
              className="save-btn"
            >
              {isSaving ? "Saving..." : "Review Save"}
            </button>
            {isConfirmingSave && (
              <div className="confirm-save">
                <p>
                  Save {plan.length} planned structures for {selectedRoom} to
                  src/buildPlans.ts?
                </p>
                <div className="confirm-actions">
                  <button onClick={confirmSavePlans} className="save-btn">
                    Confirm Save
                  </button>
                  <button onClick={() => setIsConfirmingSave(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {saveMessage && <p className="save-message">{saveMessage}</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
