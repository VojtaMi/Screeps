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
                this.refuelFrom(STRUCTURE_STORAGE);
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
            let fuelTank = this.findFuelTank(structureType, 100);
            if (fuelTank) {
                this.withdrawFuelTank(fuelTank)
            }
        }

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
            if (!target){
                target = this.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: structure =>
                        (structure.structureType === STRUCTURE_RAMPART ||
                            structure.structureType === STRUCTURE_WALL) &&
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
                    this.moveTo(target);
                }
                return true; // Successfully found a target and acted
            }
            return false; // No valid target found
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
    
};
