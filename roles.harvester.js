module.exports = {
    run: function (creep) {
        if (creep.needsEnergy()) {
            creep.goToSource();
        } else {
            const target = creep.findRefuelStructure();
            if (target) {
                creep.transferEnergyTo(target);
            }
        }
    }
};
