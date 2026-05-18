import type { CreepRole } from "./types";

declare global {
  type DecayingEnergyTarget = Resource<RESOURCE_ENERGY> | Ruin | Tombstone;
  type EnergyWithdrawTarget = StructureContainer | Ruin | Tombstone;
  type EnergyRefillTarget = DecayingEnergyTarget | StructureContainer;
  type EnergyDeliveryTarget =
    | StructureSpawn
    | StructureExtension
    | StructureTower
    | StructureContainer
    | AnyCreep;

  interface CreepMemory {
    role: CreepRole;
    sourceId?: Id<Source>;
    energyTargetId?: Id<EnergyRefillTarget>;
    repairTargetId?: Id<StructureRoad | StructureContainer | StructureRampart>;
    deliveryTargetId?: Id<EnergyDeliveryTarget>;
    working?: boolean;
  }

  interface RoomBuildPlanItem {
    x: number;
    y: number;
    structureType: BuildableStructureConstant;
    priority?: number;
    purpose?: "controllerDelivery";
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
      opts?: Parameters<Creep["moveTo"]>[1],
    ): ReturnType<Creep["moveTo"]>;
    goToSource(): void;
    transferEnergyTo(target: Structure | AnyCreep | null): void;
    withdrawEnergyFrom(target: EnergyWithdrawTarget | null): void;
    pickUpEnergy(target: Resource<RESOURCE_ENERGY> | null): void;
    clearEnergyTarget(): void;
    findEnergyRefillTarget(): EnergyRefillTarget | null;
    goUpgradeController(): void;
    findRepairTarget():
      | StructureRoad
      | StructureContainer
      | StructureRampart
      | null;
    findAndRepair(): boolean;
    findBuildTarget(): ConstructionSite | null;
    findAndBuild(): boolean;
    goToFlag(flagName: string, range?: number, pathStyle?: PolyStyle): void;
    findDecayingEnergy(): DecayingEnergyTarget | null;
    findDroppedEnergy(): Resource<RESOURCE_ENERGY> | null;
    findAdjacentSourceContainer(source: Source): StructureContainer | null;
    findEnergyContainer(): StructureContainer | null;
    findWithdrawableEnergy(): EnergyWithdrawTarget | null;
    findControllerContainer(): StructureContainer | null;
    findRefuelStructure(): StructureSpawn | StructureExtension | null;
  }
}
