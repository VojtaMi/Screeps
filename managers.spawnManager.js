const rolesEmergencyHarvester = require("./roles.emergencyHarvester");
const rolesRemoteBuilder = require("./roles.remoteBuilder");

const roleCounts = {
    emergencyHarvester: 0,
    emergencyCarrier: 1,
    carrier: 1,
    remoteWorker2: 0,
    remoteWorker: 0,
    settler: 1,
    builder: 0,
    upgrader: 1,
    soldier: 1,
    remoteBuilder: 1,
    remoteBuilder2: 1,
    remoteUpgrader: 1,
};

function spawnContainerBasedRoles(spawn, roles) {
    // Handle only roles that use container-based spawning
    const containerBasedRoles = ['harvester', 'remoteCarrier'];

    containerBasedRoles.forEach(roleName => {
        const role = roles[roleName];

        if (role && role.containerLocations && role.containerLocations.length > 0) {
            role.containerLocations.forEach(containerLoc => {
                // Check if a creep is already assigned to this container
                const existingCreep = _.find(Game.creeps, creep =>
                    creep.memory.role === roleName &&
                    creep.memory.containerLocation &&
                    creep.memory.containerLocation.x === containerLoc.x &&
                    creep.memory.containerLocation.y === containerLoc.y &&
                    creep.memory.containerLocation.roomName === containerLoc.roomName
                );

                // If no creep is assigned, spawn a new one
                if (!existingCreep) {
                    const name = `${roleName}${Game.time}`;
                    console.log(`Spawning new ${roleName}: ${name} for container location (${containerLoc.x}, ${containerLoc.y})`);

                    const result = spawn.spawnCreep(
                        role.bodyParts,
                        name,
                        {
                            memory: {
                                role: roleName,
                                containerLocation: containerLoc
                            }
                        }
                    );

                    if (result !== OK) {
                        console.log(`Failed to spawn ${roleName}: ${name} - Error: ${result}`);
                    } else {
                        console.log(`Successfully spawning ${roleName}: ${name}`);
                    }
                }
            });
        }
    });
}


const spawnManager = {
    manageSpawning: function (roles) {

        const spawn = Game.spawns['Spawn1'];

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

        if (spawnContainerBasedRoles(spawn, roles)) {
            return; // Stop further spawning for this spawn
        }

    }
};

module.exports = spawnManager;
