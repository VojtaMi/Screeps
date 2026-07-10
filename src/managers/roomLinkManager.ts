const MAX_NEIGHBOR_DISTANCE = 2;

export function getRoomNeighbors(roomName: string): string[] {
  const ownedRooms = getOwnedRoomNames();
  const version = [...ownedRooms].sort().join("|");

  if (
    Memory.ownedRoomLinksVersion !== version ||
    !Memory.ownedRoomLinks ||
    !Memory.ownedRoomRoutes
  ) {
    Memory.ownedRoomLinks = buildRoomLinks(ownedRooms);
    Memory.ownedRoomRoutes = buildRoomRoutes(Memory.ownedRoomLinks);
    Memory.ownedRoomLinksVersion = version;
  }

  return (Memory.ownedRoomLinks[roomName] ?? []).filter((otherRoomName) =>
    isCachedRouteSafe(roomName, otherRoomName),
  );
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

function buildRoomRoutes(
  links: Record<string, string[]>,
): Record<string, Record<string, string[]>> {
  const routes: Record<string, Record<string, string[]>> = {};

  for (const [originRoomName, linkedRoomNames] of Object.entries(links)) {
    routes[originRoomName] = {};

    for (const targetRoomName of linkedRoomNames) {
      const route = Game.map.findRoute(originRoomName, targetRoomName);
      if (route === ERR_NO_PATH) continue;

      routes[originRoomName][targetRoomName] = route.map((step) => step.room);
    }
  }

  return routes;
}

function isCachedRouteSafe(
  originRoomName: string,
  targetRoomName: string,
): boolean {
  const route = Memory.ownedRoomRoutes?.[originRoomName]?.[targetRoomName];
  if (!route) return false;

  return [originRoomName, ...route].every((roomName) => {
    const room = Game.rooms[roomName];
    return (
      room?.controller?.my === true &&
      room.find(FIND_HOSTILE_CREEPS).length === 0
    );
  });
}
