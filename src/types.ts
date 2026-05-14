export type CreepRole = "harvester" | "upgrader" | "builder";

export interface Role {
  run(creep: Creep): void;
}
