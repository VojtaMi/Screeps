export const CREEP_ROLE = {
  PIONEER: "pioneer",
  HARVESTER: "harvester",
  CARRIER: "carrier",
  DEFENDER: "defender",
  UPGRADER: "upgrader",
  BUILDER: "builder",
  REPAIRER: "repairer",
} as const;

export type CreepRole = (typeof CREEP_ROLE)[keyof typeof CREEP_ROLE];

export interface Role {
  run(creep: Creep): void;
}
