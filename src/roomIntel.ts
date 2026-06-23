interface RoomControllerIntel {
  x: number;
  y: number;
}

interface RoomIntel {
  controller?: RoomControllerIntel;
}

const ROOM_INTEL: Record<string, RoomIntel> = {
  E58S28: { controller: { x: 31, y: 33 } },
  E58S29: { controller: { x: 44, y: 14 } },
  E59S28: { controller: { x: 39, y: 10 } },
  E59S29: { controller: { x: 10, y: 8 } },
};

export function getKnownControllerPosition(
  roomName: string,
): RoomPosition | null {
  const controller = ROOM_INTEL[roomName]?.controller;
  if (!controller) {
    return null;
  }

  return new RoomPosition(controller.x, controller.y, roomName);
}
