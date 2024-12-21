const roleCounts = {
    carrier: 1,
    builder: 1,
    upgrader: 1,
};

function spawnHarvesters(spawn, roles) {
    const harvesterRole = roles.harvester;
    harvesterRole.containerLocations.forEach(containerLoc => {

        const existingHarvester = _.find(Game.creeps, creep =>
            creep.memory.role === 'harvester' &&
            creep.memory.containerLocation &&
            creep.memory.containerLocation.x === containerLoc.x &&
            creep.memory.containerLocation.y === containerLoc.y &&
            creep.memory.containerLocation.roomName === containerLoc.roomName
        );

        if (!existingHarvester) {
            const name = `harvester${Game.time}`;

            console.log(`Spawning new harvester: ${name} for container location (${containerLoc.x}, ${containerLoc.y})`);
            const result = spawn.spawnCreep(
                harvesterRole.bodyParts,
                name,
                {
                    memory: {
                        role: 'harvester',
                        containerLocation: containerLoc
                    }
                }
            );

            if (result !== OK) {
                console.log(`Failed to spawn harvester: ${name}`);
                return false;
            }

            return true;
        }
    });
}

const spawnManager = {
    manageSpawning: function (roles) {
        for (const spawnName in Game.spawns) {
            const spawn = Game.spawns[spawnName];

            if (spawn.spawning) continue; // Skip if already spawning

            if (spawnHarvesters(spawn, roles)) {
                break; // Stop further spawning for this spawn
            }

            for (const role in roleCounts) {
                const creeps = _.filter(Game.creeps, creep => creep.memory.role === role);

                if (creeps.length < roleCounts[role]) {
                    const newName = `${role}${Game.time}`;
                    const bodyParts = roles[role].bodyParts;

                    const result = spawn.spawnCreep(bodyParts, newName, { memory: { role: role } });
                    if (result === OK) {
                        console.log(`Spawning new ${role}: ${newName}`);
                    } else {
                        console.log(`Failed to spawn ${role}: ${result}`);
                    }
                    break; // Spawn only one creep per tick per spawn
                }
            }
        }
    }
};

module.exports = spawnManager;
