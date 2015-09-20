/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global IAC,
  SyncEngine
*/

const HISTORY_COLLECTION_MTIME = 'LastSyncedStatus::HistoryCollection::mtime';

var HistoryHelper = (() => {
  function setSyncedCollectionMtime(mtime) {
    return new Promise(resolve => {
      window.asyncStorage.setItem(HISTORY_COLLECTION_MTIME, mtime, resolve);
    });
  }

  function getSyncedCollectionMtime() {
    return new Promise(resolve => {
      window.asyncStorage.getItem(HISTORY_COLLECTION_MTIME, resolve);
    });
  }

  function addPlaces(places) {
    return IAC.request('sync-history', {
      method: 'addPlaces',
      args: [places]
    });
  }

  return {
    setSyncedCollectionMtime: setSyncedCollectionMtime,
    getSyncedCollectionMtime: getSyncedCollectionMtime,
    addPlaces: addPlaces
  };
})();

SyncEngine.DataAdapterClasses.history = {
  _fullSync(kintoCollection, lastModifiedTime) {
    function updateHistoryCollection(list) {
      var historyRecords = list.data;
      var places = [];
      var i;
      for (i = 0; i < historyRecords.length; i++) {
        if (historyRecords[i].last_modified <= lastModifiedTime) {
          break;
        }
      }
      var partialRecords = historyRecords.slice(0, i);
      if (partialRecords.length === 0) {
        return Promise.resolve(false);
      }
      partialRecords.forEach(record => {
        var payload = record.payload;
        if (!payload.histUri || !payload.visits || !payload.visits.length) {
          console.warn('Incorrect payload? ', JSON.stringify(payload)); // XXX
          return;
        }

        places.push({
          url: payload.histUri,
          title: payload.title,
          visits: payload.visits.map(elem => Math.floor(elem.date / 1000)),
          fxsyncId: payload.id
        });
      });

      if (places.length === 0) {
        return Promise.resolve(false);
      }

      return HistoryHelper.addPlaces(places).then(() => {
        var latestMtime = partialRecords[0].last_modified;
        return HistoryHelper.setSyncedCollectionMtime(latestMtime).then(() => {
          Promise.resolve(false);
        });
      });
    }

    return kintoCollection.list().then(updateHistoryCollection);
  },
  update(kintoCollection) {
    return HistoryHelper.getSyncedCollectionMtime().then(mtime => {
      return this._fullSync(kintoCollection, mtime);
    });
  },
  handleConflict(conflict) {
    // Because History adapter has not implemented record push yet,
    // handleConflict will always use remote records.
    return Promise.resolve(conflict.remote);
  }
};
