module.exports = {
    run: function (creep) {
        const targetRoom = 'E52S44';

        // Move to the target room if not already there
        if (creep.room.name !== targetRoom) {
            const exitDir = creep.room.findExitTo(targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
            console.log(`${creep.name} moving to room ${targetRoom}`);
            return; // Exit function to prevent further actions this tick
        }
        creep.stepIfOnPortal();

        // Find the room's controller
        const controller = creep.room.controller;
        if (controller) {
            // Attempt to claim the controller
            let claimResult = creep.claimController(controller);
            if (claimResult === ERR_NOT_IN_RANGE) {
                creep.moveTo(controller, { visualizePathStyle: { stroke: '#ff0000' } });
                console.log(`${creep.name} moving to controller in ${targetRoom}`);
            } else if (claimResult === ERR_GCL_NOT_ENOUGH || claimResult === ERR_INVALID_TARGET) {
                // Fallback to reservation if claiming is not possible
                const reserveResult = creep.reserveController(controller);
                if (reserveResult === ERR_NOT_IN_RANGE) {
                    creep.moveTo(controller, { visualizePathStyle: { stroke: '#00ff00' } });
                    console.log(`${creep.name} moving to reserve controller in ${targetRoom}`);
                } else if (reserveResult !== OK) {
                    console.log(`${creep.name} failed to reserve controller: ${reserveResult}`);
                }
            } else if (claimResult !== OK) {
                console.log(`${creep.name} failed to claim controller: ${claimResult}`);
            }
        } else {
            console.log(`${creep.name} no controller found in room ${targetRoom}`);
        }
    },

    bodyParts: generateBodyParts({ CLAIM: 1, MOVE: 1 }),
};
