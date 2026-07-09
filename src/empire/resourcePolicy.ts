// Central resource policy for the empire. Managers read desired reserves from
// here so logistics, safe-mode recovery, and lab hubs share one explicit source
// of truth. Keep the numbers conservative: reserves are floors a provider room
// keeps for itself, and targets double as the ceiling a requester room fills to.

// Minerals the between-room logistics system is allowed to move. Ordered by
// priority so higher-value resources (safe-mode ghodium first) win the single
// transfer slot each tick.
export const SHARED_MINERALS: ResourceConstant[] = [
  RESOURCE_GHODIUM, // "G" - safe-mode fuel
  RESOURCE_GHODIUM_OXIDE, // "GO" - TOUGH boost + lab-hub input
  RESOURCE_OXYGEN, // "O" - reverse-reaction product
  RESOURCE_HYDROGEN, // "H" - optional, future boosts
];

// Ghodium consumed by one creep.generateSafeMode call.
export const SAFE_MODE_GHODIUM_COST = 1000;

// Desired holdings (storage + terminal) per room, per resource. A room above
// its reserve for a resource can provide the surplus; a room below it requests.
const DEFAULT_ROOM_RESERVES: Partial<Record<ResourceConstant, number>> = {
  // Every owned room keeps enough ghodium for one safe-mode generation.
  [RESOURCE_GHODIUM]: SAFE_MODE_GHODIUM_COST,
};

const ROOM_RESERVE_OVERRIDES: Record<
  string,
  Partial<Record<ResourceConstant, number>>
> = {
  // Production hub: hoards GO to reverse into G + O, still keeps a safe-mode G.
  E59S28: {
    [RESOURCE_GHODIUM]: SAFE_MODE_GHODIUM_COST,
    [RESOURCE_GHODIUM_OXIDE]: 3000,
  },
  // Exposed frontline: wants extra ghodium (two safe modes) and imported GO for
  // defensive TOUGH boosts, since NPC drops are scarce here.
  E58S28: {
    [RESOURCE_GHODIUM]: 2 * SAFE_MODE_GHODIUM_COST,
    [RESOURCE_GHODIUM_OXIDE]: 2000,
  },
};

// Desired count of available safe-mode activations per room.
const DEFAULT_SAFE_MODE_RESERVE = 1;
const SAFE_MODE_RESERVE_OVERRIDES: Record<string, number> = {
  E58S28: 2,
};

export function getRoomReserve(
  roomName: string,
  resource: ResourceConstant,
): number {
  return (
    ROOM_RESERVE_OVERRIDES[roomName]?.[resource] ??
    DEFAULT_ROOM_RESERVES[resource] ??
    0
  );
}

export function getDesiredSafeModes(roomName: string): number {
  return SAFE_MODE_RESERVE_OVERRIDES[roomName] ?? DEFAULT_SAFE_MODE_RESERVE;
}

// Combined storage + terminal holdings, the amount policy reasons about.
export function getStoredAmount(
  room: Room,
  resource: ResourceConstant,
): number {
  const storageAmount = room.storage?.store[resource] ?? 0;
  const terminalAmount = room.terminal?.store[resource] ?? 0;
  return storageAmount + terminalAmount;
}

export function isSharedMineral(resource: ResourceConstant): boolean {
  return (SHARED_MINERALS as ResourceConstant[]).includes(resource);
}
