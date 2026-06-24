import { BuildPlansData } from "../types";
import { MAX_RCL } from "../rcl";

interface ToolbarProps {
  selectedRoom: string;
  plans: BuildPlansData;
  currentRcl: number;
  onRclChange: (rcl: number) => void;
  showLandmarks: boolean;
  setShowLandmarks: (show: boolean) => void;
  onRoomChange: (room: string) => void;
}

export function Toolbar({
  selectedRoom,
  plans,
  currentRcl,
  onRclChange,
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
      <label>
        RCL
        <select
          value={currentRcl}
          onChange={(event) => onRclChange(Number(event.target.value))}
        >
          {Array.from({ length: MAX_RCL + 1 }, (_, rcl) => (
            <option key={rcl} value={rcl}>
              {rcl}
            </option>
          ))}
        </select>
      </label>
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
