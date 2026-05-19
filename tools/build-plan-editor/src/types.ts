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

export type EditorMode = "select" | "build" | "erase";

export type RoomLandmarkType = "controller" | "source" | "mineral";

export interface RoomLandmark {
  id: string;
  type: RoomLandmarkType;
  x: number;
  y: number;
  label?: string;
}

export const STRUCTURE_TYPES = [
  "STRUCTURE_SPAWN",
  "STRUCTURE_EXTENSION",
  "STRUCTURE_CONTAINER",
  "STRUCTURE_STORAGE",
  "STRUCTURE_LINK",
  "STRUCTURE_ROAD",
  "STRUCTURE_TOWER",
  "STRUCTURE_TERMINAL",
  "STRUCTURE_LAB",
  "STRUCTURE_EXTRACTOR",
  "STRUCTURE_FACTORY",
  "STRUCTURE_WALL",
  "STRUCTURE_RAMPART",
] as const;

export const STRUCTURE_TYPE_LABELS: Record<string, string> = {
  STRUCTURE_SPAWN: "Spawn",
  STRUCTURE_EXTENSION: "Extension",
  STRUCTURE_CONTAINER: "Container",
  STRUCTURE_STORAGE: "Storage",
  STRUCTURE_LINK: "Link",
  STRUCTURE_ROAD: "Road",
  STRUCTURE_TOWER: "Tower",
  STRUCTURE_TERMINAL: "Terminal",
  STRUCTURE_LAB: "Lab",
  STRUCTURE_EXTRACTOR: "Extractor",
  STRUCTURE_FACTORY: "Factory",
  STRUCTURE_WALL: "Wall",
  STRUCTURE_RAMPART: "Rampart",
};

export const STRUCTURE_COLORS: Record<string, string> = {
  STRUCTURE_SPAWN: "#7dd3fc",
  STRUCTURE_EXTENSION: "#f4c542",
  STRUCTURE_CONTAINER: "#c98943",
  STRUCTURE_STORAGE: "#60a5fa",
  STRUCTURE_LINK: "#22d3ee",
  STRUCTURE_ROAD: "#9ca3af",
  STRUCTURE_TOWER: "#ef6f6c",
  STRUCTURE_TERMINAL: "#c084fc",
  STRUCTURE_LAB: "#f472b6",
  STRUCTURE_EXTRACTOR: "#38bdf8",
  STRUCTURE_FACTORY: "#fb923c",
  STRUCTURE_RAMPART: "#4fd1a5",
  STRUCTURE_WALL: "#aeb6c2",
};
