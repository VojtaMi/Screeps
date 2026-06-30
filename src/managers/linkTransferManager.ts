import { getControllerDeliveryLink } from "./buildPlanManager";

export const linkTransferManager = {
  manageLinkTransfers(): void {
    for (const roomName in Game.rooms) {
      manageRoomLinkTransfers(Game.rooms[roomName]);
    }
  },
};

function manageRoomLinkTransfers(room: Room): void {
  const receiverLink = getControllerDeliveryLink(room);
  if (
    !receiverLink ||
    receiverLink.store.getFreeCapacity(RESOURCE_ENERGY) === 0
  ) {
    return;
  }

  const sourceLinks = room.find(FIND_MY_STRUCTURES, {
    filter: (s): s is StructureLink =>
      s.structureType === STRUCTURE_LINK &&
      s.id !== receiverLink.id &&
      s.store[RESOURCE_ENERGY] > 0 &&
      s.cooldown === 0,
  });

  for (const sourceLink of sourceLinks) {
    sourceLink.transferEnergy(receiverLink);
  }
}
