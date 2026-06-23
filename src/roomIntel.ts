interface RoomControllerIntel {
  x: number;
  y: number;
}

interface RoomIntel {
  controller?: RoomControllerIntel;
}

const ROOM_INTEL: Record<string, RoomIntel> = {
  E58S28: { controller: { x: 22, y: 44 } },
  E58S29: { controller: { x: 24, y: 21 } },
  E59S28: { controller: { x: 41, y: 34 } },
  E59S29: { controller: { x: 6, y: 28 } },
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
