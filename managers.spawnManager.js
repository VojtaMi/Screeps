const roleCounts = {
    harvester: 1,
    upgrader: 3,
    builder: 7,
};

const spawnManager = {
    manageSpawning: function () {
        const spawn = Game.spawns['Spawn1']; // Replace with your spawn name
        const bodyParts = [
            ...Array(4).fill(WORK),  // 5 WORK parts
            ...Array(2).fill(CARRY), // 3 CARRY parts
            ...Array(2).fill(MOVE)   // 2 MOVE parts
        ];

        for (const role in roleCounts) {
            const creeps = _.filter(Game.creeps, creep => creep.memory.role === role);



if (creeps.length < roleCounts[role]) {
    const newName = `${role}${Game.time}`;
    if (spawn.spawnCreep(bodyParts, newName, { memory: { role: role } }) === OK) {
        console.log(`Spawning new ${role}: ${newName}`);
    }
    break; // Only spawn one creep per tick
}
        }
    }
};

module.exports = spawnManager;
