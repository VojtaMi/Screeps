module.exports = {
    run: function (creep) {
        // If creep is working and has energy, keep working
        if (creep.hasEnergy()) {
            this.work(creep); 
        } 
        // Else if he needs energy, go get it
        else if (creep.needsEnergy()) {
           creep.goToSource()
        } 
    },

    // Repair and build, switch to upgrader if nothing to do
    work: function (creep) {
        if (creep.repair()) {return;}
        if (creep.build()) {return;}
        creep.memory.role='upgrader';
    },
};
