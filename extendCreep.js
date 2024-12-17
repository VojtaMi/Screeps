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
            this.goToSource();
        }

        // If creep is full, start working
        else {
            this.startWorking();
        }
    };

    Creep.prototype.goToSource = function () {
        const source = this.pos.findClosestByPath(FIND_SOURCES);
        if (source) {
            if (this.harvest(source) === ERR_NOT_IN_RANGE) {
                this.moveTo(source, { visualizePathStyle: { stroke: '#ffaa00' } });
            }
        }
    };

    Creep.prototype.transferEnergyTo = function (target) {
        if (target) {
            if (this.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                this.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
            }
        }
    };

    Creep.prototype.moveAndUpgrade = function () {
        const controller = this.room.controller;
        if (controller && this.upgradeController(controller) === ERR_NOT_IN_RANGE) {
            this.moveTo(controller, { visualizePathStyle: { stroke: '#ffffff' } });
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
                this.moveTo(target, { visualizePathStyle: { stroke: '#ffffff' } });
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
        return this.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: structure => {
                return (structure.structureType === STRUCTURE_SPAWN ||
                    structure.structureType === STRUCTURE_EXTENSION) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
        });
    };
};
