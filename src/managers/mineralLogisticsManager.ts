import {
  getRoomReserve,
  getStoredAmount,
  SHARED_MINERALS,
} from "../empire/resourcePolicy";

// Between-room mineral sharing over terminals. Deliberately conservative:
//
// - Rooms above their reserve for a resource are providers; rooms below are
//   requesters (a hysteresis buffer keeps small oscillations from ping-ponging).
// - At most one transfer is issued per tick across the whole empire.
// - Providers only ever send the surplus that is already sitting in their
//   terminal, and never below the terminal energy needed to pay for the send.
// - Nearby providers are preferred so energy cost stays low.
//
// This is not market logic: nothing is bought or sold, only moved between owned
// rooms with terminals.

const MIN_TRANSFER_AMOUNT = 200;
const MAX_TRANSFER_AMOUNT = 2000;
// Only act on clear imbalances so tiny differences never trigger churn.
const PROVIDER_MIN_SURPLUS = 200;
const REQUESTER_MIN_DEFICIT = 200;

interface TerminalRoom {
  room: Room;
  terminal: StructureTerminal;
}

interface Transfer {
  from: TerminalRoom;
  to: TerminalRoom;
  resource: ResourceConstant;
  amount: number;
}

export const mineralLogisticsManager = {
  manageMineralLogistics(): void {
    const rooms = getTerminalRooms();
    if (rooms.length < 2) {
      return;
    }

    const transfer = findBestTransfer(rooms);
    if (!transfer) {
      return;
    }

    executeTransfer(transfer);
  },
};

function getTerminalRooms(): TerminalRoom[] {
  const rooms: TerminalRoom[] = [];
  for (const roomName in Game.rooms) {
    const room = Game.rooms[roomName];
    if (room.controller?.my && room.terminal) {
      rooms.push({ room, terminal: room.terminal });
    }
  }
  return rooms;
}

// Walk resources in priority order; return the first sendable transfer found so
// higher-value minerals (ghodium) win the single per-tick slot.
function findBestTransfer(rooms: TerminalRoom[]): Transfer | null {
  for (const resource of SHARED_MINERALS) {
    const transfer = findResourceTransfer(rooms, resource);
    if (transfer) {
      return transfer;
    }
  }
  return null;
}

function findResourceTransfer(
  rooms: TerminalRoom[],
  resource: ResourceConstant,
): Transfer | null {
  const requesters = rooms
    .map((entry) => ({
      entry,
      deficit:
        getRoomReserve(entry.room.name, resource) -
        getStoredAmount(entry.room, resource),
    }))
    .filter(({ deficit }) => deficit >= REQUESTER_MIN_DEFICIT)
    .sort((left, right) => right.deficit - left.deficit);

  for (const { entry: requester, deficit } of requesters) {
    const provider = findNearestProvider(rooms, requester, resource);
    if (!provider) {
      continue;
    }

    const amount = clampTransferAmount(
      Math.min(deficit, provider.surplus),
      requester,
      provider.entry,
      resource,
    );
    if (amount >= MIN_TRANSFER_AMOUNT) {
      return {
        from: provider.entry,
        to: requester,
        resource,
        amount,
      };
    }
  }

  return null;
}

interface Provider {
  entry: TerminalRoom;
  surplus: number;
}

function findNearestProvider(
  rooms: TerminalRoom[],
  requester: TerminalRoom,
  resource: ResourceConstant,
): Provider | null {
  return (
    rooms
      .filter((entry) => entry.room.name !== requester.room.name)
      .map((entry) => ({
        entry,
        // Only the surplus already in the terminal can actually be sent.
        surplus: Math.min(
          getStoredAmount(entry.room, resource) -
            getRoomReserve(entry.room.name, resource),
          entry.terminal.store[resource],
        ),
      }))
      .filter(
        (provider) =>
          provider.surplus >= PROVIDER_MIN_SURPLUS &&
          provider.entry.terminal.cooldown === 0,
      )
      .sort(
        (left, right) =>
          roomDistance(requester.room.name, left.entry.room.name) -
          roomDistance(requester.room.name, right.entry.room.name),
      )[0] ?? null
  );
}

// Fit the transfer to what the requester terminal can hold and what the provider
// terminal can pay to send.
function clampTransferAmount(
  desired: number,
  requester: TerminalRoom,
  provider: TerminalRoom,
  resource: ResourceConstant,
): number {
  let amount = Math.min(desired, MAX_TRANSFER_AMOUNT);
  amount = Math.min(amount, requester.terminal.store.getFreeCapacity(resource));
  if (amount < MIN_TRANSFER_AMOUNT) {
    return 0;
  }

  // Shrink the amount until the provider can afford the energy cost of the send.
  const availableEnergy = provider.terminal.store[RESOURCE_ENERGY];
  while (amount >= MIN_TRANSFER_AMOUNT) {
    const cost = Game.market.calcTransactionCost(
      amount,
      provider.room.name,
      requester.room.name,
    );
    if (cost <= availableEnergy) {
      return amount;
    }
    amount -= MIN_TRANSFER_AMOUNT;
  }

  return 0;
}

function executeTransfer(transfer: Transfer): void {
  const { from, to, resource, amount } = transfer;
  const result = from.terminal.send(resource, amount, to.room.name);
  if (result === OK) {
    console.log(
      `Mineral logistics: sent ${amount} ${resource} from ${from.room.name} to ${to.room.name}`,
    );
  } else {
    console.log(
      `Mineral logistics: failed to send ${amount} ${resource} from ${from.room.name} to ${to.room.name}: ${result}`,
    );
  }
}

function roomDistance(a: string, b: string): number {
  return Game.map.getRoomLinearDistance(a, b);
}
