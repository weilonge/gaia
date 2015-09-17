/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global IAC,
  SyncEngine
*/

var HistoryHelper = {
  getDataStore() {
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

  set syncedDataStoreRevisionId(rId) {
    window.asyncStorage.setItem('LastSyncedStatus::DataStore::Rid', rId);
  },
  get syncedDataStoreRevisionId() {
    return new Promise((resolve, reject) => {
      window.asyncStorage.
      getItem('LastSyncedStatus::DataStore::Rid', (rId) => {
        resolve(rId);
      });
    });
  },
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
  updateLastSyncedStatus() {
    this.getDataStore().then((placesStore) => {
      this.syncedDataStoreRevisionId = placesStore.revisionId;
    });
  },

  syncStore(revisionId) {
    return new Promise((resolve, reject) => {
      var cursor, tasks = [];
      this.getDataStore().then(() => {
        cursor = this._placesStore.sync(revisionId);
        runNextTask(cursor);
      });

      function runNextTask(cursor) {
       cursor.next().then(function(task) {
         manageTask(cursor, task);
       });
      }

      function manageTask(cursor, task) {
        tasks.push(task);
        if (task.operation == 'done') {
          // Finished adding contacts!
          resolve(tasks);
          return;
        }
        runNextTask(cursor);
      }
    });
  },

  retrieveRecord(url) {
    return this.getDataStore().then((placesStore) => {
      return placesStore.get(url);
    });
  },

  retrieveFxSyncId(url) {
    return this.retrieveRecord(url).then((placeRecord) => {
      return Promise.resolve(placeRecord ? placeRecord.fxsyncId : null);
    });
  },

  updateFxSyncId(url, fxsyncId) {
    return this.retrieveRecord(url).then((placeRecord) => {
      placeRecord.fxsyncId = fxsyncId;
      return this._placesStore.put(placeRecord, url);
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
      console.log(partialRecords);
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
          console.log(partialRecords[0].last_modified);
        }
        return Promise.resolve(false);
      });
    }

    return kintoCollection.list().then(list => {
      return updateHistoryCollection(list);
    });
  },
  update(kintoCollection) {
    var syncQueueToSync;

    /* Step 1:
      Retrieve the changes in Places Data Store by using DataStore.sync() and
      cache the results to SyncQueue.
    */
    return HistoryHelper.syncedDataStoreRevisionId.then((lastRevisionId) => {
      return HistoryHelper.syncStore(lastRevisionId);
    }).then((tasks) => {
      syncQueueToSync = tasks;
    })

    /* Step 2:
      Write History Collection records to PlacesDS.
    */
    .then(() => {
      return HistoryHelper.syncedCollectionModifiedTime;
    })
    .then((mtime) => {
      return this._fullSync(kintoCollection, mtime);
    })

    /* Step 3:
      Update FxSync ID for records in SyncQueueToSync for updating records to
      History Collection. There will be two cases for these records:
        1. No FxSync ID exists, and it means it's a new record.
        2. FxSync ID exists, and it means the record should be updated to the
           record with the same ID.

      Besides, case 2 will only happen at the first time sync because the
      records from PlacesDS are without FxSync ID before writing the data from
      FxSync. At the following sync, every record in PlacesDS has their own
      FxSync ID.
    */
    .then(() => {
      return Promise.all(syncQueueToSync.map((syncingItem, index) => {
        var url = syncingItem.id;
        if (!url || syncingItem.data.fxsyncId) {
          return Promise.resolve();
        }
        return HistoryHelper.retrieveFxSyncId(url).then((fxsyncId) => {
          syncingItem.data.fxsyncId = fxsyncId;
        });
      }));
    })

    /* Step 4:
      Push all waiting-for-syncing records to FxSync and update last synced
      revision id.
    */
    .then(() => {
      console.log(syncQueueToSync);
      var promises = [];
      syncQueueToSync.forEach(item => {
        if (!item.id || !item.data) {
          return;
        }
        if (item.data.fxsyncId) {
          // update the record.
          //var editedRecord = {
          //  id: item.id,
          //  payload: {
          //    title: item.data.title,
          //    histUri: item.data.url,
          //    visits: []
          //  }
          //};
          //kintoCollection.update(editedRecord).then(result => {
          //
          //});
        } else {
          // create a new record.
          var newRecord = {
            payload: {
              title: item.data.title,
              id: null,
              histUri: item.data.url,
              visits: []
            }
          };

          // Visit Type Constant Definition:
          // https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/
          //   Reference/Interface/nsINavHistoryService#Constants
          item.data.visits.forEach(visit => {
            newRecord.payload.visits.push({
              date: visit * 1000,
              type: 2
            });
          });
          kintoCollection.create(newRecord).then(result => {
            // write fxsyncId in result to PlacesDS.
            var fxsyncId = result.data.id;
            var p = HistoryHelper.updateFxSyncId(item.data.url, fxsyncId)
              .then(() => {
              result.data.payload.id = fxsyncId;
              return kintoCollection.update(result.data);
            });
            promises.push(p);
          });
        }
      });
      return Promise.all(promises).then(() => {
        HistoryHelper.updateLastSyncedStatus();
      });
    });
  },
  handleConflict(conflict) {
    console.log('HistoryAdapter#handleConflict', conflict);
    return Promise.resolve(conflict.remote);
  }
};
