const extendCreep = require('./extendCreep');
extendCreep(); // This must be called to extend the prototy

const managers = {
    memory: require('managers.memoryManager'),
    spawn: require('managers.spawnManager'),
};

const roles = {
    harvester: require('roles.harvester'),
    upgrader: require('roles.upgrader'),
    builder: require('roles.builder'),
};

module.exports.loop = function () {
    // Step 1: Clean up memory
    managers.memory.cleanUpCreepMemory();

    // Step 2: Manage spawning
    managers.spawn.manageSpawning();

    // Step 3: Run creep roles
    for (let name in Game.creeps) {
        const creep = Game.creeps[name];
        const role = roles[creep.memory.role];
        if (role) {
            role.run(creep);
        } else {
            console.log(`Creep ${name} has an undefined role: ${creep.memory.role}`);
        }
    }
};
