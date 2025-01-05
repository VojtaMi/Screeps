module.exports = {
    containerLocations: [
        { x: 22, y: 13, roomName: 'E53S44' },
        { x: 24, y: 22, roomName: 'E53S44' },
        {x:12, y: 6, roomName: 'E52S44'},
        { x: 25, y: 40, roomName: 'E53S43' },
        { x: 6, y: 8, roomName: 'E53S43' },
    ],

    run: function (creep) {
        targetRoom = creep.memory.containerLocation.roomName;
        creep.goIfNotCorrectRoom(targetRoom);

        if (creep.hasFullEnergy()) {

            creep.refillStructure(STRUCTURE_CONTAINER)
        } 
        else {
            creep.harvestAssignedSource();
        }
    },
    bodyParts : generateBodyParts({ WORK: 6, CARRY: 1, MOVE: 1 }),
    // bodyParts : generateBodyParts({ WORK: 2, CARRY: 1, MOVE: 1 }),
};
