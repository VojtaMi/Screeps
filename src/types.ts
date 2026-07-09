export const CREEP_ROLE = {
  PIONEER: "pioneer",
  CLAIMER: "claimer",
  SETTLER: "settler",
  HARVESTER: "harvester",
  CARRIER: "carrier",
  DEFENDER: "defender",
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

export interface Role {
  run(creep: Creep): void;
}
