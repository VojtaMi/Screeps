module.exports = {
    run: function(creep) {
        // If the creep is carrying energy and not full
        if (creep.store.getFreeCapacity() > 0) {
            // Find the closest energy source
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                // Attempt to harvest the energy source
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    // Move closer to the source if not in range
                    creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
                }
            }
        } else {
            // Creep is full, transfer energy to the spawn or extensions
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: structure => {
                    return (
                        (structure.structureType === STRUCTURE_SPAWN ||
                            structure.structureType === STRUCTURE_EXTENSION) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    );
                }
            });

            if (target) {
                // Transfer energy to the target
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    // Move closer to the target if not in range
                    creep.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
                }
            }
        }
    },
    bodyParts : generateBodyParts({ WORK: 1, CARRY: 1, MOVE: 1 }),
};
