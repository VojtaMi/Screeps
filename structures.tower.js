const towerLogic = {
    run: function (tower) {
        // Attack hostile creeps
        const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (closestHostile) {
            tower.attack(closestHostile);
            return; // Exit after attacking
        }

        // Heal damaged creeps
        const closestDamagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
            filter: creep => creep.hits < creep.hitsMax
        });
        if (closestDamagedCreep) {
            tower.heal(closestDamagedCreep);
            return; // Exit after healing
        }

        // Repair damaged structures
        const closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: structure => structure.hits < structure.hitsMax &&
                structure.structureType !== STRUCTURE_WALL // Exclude walls unless desired
        });
        if (closestDamagedStructure) {
            tower.repair(closestDamagedStructure);
        }
    }
};

module.exports = towerLogic;
