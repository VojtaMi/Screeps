export interface BuildPlanItem {
  x: number;
  y: number;
  structureType: string;
  purpose?: string;
}

export interface RoomBuildPlan {
  plan: BuildPlanItem[];
}

export interface BuildPlansData {
  [roomName: string]: RoomBuildPlan;
}

export const STRUCTURE_TYPES = [
  "STRUCTURE_EXTENSION",
  "STRUCTURE_CONTAINER",
  "STRUCTURE_ROAD",
  "STRUCTURE_TOWER",
  "STRUCTURE_WALL",
  "STRUCTURE_RAMPART",
] as const;

export const STRUCTURE_TYPE_LABELS: Record<string, string> = {
  STRUCTURE_EXTENSION: "Extension",
  STRUCTURE_CONTAINER: "Container",
  STRUCTURE_ROAD: "Road",
  STRUCTURE_TOWER: "Tower",
  STRUCTURE_WALL: "Wall",
  STRUCTURE_RAMPART: "Rampart",
};

export const STRUCTURE_COLORS: Record<string, string> = {
  STRUCTURE_EXTENSION: "#f4c542",
  STRUCTURE_CONTAINER: "#c98943",
  STRUCTURE_ROAD: "#9ca3af",
  STRUCTURE_TOWER: "#ef6f6c",
  STRUCTURE_RAMPART: "#4fd1a5",
  STRUCTURE_WALL: "#aeb6c2",
};
