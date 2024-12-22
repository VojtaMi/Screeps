module.exports = {
    run: function (creep) {
        let buildInRoom = 'E52S44';
        let sourceRoom = 'E53S44'

        if (creep.isInRoom(buildInRoom) && !creep.hasEnergy()){
            creep.goToRoom(sourceRoom)
        }
        else if (creep.isInRoom(sourceRoom) && creep.needsEnergy()){
            creep.getEnergy();
        }
        else if (creep.isInRoom(sourceRoom)){
            creep.goToRoom(buildInRoom);
        }
        else{
            creep.stepIfOnPortal();
            this.work(creep);
        }
    },

    
    work: function (creep) {
        if (creep.findAndBuild()) { return; }
        if (creep.findAndRepair()) { return; }
    },
    bodyParts : generateBodyParts({ WORK: 4, CARRY: 8, MOVE: 6 }),
};
