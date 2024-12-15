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
    

    // Actions
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
