import type { CreepRole } from "../types";

const roleCounts: Record<CreepRole, number> = {
  harvester: 1,
  upgrader: 2,
  builder: 5,
};

export const spawnManager = {
  manageSpawning(): void {
    const spawn = Game.spawns.Spawn1;
    if (!spawn) {
      return;
    }

    for (const role of Object.keys(roleCounts) as CreepRole[]) {
      const creeps = Object.values(Game.creeps).filter(creep => creep.memory.role === role);

      if (creeps.length < roleCounts[role]) {
        const newName = `${role}${Game.time}`;
        if (spawn.spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role } }) === OK) {
          console.log(`Spawning new ${role}: ${newName}`);
        }
        break;
      }
    }
  },
};
