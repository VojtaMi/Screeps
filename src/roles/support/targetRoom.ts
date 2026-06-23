import { getKnownControllerPosition } from "../../roomIntel";

function isRoomEdge(pos: RoomPosition): boolean {
  return pos.x === 0 || pos.x === 49 || pos.y === 0 || pos.y === 49;
}

function getNearestInteriorPosition(pos: RoomPosition): RoomPosition {
  return new RoomPosition(
    Math.max(1, Math.min(48, pos.x)),
    Math.max(1, Math.min(48, pos.y)),
    pos.roomName,
  );
}

export function moveToTargetRoom(
  creep: Creep,
  targetRoom: string,
  pathStyle: PolyStyle,
): boolean {
  if (creep.room.name === targetRoom) {
    if (isRoomEdge(creep.pos)) {
      creep.moveToAvoidingRoomEdges(getNearestInteriorPosition(creep.pos), {
        visualizePathStyle: pathStyle,
      });
      return true;
    }

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
