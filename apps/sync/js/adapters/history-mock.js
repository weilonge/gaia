/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global IAC,
  SyncEngine
*/

var HistoryHelper = {
  set syncedCollectionModifiedTime(mtime) {
    window.asyncStorage.setItem('LastSyncedStatus::Collection::mtime', mtime);
  },
  get syncedCollectionModifiedTime() {
    return new Promise((resolve, reject) => {
      window.asyncStorage.
      getItem('LastSyncedStatus::Collection::mtime', (mtime) => {
        resolve(mtime);
      });
    });
  },

  addPlaces(places) {
    return IAC.request('sync-history', {
      method: 'addPlaces',
      args: [places]
    });
  },

  addPlace(place) {
    return IAC.request('sync-history', {
      method: 'addPlace',
      args: [place]
    });
  }
};

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
      partialRecords.forEach((decryptedRecord) => {
        var record = decryptedRecord.payload;
        if (!record.histUri || !record.visits || !record.visits[0]) {
          return;
        }

        var visits = [];
        record.visits.forEach((elem) => {
          visits.push(Math.floor(elem.date / 1000));
        });

        var place = {
          url: record.histUri,
          title: record.title,
          visits: visits,
          fxsyncId: record.id
        };
        places.push(place);
      });

      if (places.length === 0) {
        return Promise.resolve(false);
      }

      return HistoryHelper.addPlaces(places).then(() => {
        if (partialRecords.length > 0) {
          HistoryHelper.syncedCollectionModifiedTime =
            partialRecords[0].last_modified;
        }
        return Promise.resolve(false);
      });
    }

    return kintoCollection.list().then(list => {
      return updateHistoryCollection(list);
    });
  },
  update(kintoCollection) {
    return HistoryHelper.syncedCollectionModifiedTime.then((mtime) => {
      return this._fullSync(kintoCollection, mtime);
    });
  },
  handleConflict(conflict) {
    // Because History adapter has not implemented record push yet,
    // handleConflict will always use remote records.
    return Promise.resolve(conflict.remote);
  }
};
