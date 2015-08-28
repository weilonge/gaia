'use strict';

/* exported HistoryAdapter */

var HistoryAdapter = {
  update: function(kintoCollection) {
    kintoCollection.list().then(list => {
      console.log('history adapter update function called with this local ' +
          'copy of the remote data:', list);
    });
  },
  handleConflict: function(local, remote) {
    console.log('history adapter handleConflict function called with:',
        local, remote);
    return local;
  }
};
