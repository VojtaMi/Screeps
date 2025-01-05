module.exports = {
    run: function (creep) {
        const targetRoom = 'E53S43';

        if (!creep.isInRoom(targetRoom)) {
            creep.goToRoom(targetRoom);
        }
        else {
            creep.stepIfOnPortal();
            // If creep is working and has energy, keep working
            if (creep.isWorking() && creep.hasEnergy()) {
                this.work(creep);
            }
            // Else if he needs energy, go get it
            else {
                this.harvest(creep);
            }

        }
    },

    // Repair and build, switch to upgrader if nothing to do
    work: function (creep) {
        if (creep.findAndBuild()) { return; }
        if (creep.findAndRepair()) { return; }
        creep.goUpgradeController()
    },

    harvest: function (creep) {
        if (!creep.hasFullEnergy()) {
            creep.stopWorking();
            // Find the source adjacent to the container
            const source = creep.pos.findClosestByRange(FIND_SOURCES);

            if (source) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source)
                };
            }

        }
        else {
            creep.startWorking();
        }

    },

    bodyParts: generateBodyParts({ WORK: 6, CARRY: 6, MOVE: 12 }),
};
