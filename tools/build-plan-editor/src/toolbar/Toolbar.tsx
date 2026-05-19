import { BuildPlansData } from "../types";

interface ToolbarProps {
  selectedRoom: string;
  plans: BuildPlansData;
  showCoordinates: boolean;
  setShowCoordinates: (show: boolean) => void;
  isEraseMode: boolean;
  setIsEraseMode: (erase: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  pastPlans: BuildPlansData[];
  futurePlans: BuildPlansData[];
  onRoomChange: (room: string) => void;
  onClearTilePicker?: () => void;
}

export function Toolbar({
  selectedRoom,
  plans,
  showCoordinates,
  setShowCoordinates,
  isEraseMode,
  setIsEraseMode,
  onUndo,
  onRedo,
  pastPlans,
  futurePlans,
  onRoomChange,
  onClearTilePicker,
}: ToolbarProps) {
  return (
    <div className="build-plan-toolbar editor-toolbar">
      <label>
        Room
        <select
          value={selectedRoom}
          onChange={(event) => {
            const nextRoom = event.target.value;
            onRoomChange(nextRoom);
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
        onClick={() => setShowCoordinates(!showCoordinates)}
      >
        Coordinates
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={onUndo}
        disabled={pastPlans.length === 0}
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
        disabled={futurePlans.length === 0}
        title="Redo"
        aria-label="Redo"
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m 5 2 c -0.265625 0 -0.519531 0.105469 -0.707031 0.292969 l -4 4 c -0.3906252 0.390625 -0.3906252 1.023437 0 1.414062 l 4 4 c 0.390625 0.390625 1.023437 0.390625 1.414062 0 s 0.390625 -1.023437 0 -1.414062 l -2.292969 -2.292969 h 8.585938 c 1.117188 0 2 0.882812 2 2 s -0.882812 2 -2 2 c -0.550781 0 -1 0.449219 -1 1 s 0.449219 1 1 1 c 2.199219 0 4 -1.800781 4 -4 s -1.800781 -4 -4 -4 h -8.585938 l 2.292969 -2.292969 c 0.390625 -0.390625 0.390625 -1.023437 0 -1.414062 c -0.1875 -0.1875 -0.441406 -0.292969 -0.707031 -0.292969 z m 0 0" />
        </svg>
      </button>
      <button
        type="button"
        className={`tool-button ${isEraseMode ? "active" : ""}`}
        onClick={() => {
          setIsEraseMode(!isEraseMode);
          onClearTilePicker?.();
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
  );
}
