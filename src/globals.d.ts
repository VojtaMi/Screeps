import type { BuildPlanAction, BuildPlanPurpose } from "../shared/buildPlans";
import type { CreepRole } from "./types";

declare global {
  type DecayingEnergyTarget = Resource<RESOURCE_ENERGY> | Ruin | Tombstone;
  type EnergyWithdrawTarget =
    | StructureContainer
    | StructureStorage
    | StructureLink
    | Ruin
    | Tombstone;
  type EnergyRefillTarget =
    | DecayingEnergyTarget
    | StructureContainer
    | StructureStorage;
  type EnergyDeliveryTarget =
    | StructureSpawn
    | StructureExtension
    | StructureTower
    | StructureContainer
    | StructureStorage
    | StructureTerminal
    | AnyCreep;
  interface MoveToAvoidingRoomEdgesOpts extends MoveToOpts {
    requestSwap?: boolean;
  }

  interface CreepMemory {
    role: CreepRole;
    targetRoom?: string;
    sourceId?: Id<Source>;
    energyTargetId?: Id<EnergyRefillTarget>;
    repairTargetId?: Id<
      StructureRoad | StructureContainer | StructureRampart | StructureWall
    >;
    deliveryTargetId?: Id<EnergyDeliveryTarget>;
    moveLastX?: number;
    moveLastY?: number;
    moveLastRoomName?: string;
    moveLastTick?: number;
    moveStuckCount?: number;
    swapRequest?: {
      requesterName: string;
      requesterX: number;
      requesterY: number;
      requesterRoomName: string;
      tick: number;
    };
    lastSwapCreepName?: string;
    lastSwapTick?: number;
    working?: boolean;
    remoteOperate?: number;
    wantsBoost?: boolean;
    boosted?: boolean;
    boostDeadline?: number;
  }

  interface DefenseAssignment {
    x: number;
    y: number;
  }

  interface RoomDefensePlan {
    targetId: Id<Creep>;
    targetX: number;
    targetY: number;
    updatedAt: number;
    roster: string[];
    assignments: Record<string, DefenseAssignment>;
  }

  interface RoomBuildPlanItem {
    x: number;
    y: number;
    structureType: BuildableStructureConstant;
    priority?: number;
    purpose?: BuildPlanPurpose;
    action?: BuildPlanAction;
    minRcl?: number;
  }

  interface RoomMemory {
    buildPlan?: RoomBuildPlanItem[];
    buildPlanHash?: string;
    desiredBuilders?: number;
    desiredCarriers?: number;
    desiredUpgraders?: number;
    towerTargetId?: Id<Creep>;
    defensePlan?: RoomDefensePlan;
  }

  interface Memory {
    expansionTargets?: Record<
      string,
      {
        claimerName?: string;
        settlerName?: string;
        lastAttemptTick?: number;
        failedUntilTick?: number;
      }
    >;
    ownedRoomLinks?: Record<string, string[]>;
    ownedRoomRoutes?: Record<string, Record<string, string[]>>;
    ownedRoomLinksVersion?: string;
  }

  interface Creep {
    needsEnergy(): boolean;
    hasFullEnergy(): boolean;
    hasEnergy(): boolean;
    isAtFlag(flagName: string, range?: number): boolean;
    moveToAvoidingRoomEdges(
      target: Parameters<Creep["moveTo"]>[0],
      opts?: MoveToAvoidingRoomEdgesOpts,
    ): ReturnType<Creep["moveTo"]>;
    handleSwapRequest(): boolean;
    moveOffRoad(): boolean;
    moveToWorkTarget(
      target: Parameters<Creep["moveTo"]>[0],
      actionResult:
        | ReturnType<Creep["build"]>
        | ReturnType<Creep["repair"]>
        | ReturnType<Creep["upgradeController"]>,
      range?: number,
      opts?: Parameters<Creep["moveTo"]>[1],
    ): boolean;
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
      | StructureWall
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
