export function chooseDefenseDeliveryTarget<T>(
  committedBreach: boolean,
  emergencyTower: T | null,
  savedTarget: T | null,
): T | null {
  if (committedBreach && emergencyTower) {
    return emergencyTower;
  }

  return savedTarget;
}
