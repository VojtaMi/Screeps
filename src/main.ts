import { extendCreep } from "./extendCreep";
import { buildPlanManager } from "./managers/buildPlanManager";
import { memoryManager } from "./managers/memoryManager";
import { spawnManager } from "./managers/spawnManager";
import { spawnRecoveryManager } from "./managers/spawnRecoveryManager";
import { towerManager } from "./managers/towerManager";
import { builder } from "./roles/builder";
import { carrier } from "./roles/carrier/carrier";
import { defender } from "./roles/defender";
import { harvester } from "./roles/harvester";
import { pioneer } from "./roles/pioneer";
import { repairer } from "./roles/repairer";
import { upgrader } from "./roles/upgrader";
import { CREEP_ROLE, type CreepRole, type Role } from "./types";

extendCreep();

const roles: Record<CreepRole, Role> = {
  [CREEP_ROLE.PIONEER]: pioneer,
  [CREEP_ROLE.HARVESTER]: harvester,
  [CREEP_ROLE.CARRIER]: carrier,
  [CREEP_ROLE.DEFENDER]: defender,
  [CREEP_ROLE.UPGRADER]: upgrader,
  [CREEP_ROLE.BUILDER]: builder,
  [CREEP_ROLE.REPAIRER]: repairer,
};

export function loop(): void {
  memoryManager.cleanUpCreepMemory();
  spawnRecoveryManager.manageSpawnRecovery();
  buildPlanManager.manageBuildPlans();
  towerManager.manageTowers();
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
