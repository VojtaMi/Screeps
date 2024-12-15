const creepActions = {
    /**
     * Direct a creep to the closest source and harvest it.
     * @param {Creep} creep - The creep to perform the action.
     */
    goToSource(creep) {
        const source = creep.pos.findClosestByPath(FIND_SOURCES);
        if (source) {
            if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    },
}
module.exports = creepActions;