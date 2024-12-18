const roles = {
    harvester: require('roles.harvester'),
    upgrader: require('roles.upgrader'),
    builder: require('roles.builder'),
    carrier: require('roles.carrier')
};

const roleCounts = {
    carrier: 1,
    builder: 4,
    upgrader: 2,
};

function spawnHarvesters(spawn) {
    const harvesterRole = roles.harvester;
    console.log('Body Parts:', JSON.stringify(harvesterRole.bodyParts));

    if (!Array.isArray(harvesterRole.sourceAssignments)) {
        console.log('Invalid sourceAssignments:', harvesterRole.sourceAssignments);
        return;
    }

    harvesterRole.sourceAssignments.forEach(source => {
        if (!source || typeof source.x !== 'number' || typeof source.y !== 'number' || !source.roomName) {
            console.log(`Invalid source location: ${JSON.stringify(source)}`);
            return;
        }

        const existingHarvester = _.find(Game.creeps, creep =>
            creep.memory.role === 'harvester' &&
            creep.memory.sourceLocation &&
            creep.memory.sourceLocation.x === source.x &&
            creep.memory.sourceLocation.y === source.y &&
            creep.memory.sourceLocation.roomName === source.roomName
        );

        if (!existingHarvester) {
            const name = `harvester${Game.time}`;

            console.log(`Spawning new harvester: ${name} for source (${source.x}, ${source.y})`);
            const result = spawn.spawnCreep(
                harvesterRole.bodyParts,
                name,
                {
                    memory: {
                        role: 'harvester',
                        sourceLocation: source
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
    manageSpawning: function () {
        for (const spawnName in Game.spawns) {
            const spawn = Game.spawns[spawnName];

            if (spawn.spawning) continue; // Skip if already spawning

            if (spawnHarvesters(spawn)) {
                break; // Stop further spawning for this spawn
            }

            for (const role in roleCounts) {
                const creeps = _.filter(Game.creeps, creep => creep.memory.role === role);

                if (creeps.length < roleCounts[role]) {
                    const newName = `${role}${Game.time}`;
                    const bodyParts = roles[role].bodyParts;

                    const result = spawn.spawnCreep(bodyParts, newName, { memory: { role: role } });
                    console.log('Spawn Attempt Details:');
                    console.log(`Body Parts: ${JSON.stringify(bodyParts)}`);
                    console.log(`Name: ${newName}`);
                    console.log(`Memory: ${JSON.stringify({ role: role })}`);
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
