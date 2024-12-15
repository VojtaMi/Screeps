module.exports = {
    run: function (creep) {
        // Decide the action based on the creep's state
        if (creep.memory.working && creep.store[RESOURCE_ENERGY] > 0) {
            this.performTask(creep); // Keep working on a task
        } else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            this.gatherEnergy(creep); // Go to gather energy
        } else {
            this.switchToWorking(creep); // Switch to working state
        }
    },

    // Function to perform tasks: repair, build, or upgrade
    performTask: function (creep) {
        // Priority 1: Repair
        const repairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                (structure.structureType === STRUCTURE_ROAD ||
                 structure.structureType === STRUCTURE_CONTAINER ||
                 structure.structureType === STRUCTURE_RAMPART) &&
                structure.hits < structure.hitsMax
        });
        if (repairTarget) {
            if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) {
                creep.moveTo(repairTarget, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // Priority 2: Build
        const buildTarget = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if (buildTarget) {
            if (creep.build(buildTarget) === ERR_NOT_IN_RANGE) {
                creep.moveTo(buildTarget, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        // Priority 3: Upgrade controller
        if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
            creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#00ff00' } });
        }
    },

    // Function to gather energy from the nearest source
    gatherEnergy: function (creep) {
        creep.memory.working = false; // Reset working state
        const source = creep.pos.findClosestByPath(FIND_SOURCES);
        if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
        }
    },

    // Function to switch to working state
    switchToWorking: function (creep) {
        creep.memory.working = true; // Mark creep as working
    }
};
