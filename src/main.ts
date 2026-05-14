import { extendCreep } from "./extendCreep";
import { buildPlanManager } from "./managers/buildPlanManager";
import { memoryManager } from "./managers/memoryManager";
import { spawnManager } from "./managers/spawnManager";
import { builder } from "./roles/builder";
import { carrier } from "./roles/carrier";
import { defender } from "./roles/defender";
import { harvester } from "./roles/harvester";
import { pioneer } from "./roles/pioneer";
import { repairer } from "./roles/repairer";
import { upgrader } from "./roles/upgrader";
import type { CreepRole, Role } from "./types";

extendCreep();

const roles: Record<CreepRole, Role> = {
  pioneer,
  harvester,
  carrier,
  defender,
  upgrader,
  builder,
  repairer,
};

export function loop(): void {
  memoryManager.cleanUpCreepMemory();
  buildPlanManager.manageBuildPlans();
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
