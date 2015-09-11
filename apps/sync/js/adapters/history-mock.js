/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global IAC,
  SyncEngine
*/

var HistoryHelper = {
  getDataStore: function() {
    return new Promise((resolve, reject) => {
      if (this._placesStore) {
        resolve(this._placesStore);
        return;
      }
      navigator.getDataStores('places').then(stores => {
        this._placesStore = stores[0];
        resolve(this._placesStore);
      });
    });
  },

  lastSyncedStatus: {
    set(rId) {
      window.asyncStorage.setItem('historyLastSyncedRevisionId', rId);
    },
    get() {
      return new Promise((resolve, reject) => {
        window.asyncStorage.getItem('historyLastSyncedRevisionId', (rId) => {
          resolve(rId);
        });
      });
    }
  },

  addPlaces: function(places) {
    return IAC.request('sync-history', {
      method: 'addPlaces',
      args: [places]
    });
  },

  addPlace: function(place) {
    return IAC.request('sync-history', {
      method: 'addPlace',
      args: [place]
    });
  }
};

SyncEngine.DataAdapterClasses.history = {
  _firstTimeSync(kintoCollection) {
    function updateHistoryCollection(list) {
      var historyRecords = list.data;
      var places = [];
      historyRecords.forEach((decryptedRecord) => {
        var record = decryptedRecord.payload;
        if (!record.histUri || !record.visits || !record.visits[0]) {
          return;
        }

        var visits = [];
        record.visits.forEach((elem) => {
          visits.push(elem.date);
        });

        var place = {
          url: record.histUri,
          title: record.title,
          visits: visits,
          fxsyncId: record.id,
          last_modified: decryptedRecord.last_modified
        };
        places.push(place);
      });

      return HistoryHelper.addPlaces(places);
    }

    return kintoCollection.list().then(list => {
      return updateHistoryCollection(list);
    }).then(() => {
      return HistoryHelper.getDataStore().then((placesStore) => {
        HistoryHelper.lastSyncedStatus.set(placesStore.revisionId);
        return Promise.resolve();
      });
    });
  },
  update(kintoCollection) {
    return this._firstTimeSync(kintoCollection);
  },
  handleConflict(local, remote) {
    console.log('HistoryAdapter#handleConflict', local, remote);
    return remote;
  }
};
