import { BuildPlansData } from "../types";

interface ToolbarProps {
  selectedRoom: string;
  plans: BuildPlansData;
  showCoordinates: boolean;
  setShowCoordinates: (show: boolean) => void;
  onRoomChange: (room: string) => void;
}

export function Toolbar({
  selectedRoom,
  plans,
  showCoordinates,
  setShowCoordinates,
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
    </div>
  );
}
