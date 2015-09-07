'use strict';

/* exported ExampleAdapter */

var ExampleAdapter = {
  update: function(kintoCollection) {
    kintoCollection.list().then(list => {
      for(var i=0; i<list.data.length; i++) {
        console.log('history entry:', i, list.data[i].payload);
      }
    });
  },
  handleConflict: function(conflict) {
    console.log('example adapter handleConflict function called with:',
                conflict.local,
                conflict.remote);
    return conflict.local;
  }
};
