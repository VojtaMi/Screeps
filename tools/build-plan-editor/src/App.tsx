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

interface TilePickerState {
  x: number;
  y: number;
  left: number;
  top: number;
  itemIndexes: number[];
}

const CELL_SIZE = 15;
const GRID_SIZE = 50;
const LEGEND_ORDER = [
  "STRUCTURE_WALL",
  "STRUCTURE_CONTAINER",
  "STRUCTURE_EXTENSION",
  "STRUCTURE_RAMPART",
  "STRUCTURE_ROAD",
  "STRUCTURE_TOWER",
];

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
  const [terrainShard, setTerrainShard] = useState<string>("");
  const [showCoordinates, setShowCoordinates] = useState(true);
  const [isEraseMode, setIsEraseMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingSave, setIsConfirmingSave] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [tilePicker, setTilePicker] = useState<TilePickerState | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      loadTerrain(selectedRoom);
    }
    setTilePicker(null);
  }, [selectedRoom]);

  useEffect(() => {
    setTilePicker(null);
  }, [currentStep]);

  useEffect(() => {
    function closeTilePicker(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setTilePicker(null);
      }
    }

    window.addEventListener("keydown", closeTilePicker);
    return () => window.removeEventListener("keydown", closeTilePicker);
  }, []);

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
    showCoordinates,
  ]);

  async function loadPlans() {
    try {
      const response = await fetch("/api/build-plans");
      const data: ApiResponse = await response.json();
      setPlans(data.plans);
      const roomNames = Object.keys(data.plans);
      if (roomNames.length > 0) {
        const initialRoom = roomNames[0];
        setSelectedRoom(initialRoom);
        setCurrentStep(data.plans[initialRoom].plan.length);
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
        setTerrainShard(data.shard);
      } else {
        setTerrain("");
        setTerrainShard("");
      }
    } catch (error) {
      console.error("Failed to load terrain:", error);
      setTerrain("");
      setTerrainShard("");
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

    if (!showCoordinates) {
      return;
    }

    ctx.fillStyle = "#cad1dd";
    ctx.font = "8px ui-monospace, SFMono-Regular, Menlo, monospace";
    for (let i = 0; i < GRID_SIZE; i += 5) {
      ctx.fillText(String(i), i * CELL_SIZE + 2, 9);
      ctx.fillText(String(i), 2, i * CELL_SIZE + 10);
    }
  }

  function drawPlan(ctx: CanvasRenderingContext2D) {
    if (!selectedRoom) return;

    const plan = plans[selectedRoom]?.plan ?? [];
    const tileItems = new Map<
      string,
      Array<{ item: BuildPlanItem; index: number }>
    >();

    for (const [index, item] of plan.entries()) {
      const key = `${item.x},${item.y}`;
      tileItems.set(key, [...(tileItems.get(key) ?? []), { item, index }]);
    }

    for (const items of tileItems.values()) {
      drawTileStructures(ctx, items);
    }
  }

  function getStructureColor(item: BuildPlanItem, isAfterStep: boolean): string {
    const color = STRUCTURE_COLORS[item.structureType] || "#ffffff";
    return isAfterStep ? adjustBrightness(color, 0.5) : color;
  }

  function drawTileStructures(
    ctx: CanvasRenderingContext2D,
    items: Array<{ item: BuildPlanItem; index: number }>
  ) {
    const [{ item: firstItem }] = items;
    const x = firstItem.x * CELL_SIZE;
    const y = firstItem.y * CELL_SIZE;
    const centerX = x + CELL_SIZE / 2;
    const centerY = y + CELL_SIZE / 2;
    const rampart = items.find(
      ({ item }) => item.structureType === "STRUCTURE_RAMPART"
    );
    const road = items.find(
      ({ item }) => item.structureType === "STRUCTURE_ROAD"
    );
    const mainStructure = items.find(
      ({ item }) =>
        item.structureType !== "STRUCTURE_RAMPART" &&
        item.structureType !== "STRUCTURE_ROAD"
    );
    const selected = items.find(({ index }) => index === selectedItemIndex);
    const hasError = items.some(({ index }) =>
      validationErrors.some((error) => error.step === index)
    );

    if (rampart) {
      ctx.fillStyle = getStructureColor(
        rampart.item,
        rampart.index >= currentStep
      );
      ctx.fillRect(x + 2, y + 2, 11, 11);
    }

    if (mainStructure) {
      ctx.fillStyle = getStructureColor(
        mainStructure.item,
        mainStructure.index >= currentStep
      );
      ctx.beginPath();
      ctx.arc(centerX, centerY, 6, 0, Math.PI * 2);
      ctx.fill();

      if (mainStructure.item.purpose) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(centerX - 2, centerY - 2, 4, 4);
      }
    }

    if (road) {
      ctx.fillStyle = getStructureColor(road.item, road.index >= currentStep);
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (hasError || selected) {
      ctx.strokeStyle = hasError ? "#ff0000" : "#00ff00";
      ctx.lineWidth = hasError ? 3 : 2.5;
      ctx.strokeRect(x + 1.5, y + 1.5, CELL_SIZE - 3, CELL_SIZE - 3);
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
    e.stopPropagation();

    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);

    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;

    const plan = plans[selectedRoom].plan;
    const visibleIndexes = plan
      .map((item, index) => ({ item, index }))
      .filter(
        ({ item, index }) =>
          index < currentStep && item.x === x && item.y === y
      )
      .map(({ index }) => index);

    if (visibleIndexes.length === 1) {
      if (isEraseMode) {
        deletePlanItem(visibleIndexes[0]);
      } else {
        setSelectedItemIndex(visibleIndexes[0]);
      }
      setTilePicker(null);
      return;
    }

    if (visibleIndexes.length > 1) {
      setTilePicker({
        x,
        y,
        left: x * CELL_SIZE + CELL_SIZE,
        top: y * CELL_SIZE,
        itemIndexes: visibleIndexes,
      });
      return;
    }

    if (isEraseMode) {
      setTilePicker(null);
      return;
    }

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
    setTilePicker(null);
  }

  function deletePlanItem(itemIndex: number) {
    if (!selectedRoom) return;
    const plan = plans[selectedRoom].plan;
    const newPlan = plan.filter((_, i) => i !== itemIndex);

    setPlans({
      ...plans,
      [selectedRoom]: { plan: newPlan },
    });

    setSelectedItemIndex(null);
    setTilePicker(null);
    setCurrentStep(Math.min(currentStep, newPlan.length));
  }

  function removeSelectedItem() {
    if (selectedItemIndex === null) return;
    deletePlanItem(selectedItemIndex);
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
  const legendEntries = LEGEND_ORDER.map((structureType) => ({
    structureType,
    count: plan.filter((item) => item.structureType === structureType).length,
  })).filter((entry) => entry.count > 0);

  return (
    <div className="editor">
      <header className="editor-header">
        <div>
          <h1>Screeps Build Plan Builder</h1>
        </div>
        <div className="editor-summary">
          {selectedRoom
            ? `${selectedRoom} · ${plan.length} planned structures${
                terrainShard ? ` · terrain ${terrainShard}` : ""
              }`
            : ""}
        </div>
      </header>

      <div className="editor-toolbar">
        <label>
          Room
          <select
            value={selectedRoom}
            onChange={(event) => {
              const nextRoom = event.target.value;
              setSelectedRoom(nextRoom);
              setCurrentStep(plans[nextRoom]?.plan.length ?? 0);
              setSelectedItemIndex(null);
            }}
          >
            {Object.keys(plans).map((room) => (
              <option key={room} value={room}>
                {room}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setShowCoordinates((current) => !current)}
        >
          Coordinates
        </button>
        <button
          type="button"
          className={`tool-button ${isEraseMode ? "active" : ""}`}
          onClick={() => {
            setIsEraseMode((current) => !current);
            setTilePicker(null);
          }}
          title="Erase structures"
          aria-pressed={isEraseMode}
        >
          <svg viewBox="0 -1.01 20.244 20.244" aria-hidden="true">
            <g transform="translate(-1.926 -2.881)">
              <path d="M3.29,10,9,4.29a1,1,0,0,1,1.41,0l5.4,5.4L8.69,16.76l-5.4-5.4A1,1,0,0,1,3.29,10Z" />
              <path d="M3.29,10,9,4.29a1,1,0,0,1,1.41,0l10.3,10.35a1,1,0,0,1,0,1.41l-3.66,3.66a1,1,0,0,1-.71.29H11.93L3.29,11.36A1,1,0,0,1,3.29,10Zm12.47-.26,5,5a1,1,0,0,1,0,1.41L17.1,19.81a1,1,0,0,1-.71.29H11.93L8.69,16.76ZM6,20h6" />
            </g>
          </svg>
          <span>Erase</span>
        </button>
      </div>

      <div className="editor-layout">
        <section className="canvas-section" onClick={() => setTilePicker(null)}>
          <div className="map-stack">
            <div className="map-canvas-wrap">
              <canvas
                ref={canvasRef}
                width={GRID_SIZE * CELL_SIZE}
                height={GRID_SIZE * CELL_SIZE}
                onClick={handleCanvasClick}
                className={`room-canvas ${isEraseMode ? "erase-mode" : ""}`}
              />
              {tilePicker && (
                <div
                  className="tile-picker"
                  style={{ left: tilePicker.left, top: tilePicker.top }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="tile-picker-title">
                    {isEraseMode ? "Erase" : "Select"} ({tilePicker.x},{" "}
                    {tilePicker.y})
                  </div>
                  {tilePicker.itemIndexes.map((itemIndex) => {
                    const item = plan[itemIndex];

                    return (
                      <button
                        key={itemIndex}
                        type="button"
                        className="tile-picker-option"
                        onClick={() => {
                          if (isEraseMode) {
                            deletePlanItem(itemIndex);
                          } else {
                            setSelectedItemIndex(itemIndex);
                          }
                          setTilePicker(null);
                        }}
                      >
                        <span
                          className="tile-picker-swatch"
                          style={{
                            backgroundColor:
                              STRUCTURE_COLORS[item.structureType] ??
                              "#ffffff",
                          }}
                        />
                        <span>
                          Step {itemIndex}:{" "}
                          {STRUCTURE_TYPE_LABELS[item.structureType] ??
                            item.structureType}
                          {item.purpose ? ` (${item.purpose})` : ""}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
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
            <h2>Structure</h2>
            <select
              value={selectedStructureType}
              onChange={(event) => setSelectedStructureType(event.target.value)}
            >
              {STRUCTURE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {STRUCTURE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
            <p className="hint">Click on canvas to add {STRUCTURE_TYPE_LABELS[selectedStructureType]}</p>
          </div>

          <div className="panel">
            <h2>Legend</h2>
            <div className="legend-list">
              {legendEntries.map(({ structureType, count }) => (
                <div className="legend-row" key={structureType}>
                  <span
                    className={`legend-symbol legend-symbol-${structureType
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
