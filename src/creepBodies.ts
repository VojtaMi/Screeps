const repeatBody = (count: number, parts: BodyPartConstant[]) =>
  Array.from({ length: count }).flatMap(() => parts);

export const CREEP_BODY = {
  PIONEER: [WORK, CARRY, MOVE, CARRY, MOVE],
  HARVESTER: [WORK, CARRY, MOVE, WORK, WORK, CARRY, WORK, WORK, MOVE, WORK],
  UPGRADER: [
    WORK,
    CARRY,
    MOVE,
    ...repeatBody(4, [WORK, WORK, WORK, WORK, MOVE, CARRY]),
  ],
  CARRIER: [...repeatBody(4, [MOVE, CARRY, CARRY])],
  DEFENDER: [...repeatBody(15, [TOUGH, ATTACK, MOVE])],
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
