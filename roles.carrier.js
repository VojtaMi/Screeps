module.exports = {
    run: function (creep) {
        // If the creep is empty, fetch energy from a container or storage
        if (!creep.hasEnergy()) {
            creep.refuelFrom(STRUCTURE_CONTAINER);
        } 
        // Otherwise, refill structures in priority order
        else {
            if (creep.refillStructure(STRUCTURE_SPAWN)) { return; }
            if (creep.refillStructure(STRUCTURE_EXTENSION)) { return; }
            if (creep.refillStructure(STRUCTURE_TOWER)) { return; }
            if (creep.refillStructure(STRUCTURE_STORAGE)) { return; }
        }
    },

    bodyParts: generateBodyParts({ CARRY: 4, MOVE: 2 }),
    // bodyParts : generateBodyParts({ CARRY: 2, MOVE: 1 }),
};
