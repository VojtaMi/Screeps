const sourceAssignments = [
    { x: 23, y: 14, roomName: 'E53S44' }, // Source 1
    { x: 25, y: 23, roomName: 'E53S44' }  // Source 2
];

module.exports = {
    run: function (creep) {
        if (creep.hasFullEnergy) {
            creep.refillStructure(STRUCTURE_STORAGE)
        } 
        else {
            creep.harvestAssignedSource();
        }
    },
    bodyParts : generateBodyParts({ WORK: 6, CARRY: 1, MOVE: 1 }),
};
