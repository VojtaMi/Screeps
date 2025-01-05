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
    soldier: require('roles.soldier'),
    settler: require('roles.settler'),

    remoteBuilder: require('roles.remoteBuilder'),
    remoteWorker: require('roles.remoteWorker'),
    remoteWorker2: require('roles.remoteWorker2'),
    remoteCarrier: require('roles.remoteCarrier'),
    remoteBuilder2: require('roles.remoteBuilder2'),
    remoteUpgrader: require('roles.remoteUpgrader'),

    emergencyHarvester: require('roles.emergencyHarvester'),
    emergencyCarrier: require('roles.emergencyCarrier'),
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
