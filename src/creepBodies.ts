const repeatBody = (count: number, parts: BodyPartConstant[]) =>
  Array.from({ length: count }).flatMap(() => parts);

// Combat body with self-heal woven through the pattern (not just appended) so
// that budget-trimmed bodies still get a proportional ~25% HEAL share. Self-heal
// keeps defenders alive when towers are busy, drained, or destroyed.
const rangedDefenderBody = (): BodyPartConstant[] =>
  repeatBody(5, [
    TOUGH,
    RANGED_ATTACK,
    MOVE,
    RANGED_ATTACK,
    MOVE,
    RANGED_ATTACK,
    HEAL,
    MOVE,
  ]);

interface BodyBuildOptions {
  maxBody: BodyPartConstant[];
  energyBudget: number;
  minimumSize?: number;
  sortBody?: (body: BodyPartConstant[]) => BodyPartConstant[];
}

export const CREEP_BODY = {
  PIONEER: [
    WORK,
    CARRY,
    MOVE,
    CARRY,
    MOVE,
    ...repeatBody(5, [WORK, CARRY, MOVE, MOVE]),
  ],
  CLAIMER: [CLAIM, MOVE],
  HARVESTER: [WORK, CARRY, MOVE, WORK, WORK, CARRY, WORK, WORK, MOVE, WORK],
  UPGRADER: [
    WORK,
    CARRY,
    MOVE,
    ...repeatBody(4, [WORK, WORK, WORK, WORK, MOVE, CARRY]),
  ],
  CARRIER: [...repeatBody(4, [MOVE, CARRY, CARRY])],
  LAB_TECH: [...repeatBody(6, [CARRY, CARRY, MOVE])],
  RANGED_DEFENDER: rangedDefenderBody(),
  WORKER: [
    WORK,
    CARRY,
    MOVE,
    WORK,
    CARRY,
    WORK,
    MOVE,
    WORK,
    CARRY,
    MOVE,
    CARRY,
    CARRY,
    MOVE,
  ],
} satisfies Record<string, BodyPartConstant[]>;

export function bodyCost(body: BodyPartConstant[]): number {
  return body.reduce((total, part) => total + BODYPART_COST[part], 0);
}

export function minimumBodyCost(body: BodyPartConstant[]): number {
  return bodyCost(body.slice(0, 3));
}

export function buildBodyFromMaxPattern({
  maxBody,
  energyBudget,
  minimumSize = 3,
  sortBody,
}: BodyBuildOptions): BodyPartConstant[] {
  const minimumBody = maxBody.slice(0, minimumSize);
  if (energyBudget < bodyCost(minimumBody)) {
    return sortBody ? sortBody(minimumBody) : minimumBody;
  }

  const body = [...minimumBody];

  for (const part of maxBody.slice(minimumBody.length)) {
    const nextBody = [...body, part];
    if (nextBody.length > MAX_CREEP_SIZE || bodyCost(nextBody) > energyBudget) {
      break;
    }

    body.push(part);
  }

  return sortBody ? sortBody(body) : body;
}
