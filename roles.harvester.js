module.exports = {
    run: function (creep) {
        if (creep.hasEnergy()){
            const target = creep.findRefuelStructure();
            if (target) {
                creep.transferEnergyTo(target);
            }
        }
        else {
            creep.goToSource();
        }
    }
};
