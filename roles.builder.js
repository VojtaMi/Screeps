module.exports = {
    run: function (creep) {
        // If creep is working and has energy, keep working
        if (creep.hasEnergy()) {
            this.work(creep); 
        } 
        // Else if he needs energy, go get it
        else if (creep.needsEnergy()) {
           creep.goToSource()
        } 
    },

    // Function to perform tasks: repair, build, or upgrade
    work: function (creep) {
        // Priority 1: Repair
        const repairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                (structure.structureType === STRUCTURE_ROAD ||
                 structure.structureType === STRUCTURE_CONTAINER ||
                 structure.structureType === STRUCTURE_RAMPART) &&
                structure.hits < structure.hitsMax
        });
        if (repairTarget) {
            if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) {
                creep.moveTo(repairTarget, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
            return;
        }

        // Priority 2: Build
        const buildTarget = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        if (buildTarget) {
            if (creep.build(buildTarget) === ERR_NOT_IN_RANGE) {
                creep.moveTo(buildTarget, { visualizePathStyle: { stroke: '#ffffff' } });
            }
            return;
        }

        creep.memory.role='upgrader';
    },
};
