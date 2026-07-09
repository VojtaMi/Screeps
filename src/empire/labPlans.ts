// Explicit lab configuration. Production reactions and target-room boost labs
// are declared here by fixed coordinates so the behavior is easy to read and
// extend. Every lookup tolerates missing labs (early RCL, post-attack, partial
// build plans) and returns null rather than assuming a structure exists.

export interface LabPos {
  x: number;
  y: number;
}

// A room-local reverse reaction: the source lab holds the compound, and the two
// output labs receive the reagents. For GO the reagents are [G, O].
export interface ProductionLabPlan {
  roomName: string;
  compound: ResourceConstant;
  reagents: [ResourceConstant, ResourceConstant];
  sourceLab: LabPos;
  outputLabs: [LabPos, LabPos];
}

// Target-room boost labs. These only ever hold a single boost mineral plus
// energy; the room does not run production chemistry.
export interface BoostLabPlan {
  roomName: string;
  boost: ResourceConstant;
  boostedPart: BodyPartConstant;
  labs: LabPos[];
}

// E59S28 is the first production hub. Its 10-lab cluster centers on 38,29 with
// the documented central pair at 37,29 and 39,29 kept as the reagent outputs;
// the geometric center holds the GO being broken down. All three sit within
// reaction range (2) of each other.
export const PRODUCTION_LAB_PLANS: ProductionLabPlan[] = [
  {
    roomName: "E59S28",
    compound: RESOURCE_GHODIUM_OXIDE,
    reagents: [RESOURCE_GHODIUM, RESOURCE_OXYGEN],
    sourceLab: { x: 38, y: 29 },
    outputLabs: [
      { x: 37, y: 29 },
      { x: 39, y: 29 },
    ],
  },
];

// E58S28 is the exposed frontline room; its local labs prepare GO for defensive
// TOUGH boosts. Boost labs are kept separate from any production cluster.
export const BOOST_LAB_PLANS: BoostLabPlan[] = [
  {
    roomName: "E58S28",
    boost: RESOURCE_GHODIUM_OXIDE,
    boostedPart: TOUGH,
    labs: [
      { x: 42, y: 47 },
      { x: 42, y: 48 },
      { x: 41, y: 48 },
    ],
  },
];

// Keep the production source lab buffered with this much compound so reactions
// keep running between refills.
export const SOURCE_LAB_TARGET_MINERAL = 1500;
// Keep boost labs topped to these levels so a defender can boost on arrival.
export const BOOST_LAB_TARGET_MINERAL = 900;
export const BOOST_LAB_TARGET_ENERGY = 600;
// A boost lab counts as usable once it can boost at least this many TOUGH parts.
export const MIN_BOOST_PARTS = 3;

export function getProductionLabPlan(
  roomName: string,
): ProductionLabPlan | null {
  return (
    PRODUCTION_LAB_PLANS.find((plan) => plan.roomName === roomName) ?? null
  );
}

export function getBoostLabPlan(roomName: string): BoostLabPlan | null {
  return BOOST_LAB_PLANS.find((plan) => plan.roomName === roomName) ?? null;
}

// Resolve a planned lab position to the live structure, or null if not built.
export function getLabAt(room: Room, pos: LabPos): StructureLab | null {
  return (
    room
      .lookForAt(LOOK_STRUCTURES, pos.x, pos.y)
      .find((s): s is StructureLab => s.structureType === STRUCTURE_LAB) ?? null
  );
}

export function getBoostLabs(room: Room, plan: BoostLabPlan): StructureLab[] {
  return plan.labs
    .map((pos) => getLabAt(room, pos))
    .filter((lab): lab is StructureLab => lab !== null);
}

// True when the lab holds enough of the boost mineral and energy to boost the
// requested number of parts.
export function isBoostLabReady(
  lab: StructureLab,
  boost: ResourceConstant,
  parts: number,
): boolean {
  return (
    lab.mineralType === boost &&
    lab.store[boost] >= parts * LAB_BOOST_MINERAL &&
    lab.store[RESOURCE_ENERGY] >= parts * LAB_BOOST_ENERGY
  );
}

// The first boost lab in the room ready to boost `parts` parts, or null.
export function findReadyBoostLab(
  room: Room,
  parts: number = MIN_BOOST_PARTS,
): StructureLab | null {
  const plan = getBoostLabPlan(room.name);
  if (!plan) {
    return null;
  }

  return (
    getBoostLabs(room, plan).find((lab) =>
      isBoostLabReady(lab, plan.boost, parts),
    ) ?? null
  );
}
