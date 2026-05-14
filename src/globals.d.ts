import type { CreepRole } from "./types";

declare global {
  interface CreepMemory {
    role: CreepRole;
  }

  interface Creep {
    needsEnergy(): boolean;
    hasFullEnergy(): boolean;
    hasEnergy(): boolean;
    isAtFlag(flagName: string, range?: number): boolean;
    goToSource(): void;
    transferEnergyTo(target: Structure | AnyCreep | null): void;
    goUpgradeController(): void;
    findRepairTarget(): StructureRoad | StructureContainer | StructureRampart | null;
    findAndRepair(): boolean;
    findBuildTarget(): ConstructionSite | null;
    findAndBuild(): boolean;
    goToFlag(flagName: string, range?: number, pathStyle?: PolyStyle): void;
    findRefuelStructure(): StructureSpawn | StructureExtension | null;
  }
}

export {};
