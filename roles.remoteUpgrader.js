module.exports = {
    run: function (creep) {
        let targetRoom = 'E53S43';

        if (!creep.goIfNotCorrectRoom(targetRoom)) {return};
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
        creep.goUpgradeController();
    },
    bodyParts : generateBodyParts({ WORK: 10, CARRY: 12, MOVE: 11 }),
};
