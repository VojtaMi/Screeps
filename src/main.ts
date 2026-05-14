import { extendCreep } from "./extendCreep";
import { memoryManager } from "./managers/memoryManager";
import { spawnManager } from "./managers/spawnManager";
import { builder } from "./roles/builder";
import { harvester } from "./roles/harvester";
import { upgrader } from "./roles/upgrader";
import type { CreepRole, Role } from "./types";

extendCreep();

const roles: Record<CreepRole, Role> = {
  harvester,
  upgrader,
  builder,
};

export function loop(): void {
  memoryManager.cleanUpCreepMemory();
  spawnManager.manageSpawning();

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];
    const role = roles[creep.memory.role];
    if (role) {
      role.run(creep);
    } else {
      console.log(`Creep ${name} has an undefined role: ${creep.memory.role}`);
    }
  }
}
