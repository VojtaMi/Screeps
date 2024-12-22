module.exports = {
    run: function (creep) {
        let targetRoom = 'E52S44';

        if (!creep.isInRoom(targetRoom)) {
            creep.goToRoom(targetRoom);
            return;
        }
        // If creep is working and has energy, keep working
        if (creep.isWorking() && creep.hasEnergy()) {
            this.work(creep);
        }
        // Else if he needs energy, go get it
        else {
            creep.getEnergy();
        }
    },

    // Repair and build, switch to upgrader if nothing to do
    work: function (creep) {
        if (creep.findAndBuild()) { return; }
        if (creep.findAndRepair()) { return; }
        creep.goUpgradeController();
    },
    bodyParts : generateBodyParts({ WORK: 2, CARRY: 2, MOVE: 2 }),
};
