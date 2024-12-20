roleUpgrader = {
    run: function(creep) {
        // 1. If the creep is at the flag and has energy, keep upgrading
        if (creep.isAtFlag('ControllerAccessFlag') && creep.hasEnergy()) {
            creep.moveAndUpgrade();
        }
        // 2. If the creep does not have full energy, go to the source to refill
        else if (creep.needsEnergy()) {
            creep.goToSource();
        }
        // 3. Otherwise, go to the flag to prepare for upgrading
        else {
            creep.goToFlag('ControllerAccessFlag')
        }
    }
};

module.exports = roleUpgrader;
