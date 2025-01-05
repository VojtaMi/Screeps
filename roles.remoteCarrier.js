module.exports = {
    containerLocations: [
        { x: 12, y: 6, roomName: 'E52S44' },
        { x: 25, y: 40, roomName: 'E53S43' },
        // { x: 6, y: 8, roomName: 'E53S43' },
    ],
    run: function (creep) {
        let homeRoom = 'E53S44';
        let targetRoom = creep.memory.containerLocation.roomName;

        // If creep has delivered energy at home, move to target room
        if (!creep.hasEnergy() && creep.isInRoom(homeRoom)) {
            creep.goIfNotCorrectRoom(targetRoom);
        }

        // if he has energy in home room, refill storage
        else if (creep.hasEnergy() && creep.isInRoom(homeRoom)){
            creep.refillStructure(STRUCTURE_STORAGE);
        }

        // if he doesnt have full capacity, get energy from the target room container
        else if (creep.needsEnergy() && creep.isInRoom(targetRoom)){
            if (creep.collectDroppedEnergy()) {return;}
            creep.withdrawAssignedContainer();
        }

        // else he has full energy and needs to go home
        else {
            creep.goIfNotCorrectRoom(homeRoom);
        }


    },

    bodyParts: generateBodyParts({ CARRY: 22, MOVE: 11 }),
};
