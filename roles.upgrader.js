roleUpgrader = {
    run: function(creep) {
        // 1. If the creep is at the flag and has energy, keep upgrading
        if (creep.memory.atFlag && creep.store[RESOURCE_ENERGY] > 0) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, { visualizePathStyle: { stroke: '#00ff00' } });
            }
        }
        // 2. If the creep does not have full energy, go to the source to refill
        else if (creep.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            creep.memory.atFlag = false; // Reset the flag state since it’s gathering energy
            let source = creep.pos.findClosestByPath(FIND_SOURCES);
            if (source && creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
        // 3. Otherwise, go to the flag to prepare for upgrading
        else {
            let flag = Game.flags['Flag1']; // Replace with your flag name
            if (flag) {
                if (creep.pos.inRangeTo(flag.pos, 1)) {
                    creep.memory.atFlag = true; // Mark that the creep has reached the flag
                } else {
                    creep.moveTo(flag, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        }
    }
};

module.exports = roleUpgrader;
