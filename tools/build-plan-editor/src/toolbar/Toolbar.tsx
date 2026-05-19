import { BuildPlansData } from "../types";

interface ToolbarProps {
  selectedRoom: string;
  plans: BuildPlansData;
  showCoordinates: boolean;
  setShowCoordinates: (show: boolean) => void;
  showLandmarks: boolean;
  setShowLandmarks: (show: boolean) => void;
  onRoomChange: (room: string) => void;
}

export function Toolbar({
  selectedRoom,
  plans,
  showCoordinates,
  setShowCoordinates,
  showLandmarks,
  setShowLandmarks,
  onRoomChange,
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
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={showLandmarks}
          onChange={(event) => setShowLandmarks(event.target.checked)}
        />
        <span className="toggle-switch-track" aria-hidden="true">
          <span className="toggle-switch-thumb" />
        </span>
        <span>Landmarks</span>
      </label>
    </div>
  );
}
