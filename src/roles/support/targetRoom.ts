import { getKnownControllerPosition } from "../../roomIntel";

export function moveToTargetRoom(
  creep: Creep,
  targetRoom: string,
  pathStyle: PolyStyle,
): boolean {
  if (creep.room.name === targetRoom) {
    return false;
  }

  const targetPosition =
    getKnownControllerPosition(targetRoom) ??
    new RoomPosition(25, 25, targetRoom);

  creep.moveToAvoidingRoomEdges(targetPosition, {
    visualizePathStyle: pathStyle,
  });
  return true;
}
