module.exports = {
    run: function (creep) {
        // if the creep does not have energy, stop distributing
        if (!creep.hasEnergy()) {
            creep.stopWorking();
        }
        if (creep.hasFullEnergy()) {
            creep.startWorking();
        }
        // If the creep is not working, refuel
        if (!creep.isWorking()) {
            if (creep.collectDroppedEnergy()) { return; }
            if (creep.refuelFrom(STRUCTURE_CONTAINER)) {return;}
            creep.refuelFrom(STRUCTURE_STORAGE)
        }
        if (creep.isWorking()) {
            // Otherwise, refill structures in priority order
            if (creep.refillStructure(STRUCTURE_SPAWN)) { return; }
            if (creep.refillStructure(STRUCTURE_EXTENSION)) { return; }
            // Refill towers if needed
            if (this.refillTower(creep)) { return; }
            if (creep.refillStructure(STRUCTURE_STORAGE)) { return; }
        }
    },

    refillTower: function (creep) {
        const tower = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_TOWER &&
                                   structure.store.getFreeCapacity(RESOURCE_ENERGY) >= 400
        });
        if (creep.transfer(tower, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(tower);
            return true;
        }
        return false; // Return false if no suitable tower is found
    },

    
    bodyParts : generateBodyParts({ CARRY: 2, MOVE: 2 }),
};
