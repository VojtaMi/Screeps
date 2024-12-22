module.exports = {
    run: function (creep) {
        // Define the target room
        const targetRoom = 'E53S43';

        // Move to the target room if not already there
        if (creep.room.name !== targetRoom) {
            const exitDir = creep.room.findExitTo(targetRoom);
            const exit = creep.pos.findClosestByRange(exitDir);
            creep.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
            return; // Exit function to prevent further actions this tick
        }

        // Prioritize attacking hostile creeps
        const victim = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (victim) {
            if (creep.attack(victim) === ERR_NOT_IN_RANGE) {
                creep.moveTo(victim, { visualizePathStyle: { stroke: '#ff0000' } });
            }
            return; // Stop processing further actions if a victim is found
        }

        // Attack the closest hostile extension or structure
        const target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => structure.structureType === STRUCTURE_EXTENSION ||
             structure.structureType === STRUCTURE_SPAWN
        });
        if (target) {
            if (creep.attack(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, { visualizePathStyle: { stroke: '#ff0000' } });
            }
            return; // Stop processing further actions if a structure is found
        }

        // Default behavior: Patrol or idle at fallback position
        creep.moveTo(27, 41, { visualizePathStyle: { stroke: '#00ff00' } });
    },

    bodyParts: generateBodyParts({ ATTACK: 2, MOVE: 2 }),
};
