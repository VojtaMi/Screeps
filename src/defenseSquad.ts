import { isHostileCombatCreep } from "./hostileTargeting";

export const MAX_DEFENSE_SQUAD_SIZE = 4;

export function getDesiredDefenseSquadSize(hostiles: Creep[]): number {
  const combatHostiles = hostiles.filter(isHostileCombatCreep).length;
  if (combatHostiles === 0) {
    return 0;
  }

  return Math.min(MAX_DEFENSE_SQUAD_SIZE, Math.max(2, combatHostiles));
}
