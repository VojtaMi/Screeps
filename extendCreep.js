module.exports = function () {
    /* Section: Energy Management */{
        Creep.prototype.needsEnergy = function () {
            return this.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        };

        Creep.prototype.hasFullEnergy = function () {
            return this.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
        };

        Creep.prototype.hasEnergy = function () {
            return this.store[RESOURCE_ENERGY] > 0;
        };

        Creep.prototype.getEnergy = function () {
            if (this.needsEnergy()) {
                this.stopWorking();
                if (!this.refuelFrom(STRUCTURE_STORAGE)) {
                    this.refuelFrom(STRUCTURE_CONTAINER);
                }
            } else {
                this.startWorking();
            }
        };

        Creep.prototype.findFuelTank = function (structureType, minEnergy) {
            return this.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) =>
                    (structure.structureType === structureType) &&
                    structure.store[RESOURCE_ENERGY] > minEnergy
            });

        }

        Creep.prototype.withdrawFuelTank = function (fuelTank) {
            if (this.withdraw(fuelTank, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                this.moveTo(fuelTank);
            }
        }

        Creep.prototype.refuelFrom = function (structureType) {
            let fuelTank = this.findFuelTank(structureType, 400);
            if (fuelTank) {
                this.withdrawFuelTank(fuelTank);
                return true;
            }
            return false;
        }

        Creep.prototype.collectDroppedEnergy = function () {
            // Combine tombstones and dropped resources into one list
            const targets = this.room.find(FIND_TOMBSTONES)
                .filter(tomb => tomb.store[RESOURCE_ENERGY] > 0)
                .concat(this.room.find(FIND_DROPPED_RESOURCES)
                    .filter(resource => resource.resourceType === RESOURCE_ENERGY));

            // Find the closest target from the combined list
            const target = this.pos.findClosestByPath(targets);

            if (target) {
                if (target instanceof Resource) {
                    // Pickup dropped energy
                    if (this.pickup(target) === ERR_NOT_IN_RANGE) {
                        this.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                } else if (target instanceof Tombstone) {
                    // Withdraw energy from the tombstone
                    if (this.withdraw(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        this.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
                    }
                }
                return true; // Successfully found a target to collect energy
            }

            // No energy found
            return false;
        };




        // Section: Working State Management{
    }
    /* Section: Working State Management */{
        Creep.prototype.isWorking = function () {
            return this.memory.working === true;
        };

        Creep.prototype.startWorking = function () {
            this.memory.working = true;
        };

        Creep.prototype.stopWorking = function () {
            this.memory.working = false;
        };
    }
    /* Section: Construction And Repairs */{
        Creep.prototype.findRepairTarget = function () {
            target = this.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: structure =>
                    (structure.structureType === STRUCTURE_ROAD ||
                        structure.structureType === STRUCTURE_CONTAINER) &&
                    structure.hits < structure.hitsMax
            });
            if (!target) {
                target = this.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: structure =>
                        structure.structureType === STRUCTURE_RAMPART &&
                        structure.hits < structure.hitsMax
                });
            }
            if (!target) {
                target = this.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: structure =>
                        structure.structureType === STRUCTURE_WALL &&
                        structure.hits < structure.hitsMax
                });
            }
            return target;
        };

        Creep.prototype.findAndRepair = function () {
            const target = this.findRepairTarget();
            if (target) {
                if (this.repair(target) === ERR_NOT_IN_RANGE) {
                    this.moveTo(target);
                }
                return true; // Found and initiated repair
            }
            return false; // No targets found
        };

        // Find closest construction site
        Creep.prototype.findBuildTarget = function () {
            return this.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
        };

        Creep.prototype.findAndBuild = function () {
            const target = this.findBuildTarget();
            if (target) {
                if (this.build(target) === ERR_NOT_IN_RANGE) {
                    this.moveTo(target);
                }
                return true; // Found and initiated build
            }
            return false; // No targets found
        };
    }

    Creep.prototype.stepIfOnPortal = function () {
        if (this.pos.x === 0) {
            this.move(RIGHT);
        } else if (this.pos.x === 49) {
            this.move(LEFT);
        } else if (this.pos.y === 0) {
            this.move(BOTTOM);
        } else if (this.pos.y === 49) {
            this.move(TOP);
        }
    }
    Creep.prototype.goToRoom = function (targetRoom) {
        // Find the exit to the target room and move to it
        const exitDir = this.room.findExitTo(targetRoom);
        const exit = this.pos.findClosestByRange(exitDir);
        this.moveTo(exit, { visualizePathStyle: { stroke: '#ffaa00' } });
    };


    Creep.prototype.isInRoom = function (room) {
        return (this.room.name === room);
    }

    Creep.prototype.goIfNotCorrectRoom = function (targetRoom) {
        if (!this.isInRoom(targetRoom)) {
            this.goToRoom(targetRoom);
            return false;
        }
        else {
            this.stepIfOnPortal();
            return true;
        }
    }


    /* Section: Flag Management */{
        Creep.prototype.isAtFlag = function (flagName, range = 1) {
            const flag = Game.flags[flagName];
            if (!flag) {
                return false; // Flag doesn't exist
            }
            return this.pos.inRangeTo(flag.pos, range); // Check range dynamically
        };

        Creep.prototype.goToFlag = function (flagName, range = 0, pathStyle = { stroke: '#ffffff' }) {
            const flag = Game.flags[flagName];
            if (flag) {
                if (!this.pos.inRangeTo(flag.pos, range)) {
                    this.moveTo(flag, { visualizePathStyle: pathStyle });
                }
            } else {
                this.say(`No flag: ${flagName}`);
            }
        };

    }
    /* Section: Controller and Upgrading*/{
        Creep.prototype.goUpgradeController = function () {
            const controller = this.room.controller;
            if (controller && this.upgradeController(controller) === ERR_NOT_IN_RANGE) {
                this.moveTo(controller);
            }
        };
    }
    /* Section: Resource Managment */{
        Creep.prototype.harvestAssignedSource = function () {
            // Get the container position from memory
            const targetPos = new RoomPosition(
                this.memory.containerLocation.x,
                this.memory.containerLocation.y,
                this.memory.containerLocation.roomName
            );

            // Check if the creep is at the container position
            if (!this.pos.isEqualTo(targetPos)) {
                // Move to the container position if not already there
                this.moveTo(targetPos);
                return;
            }

            // Find the source adjacent to the container
            const source = targetPos.findClosestByRange(FIND_SOURCES);

            if (source) {
                // Try to harvest the source
                this.harvest(source);
            }
        };


        Creep.prototype.transferEnergyTo = function (target) {
            if (target) {
                if (this.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    this.moveTo(target);

                }
            }
        };

        Creep.prototype.refillStructure = function (structureType) {
            const target = this.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) =>
                    s.structureType === structureType &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0 // Works for all structures
            });

            if (target) {
                if (this.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    this.moveTo(target,
                        {
                            reusePath: 10, // Cache path for 10 ticks
                            ignoreCreeps: true // Allow pathfinding through other creeps);
                        }
                    );
                }
                return true; // Successfully found a target and acted
            }
            return false; // No valid target found
        };

        Creep.prototype.withdrawAssignedContainer = function () {
            // Get the container position from memory
            const targetPos = new RoomPosition(
                this.memory.containerLocation.x,
                this.memory.containerLocation.y,
                this.memory.containerLocation.roomName
            );

            // Find the container at the target position
            const container = targetPos.lookFor(LOOK_STRUCTURES).find(
                structure => structure.structureType === STRUCTURE_CONTAINER
            );

            if (!container) {
                console.log(`${this.name}: No container found at assigned position.`);
                return;
            }

            // Attempt to withdraw from the container
            if (this.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                // Use cached path if available
                this.moveTo(container);
            }

            // Follow the cached path
            const moveResult = this.moveByPath(this.memory.cachedPath);

            // Clear the cache if the path becomes invalid
            if (moveResult === ERR_INVALID_ARGS || moveResult === ERR_NOT_FOUND) {
                delete this.memory.cachedPath;
            }
        }
    };


}
    /* Section: Utility */{
    global.generateBodyParts = function (partsDict) {
        const bodyParts = [];
        for (const [part, count] of Object.entries(partsDict)) {
            bodyParts.push(...Array(count).fill(global[part]));
        }
        return bodyParts;
    };
}
