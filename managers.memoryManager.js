const memoryManager = {
    cleanUpCreepMemory: function () {
        for (let name in Memory.creeps) {
            if (!Game.creeps[name]) {
                console.log(`Clearing memory of non-existing creep: ${name}`);
                delete Memory.creeps[name];
            }
        }
    }
};

module.exports = memoryManager;
