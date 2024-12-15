const roleCounts = {
    harvester: 1,
    upgrader: 2,
    builder: 5,
};

const spawnManager = {
    manageSpawning: function () {
        const spawn = Game.spawns['Spawn1']; // Replace with your spawn name

        for (const role in roleCounts) {
            const creeps = _.filter(Game.creeps, creep => creep.memory.role === role);

            if (creeps.length < roleCounts[role]) {
                const newName = `${role}${Game.time}`;
                if (spawn.spawnCreep([WORK, CARRY, MOVE], newName, { memory: { role: role } }) === OK) {
                    console.log(`Spawning new ${role}: ${newName}`);
                }
                break; // Only spawn one creep per tick
            }
        }
    }
};

module.exports = spawnManager;
