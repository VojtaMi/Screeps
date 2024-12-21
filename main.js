const extendCreep = require('./extendCreep');
extendCreep(); // This must be called to extend the prototy

const towerLogic = require('structures.tower');

const managers = {
    memory: require('managers.memoryManager'),
    spawn: require('managers.spawnManager'),
};

const roles = {
    harvester: require('roles.harvester'),
    upgrader: require('roles.upgrader'),
    builder: require('roles.builder'),
    carrier: require('roles.carrier'),
};

module.exports.loop = function () {
    // Step 1: Clean up memory
    managers.memory.cleanUpCreepMemory();

    // Step 2: Manage spawning
    managers.spawn.manageSpawning(roles);

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

    // Run tower logic for each tower in the game
    const towers = _.filter(Game.structures, structure => structure.structureType === STRUCTURE_TOWER);
    for (const tower of towers) {
        towerLogic.run(tower);
    }
};
