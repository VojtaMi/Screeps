const MAX_NEIGHBOR_DISTANCE = 2;

export function getRoomNeighbors(roomName: string): string[] {
  const ownedRooms = getOwnedRoomNames();
  const version = [...ownedRooms].sort().join("|");

  if (Memory.ownedRoomLinksVersion !== version || !Memory.ownedRoomLinks) {
    Memory.ownedRoomLinks = buildRoomLinks(ownedRooms);
    Memory.ownedRoomLinksVersion = version;
  }

  return Memory.ownedRoomLinks[roomName] ?? [];
}

function getOwnedRoomNames(): string[] {
  return Object.values(Game.rooms)
    .filter((room) => room.controller?.my)
    .map((room) => room.name);
}

function buildRoomLinks(ownedRooms: string[]): Record<string, string[]> {
  const links: Record<string, string[]> = {};

  for (const roomName of ownedRooms) {
    links[roomName] = ownedRooms
      .filter((other) => {
        if (other === roomName) return false;
        return (
          Game.map.getRoomLinearDistance(roomName, other) <=
          MAX_NEIGHBOR_DISTANCE
        );
      })
      .sort(
        (a, b) =>
          Game.map.getRoomLinearDistance(roomName, a) -
          Game.map.getRoomLinearDistance(roomName, b),
      );
  }

  return links;
}
