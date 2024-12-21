module.exports = {
    containerLocations: [
        { x: 22, y: 13, roomName: 'E53S44' },
        { x: 24, y: 22, roomName: 'E53S44' }
    ],

    run: function (creep) {
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
