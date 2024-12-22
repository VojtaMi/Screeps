module.exports = {
    run: function (creep) {
        // if the creep does not have energy, stop distributing
        if (!creep.hasEnergy()){
            creep.stopWorking();
        }
        if (creep.hasFullEnergy()){
            creep.startWorking();
        }
        // If the creep is not working, refuel
        if (!creep.isWorking()) {
            if (creep.collectDroppedEnergy()) {return;}
            creep.refuelFrom(STRUCTURE_CONTAINER);
        } 
        if (creep.isWorking()){
            // Otherwise, refill structures in priority order
            if (creep.refillStructure(STRUCTURE_SPAWN)) { return; }
            if (creep.refillStructure(STRUCTURE_EXTENSION)) { return; }
            if (creep.refillStructure(STRUCTURE_TOWER)) { return; }
            if (creep.refillStructure(STRUCTURE_STORAGE)) { return; }
        }
        
    },

    bodyParts: generateBodyParts({ CARRY: 8, MOVE: 4 }),
    // bodyParts : generateBodyParts({ CARRY: 2, MOVE: 1 }),
};
