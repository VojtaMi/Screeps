roleUpgrader = {
    run: function(creep) {
        // 1. If the creep is at the flag and has energy, keep upgrading
        if (creep.isAtFlag('ControllerAccessFlag') && creep.hasEnergy()) {
            creep.goUpgradeController();
        }
        // 2. If the creep does not have full energy, go to the source to refill
        else if (creep.needsEnergy()) {
            creep.getEnergy();
        }
        // 3. Otherwise, go to the flag to prepare for upgrading
        else {
            creep.goToFlag('ControllerAccessFlag')
        }
    },
    // bodyParts : generateBodyParts({ WORK: 20, CARRY: 4, MOVE: 2 }),
    bodyParts : generateBodyParts({ WORK: 15, CARRY: 3, MOVE: 2 }),
};

module.exports = roleUpgrader;
