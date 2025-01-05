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

        // Find all damaged structures
        const damagedStructures = tower.room.find(FIND_STRUCTURES, {
            filter: structure => structure.hits < structure.hitsMax && structure.hits < 1000000
        });

        // Sort damaged structures by hits in ascending order
        damagedStructures.sort((a, b) => a.hits - b.hits);

        // Repair the structure with the lowest hits
        if (damagedStructures.length > 0) {
            tower.repair(damagedStructures[0]);
        }
    }
};

module.exports = towerLogic;
