import type { BuildPlansData, BuildPlanItem, RoomLandmark } from "../types";

export const GRID_SIZE: number;
export const TERRAIN_MASK_WALL: number;
export const TERRAIN_MASK_SWAMP: number;

export interface ValidationError {
  roomName?: string;
  step: number;
  message: string;
}

export interface TileInspection {
  room: string;
  x: number;
  y: number;
  terrain: "plain" | "swamp" | "wall" | "unknown";
  terrainCode: number | null;
  isEdge: boolean;
  planned: Array<
    BuildPlanItem & {
      step: number;
      state: "past" | "current" | "future";
    }
  >;
  landmarks: RoomLandmark[];
  validation: ValidationError[];
}

export function getTerrainAt(terrain: string, x: number, y: number): number;
export function isNaturalWall(
  terrain: string,
  x: number,
  y: number,
): boolean;
export function isSwamp(terrain: string, x: number, y: number): boolean;
export function isRoomEdge(x: number, y: number): boolean;
export function validateSameTile(types: string[]): boolean;
export function validateRoomPlan(
  plan: BuildPlanItem[],
  terrain?: string,
): ValidationError[];
export function validateBuildPlans(
  plans: BuildPlansData,
  terrains?: Record<string, string>,
): ValidationError[];
export function inspectTile(options: {
  roomName: string;
  x: number;
  y: number;
  plan: BuildPlanItem[];
  terrain?: string;
  currentStep?: number;
  landmarks?: RoomLandmark[];
}): TileInspection;
