module.exports = function () {
    // Properties
    Creep.prototype.needsEnergy = function () {
        return this.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
    };

    Creep.prototype.hasFullEnergy = function () {
        return this.store.getFreeCapacity(RESOURCE_ENERGY) === 0;
    };

    Creep.prototype.hasEnergy = function () {
        return this.store[RESOURCE_ENERGY] > 0;
    };

    Creep.prototype.isAtFlag = function (flagName, range = 1) {
        const flag = Game.flags[flagName];
        if (!flag) {
            return false; // Flag doesn't exist
        }
        return this.pos.inRangeTo(flag.pos, range); // Check range dynamically
    };

    // Working State Management
    Creep.prototype.isWorking = function () {
        return this.memory.working === true;
    };

    Creep.prototype.startWorking = function () {
        this.memory.working = true;
    };

    Creep.prototype.stopWorking = function () { 
        this.memory.working = false;
    };


    // Actions

    Creep.prototype.reFuel = function () {
         // Else if he needs energy, go get it
         if (this.needsEnergy()) {
            this.stopWorking();
            if (this.memory.role === 'harvester'){
                this.goToSource();
                return;
            }
            if (!this.goToFuelTank()){
                this.goToSource();
            }
        }

        // If creep is full, start working
        else {
            this.startWorking();
        }
    };

    Creep.prototype.goToFuelTank = function () {
        let fuelTank = this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (structure) => 
                (structure.structureType === STRUCTURE_CONTAINER || 
                 structure.structureType === STRUCTURE_STORAGE) &&
                structure.store[RESOURCE_ENERGY] > 100
        });
        if (fuelTank) {
            if (this.withdraw(fuelTank, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                this.moveTo(fuelTank);
            }
            return true;
        }
        return false;
    };

    Creep.prototype.goToSource = function () {
        let source = this.pos.findClosestByPath(FIND_SOURCES, {
            filter: s => s.energy > 0 // Filter out drained sources
        });
        if (source) {
            if (this.harvest(source) === ERR_NOT_IN_RANGE) {
                this.moveTo(source);
            }
            return true;
        }
        return false;
    };

    Creep.prototype.transferEnergyTo = function (target) {
        if (target) {
            if (this.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                this.moveTo(target);
                
            }
        }
    };

    Creep.prototype.moveAndUpgrade = function () {
        const controller = this.room.controller;
        if (controller && this.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            this.moveTo(controller);
        }
    };

    Creep.prototype.findRepairTarget = function () {
        return this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure =>
                (structure.structureType === STRUCTURE_ROAD ||
                    structure.structureType === STRUCTURE_CONTAINER ||
                    structure.structureType === STRUCTURE_RAMPART) &&
                structure.hits < structure.hitsMax
        });
    };

    Creep.prototype.findAndRepair = function () {
        const target = this.findRepairTarget();
        if (target) {
            if (this.repair(target) === ERR_NOT_IN_RANGE) {
                this.moveTo(target, { visualizePathStyle: { stroke: '#ffaa00' } });
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
    
    



    // Methods

    /**
   * Finds the closest refuelable structure (e.g., spawn or extension).
   * @returns {Structure | null} The closest refuelable structure or null if none are found.
   */
    Creep.prototype.findRefuelStructure = function () {
        // Find extensions or spawns with free capacity
        let target = this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure => {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                    structure.structureType === STRUCTURE_SPAWN) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
    
        // If no extensions or spawns are found, check for towers
        if (!target) {
            target = this.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: structure => {
                    return structure.structureType === STRUCTURE_TOWER &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }
    
        // If no towers are found, check for containers
        if (!target) {
            target = this.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: structure => {
                    return structure.structureType === STRUCTURE_CONTAINER &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });
        }
    
        return target;
    };

       /**
     * Generates a body part array based on a dictionary.
     * @param {Object} partsDict - A dictionary where the keys are body part types (WORK, CARRY, MOVE, etc.)
     *                             and the values are the count for each part.
     * @returns {Array} - An array of body parts.
     */
       global.generateBodyParts = function (partsDict) {
        const bodyParts = [];
        for (const [part, count] of Object.entries(partsDict)) {
            bodyParts.push(...Array(count).fill(part));
        }
        return bodyParts;
    };
    
};
