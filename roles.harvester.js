module.exports = {
    sourceAssignments: [
        { x: 10, y: 20, roomName: 'W1N1' },
        { x: 15, y: 25, roomName: 'W1N1' }
    ],

    run: function (creep) {
        if (creep.hasFullEnergy) {
            creep.refillStructure(STRUCTURE_STORAGE)
        } 
        else {
            creep.harvestAssignedSource();
        }
    },
    // bodyParts : generateBodyParts({ WORK: 6, CARRY: 1, MOVE: 1 }),
    bodyParts : generateBodyParts({ WORK: 2, CARRY: 1, MOVE: 1 }),
};
