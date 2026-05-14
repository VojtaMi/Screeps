export type CreepRole = "pioneer" | "harvester" | "carrier" | "defender" | "upgrader" | "builder";

export interface Role {
  run(creep: Creep): void;
}
