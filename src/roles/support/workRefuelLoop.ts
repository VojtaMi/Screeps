import { collectLocalEnergy } from "./localEnergy";

export function runWorkRefuelLoop(
  creep: Creep,
  work: (creep: Creep) => void,
  idle: (creep: Creep) => void = (idleCreep) => {
    idleCreep.moveOffRoad();
  },
): void {
  if (creep.memory.working && !creep.hasEnergy()) {
    creep.memory.working = false;
  }
  if (!creep.memory.working && creep.hasFullEnergy()) {
    creep.memory.working = true;
    creep.clearEnergyTarget();
  }

  if (creep.memory.working) {
    work(creep);
    return;
  }

  if (collectLocalEnergy(creep)) {
    return;
  }

  if (creep.hasEnergy()) {
    creep.memory.working = true;
    creep.clearEnergyTarget();
    work(creep);
    return;
  }

  idle(creep);
}
