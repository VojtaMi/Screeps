export const CREEP_ROLE = {
  PIONEER: "pioneer",
  CLAIMER: "claimer",
  SETTLER: "settler",
  HARVESTER: "harvester",
  CARRIER: "carrier",
  RANGED_DEFENDER: "rangedDefender",
  UPGRADER: "upgrader",
  BUILDER: "builder",
  REPAIRER: "repairer",
  LAB_TECH: "labTech",
  SAFE_MODE_GENERATOR: "safeModeGenerator",
} as const;

export type CreepRole = (typeof CREEP_ROLE)[keyof typeof CREEP_ROLE];

export interface SpawnRequest {
  role: CreepRole;
  body: BodyPartConstant[];
  memory?: Partial<CreepMemory>;
}

/**
 * Spawn nothing this tick and keep the room's energy for the creep the room
 * actually needs. Distinct from `null`, which means "no request from this
 * policy" and lets the next policy (including cross-room help) have a turn.
 */
export const SPAWN_HOLD = "hold" as const;

export type SpawnDecision = SpawnRequest | typeof SPAWN_HOLD | null;

export interface Role {
  run(creep: Creep): void;
}
