import type { CreepRole } from "./types";

declare global {
  type EnergyWithdrawTarget = StructureContainer | Ruin | Tombstone;

  interface CreepMemory {
    role: CreepRole;
    sourceId?: Id<Source>;
    working?: boolean;
  }

  interface RoomBuildPlanItem {
    x: number;
    y: number;
    structureType: BuildableStructureConstant;
    priority?: number;
  }

  interface RoomMemory {
    buildPlan?: RoomBuildPlanItem[];
    buildPlanHash?: string;
  }

  interface Creep {
    needsEnergy(): boolean;
    hasFullEnergy(): boolean;
    hasEnergy(): boolean;
    isAtFlag(flagName: string, range?: number): boolean;
    goToSource(): void;
    transferEnergyTo(target: Structure | AnyCreep | null): void;
    withdrawEnergyFrom(target: EnergyWithdrawTarget | null): void;
    pickUpEnergy(target: Resource<RESOURCE_ENERGY> | null): void;
    goUpgradeController(): void;
    findRepairTarget(): StructureRoad | StructureContainer | StructureRampart | null;
    findAndRepair(): boolean;
    findBuildTarget(): ConstructionSite | null;
    findAndBuild(): boolean;
    goToFlag(flagName: string, range?: number, pathStyle?: PolyStyle): void;
    findDroppedEnergy(): Resource<RESOURCE_ENERGY> | null;
    findAdjacentSourceContainer(source: Source): StructureContainer | null;
    findEnergyContainer(): StructureContainer | null;
    findWithdrawableEnergy(): EnergyWithdrawTarget | null;
    findControllerContainer(): StructureContainer | null;
    findRefuelStructure(): StructureSpawn | StructureExtension | null;
  }
}

export {};
