import type { BuildPlansData, BuildPlanItem } from "../types";

export const GRID_SIZE: number;
export const TERRAIN_MASK_WALL: number;
export const TERRAIN_MASK_SWAMP: number;

export interface ValidationError {
  roomName?: string;
  step: number;
  message: string;
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
