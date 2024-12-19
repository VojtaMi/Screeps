module.exports = {
    run: function (creep) {
        // If creep is working and has energy, transfer energy
        if (creep.isWorking() && creep.hasEnergy()) {
            const target = creep.findRefuelStructure();
            if (target) {
                creep.transferEnergyTo(target);
            }
        } 
        // If creep has no energy, stop working and go harvest
        else {
            creep.reFuel();
        }
    },
    bodyParts : generateBodyParts({ WORK: 4, CARRY: 2, MOVE: 2 }),
};
