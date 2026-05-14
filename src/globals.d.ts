import type { CreepRole } from "./types";

declare global {
  type EnergyWithdrawTarget = StructureContainer | Ruin | Tombstone;
  type EnergyRefillTarget = Resource<RESOURCE_ENERGY> | EnergyWithdrawTarget;

  interface CreepMemory {
    role: CreepRole;
    sourceId?: Id<Source>;
    energyTargetId?: Id<EnergyRefillTarget>;
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
    moveToAvoidingRoomEdges(
      target: Parameters<Creep["moveTo"]>[0],
      opts?: Parameters<Creep["moveTo"]>[1]
    ): ReturnType<Creep["moveTo"]>;
    goToSource(): void;
    transferEnergyTo(target: Structure | AnyCreep | null): void;
    withdrawEnergyFrom(target: EnergyWithdrawTarget | null): void;
    pickUpEnergy(target: Resource<RESOURCE_ENERGY> | null): void;
    clearEnergyTarget(): void;
    findEnergyRefillTarget(): EnergyRefillTarget | null;
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
