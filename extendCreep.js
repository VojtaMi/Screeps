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
};
