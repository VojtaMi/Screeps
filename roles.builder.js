module.exports = {
    run: function (creep) {
        // If creep is working and has energy, keep working
        if (creep.isWorking() && creep.hasEnergy()) {
            this.work(creep);
        }
        // Else if he needs energy, go get it
        else {
            creep.reFuel();
        }
    },

    // Repair and build, switch to upgrader if nothing to do
    work: function (creep) {
        if (creep.findAndBuild()) { return; }
        if (creep.findAndRepair()) { return; }
        creep.moveAndUpgrade();
    },
};
