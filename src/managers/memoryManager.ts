export const memoryManager = {
  cleanUpCreepMemory(): void {
    for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
        console.log(`Clearing memory of non-existing creep: ${name}`);
        delete Memory.creeps[name];
      }
    }
  },
};
