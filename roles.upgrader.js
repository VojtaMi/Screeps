roleUpgrader = {
    run: function(creep) {
        // 1. If the creep has energy, upgrade the controller
        if (creep.hasEnergy()){
            creep.goUpgradeController();
        }
        // 2. If the creep does not have full energy, go to the source to refill
        else if (creep.needsEnergy()) {
            creep.goToSource();
        }
    }
};

module.exports = roleUpgrader;
