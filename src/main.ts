import { extendCreep } from "./extendCreep";
import { buildPlanManager } from "./managers/buildPlanManager";
import { linkTransferManager } from "./managers/linkTransferManager";
import { memoryManager } from "./managers/memoryManager";
import { safeModeManager } from "./managers/safeModeManager";
import { spawnManager } from "./managers/spawnManager";
import { spawnRecoveryManager } from "./managers/spawnRecoveryManager";
import { towerManager } from "./managers/towerManager";
import { builder } from "./roles/builder";
import { carrier } from "./roles/carrier/carrier";
import { claimer } from "./roles/claimer";
import { defender } from "./roles/defender";
import { harvester } from "./roles/harvester";
import { pioneer } from "./roles/pioneer";
import { rangedDefender } from "./roles/rangedDefender";
import { repairer } from "./roles/repairer";
import { settler } from "./roles/settler";
import { upgrader } from "./roles/upgrader";
import { CREEP_ROLE, type CreepRole, type Role } from "./types";

extendCreep();

const roles: Record<CreepRole, Role> = {
  [CREEP_ROLE.PIONEER]: pioneer,
  [CREEP_ROLE.CLAIMER]: claimer,
  [CREEP_ROLE.SETTLER]: settler,
  [CREEP_ROLE.HARVESTER]: harvester,
  [CREEP_ROLE.CARRIER]: carrier,
  [CREEP_ROLE.DEFENDER]: defender,
  [CREEP_ROLE.RANGED_DEFENDER]: rangedDefender,
  [CREEP_ROLE.UPGRADER]: upgrader,
  [CREEP_ROLE.BUILDER]: builder,
  [CREEP_ROLE.REPAIRER]: repairer,
};

export function loop(): void {
  memoryManager.cleanUpCreepMemory();
  spawnRecoveryManager.manageSpawnRecovery();
  buildPlanManager.manageBuildPlans();
  linkTransferManager.manageLinkTransfers();
  towerManager.manageTowers();
  safeModeManager.manageSafeMode();
  spawnManager.manageSpawning();

  for (const name in Game.creeps) {
    const creep = Game.creeps[name];

    if (creep.memory.remoteOperate !== undefined) {
      if (Game.time < creep.memory.remoteOperate) {
        continue;
      }
      delete creep.memory.remoteOperate;
    }

    if (creep.handleSwapRequest()) {
      continue;
    }

    const role = roles[creep.memory.role];
    if (role) {
      role.run(creep);
    } else {
      console.log(`Creep ${name} has an undefined role: ${creep.memory.role}`);
    }
  }
}
