export type CreepRole =
  | "pioneer"
  | "harvester"
  | "carrier"
  | "defender"
  | "upgrader"
  | "builder"
  | "repairer";

export interface Role {
  run(creep: Creep): void;
}
