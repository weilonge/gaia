/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
  History Data Adapter

    The feature of History adapter is to retrieve History records from FxSync
  Service and merge to Places DataStore which has the same functionality, and
  the adapter is based on SyncEngine's design to handle 'update' and
  'handleConflict' request. History Data Adapter provides Read-Only version
  currently, and the basic ideas are included:
  - Traverse all records from History Collection (HC).
  - Add a new or existed place to Places DataStore (PDS).
    - Convert the records from HC to PDS format.
    - Merge a new record and the existed one then write to PDS.
  - Remove an existed place when receiving a "deleted: true" record.
**/

'use strict';

/* global
  asyncStorage,
  DataAdapters,
  ERROR_SYNC_APP_RACE_CONDITION,
  LazyLoader
*/

const HISTORY_COLLECTION_MTIME = '::collections::history::mtime';
const HISTORY_LAST_REVISIONID = '::collections::history::revisionid';
const HISTORY_SYNCTOID_PREFIX = '::synctoid::history::';

var HistoryHelper = (() => {
  var _store;
  function _ensureStore() {
    if (_store) {
      return Promise.resolve(_store);
    }
    return navigator.getDataStores('places').then(stores => {
      _store = stores[0];
      return _store;
    });
  }

  /* SyncedCollectionMTime is the time of the last successful sync run.
   * Subsequent sync runs will not check any records from the Kinto collection
   * that have not been modified since then. This value is stored separately for
   * each user (userid uniquely defines the FxSync account we're syncing with).
   */
  function setSyncedCollectionMtime(mtime, userid) {
    return new Promise(resolve => {
      asyncStorage.setItem(userid + HISTORY_COLLECTION_MTIME, mtime, resolve);
    });
  }

  function removeSyncedCollectionMtime(userid) {
    return new Promise(resolve => {
      asyncStorage.removeItem(userid + HISTORY_COLLECTION_MTIME, resolve);
    });
  }

  function getSyncedCollectionMtime(userid) {
    return new Promise(resolve => {
      asyncStorage.getItem(userid + HISTORY_COLLECTION_MTIME, resolve);
    });
  }

  /* LastRevisionId is the revisionId the DataStore had at the beginning of the
   * last sync run. Even though there is only one DataStore, it is stored once
   * for each userid, because a sync run only syncs with the FxSync account of
   * the currently logged in user.
   */
  function getLastRevisionId(userid) {
    return new Promise(resolve => {
      asyncStorage.getItem(userid + HISTORY_LAST_REVISIONID, resolve);
    });
  }

  function setLastRevisionId(lastRevisionId, userid) {
    return new Promise(resolve => {
      asyncStorage.setItem(userid + HISTORY_LAST_REVISIONID, lastRevisionId,
          resolve);
    });
  }

  function removeLastRevisionId(userid) {
    return new Promise(resolve => {
      asyncStorage.removeItem(userid + HISTORY_LAST_REVISIONID, resolve);
    });
  }

  /*
   * setDataStoreId and getDataStoreId are used to create a table for caching
   * SynctoId to DataStoreId matching. When a `deleted: true` record comes from
   * FxSync, getDataStoreId can help to get DataStoreId easily. So a new record
   * comes, the adapter has to use setDataStoreId to store the ID matching.
   * Since both the synctoId and the dataStoreId for a given URL are unique to
   * the currently logged in user, we store these values prefixed per `userid`
   * (`xClientState` of the currently logged in user).
   */
  function setDataStoreId(synctoId, dataStoreId, userid) {
    return new Promise(resolve => {
      asyncStorage.setItem(userid + HISTORY_SYNCTOID_PREFIX + synctoId,
                           dataStoreId,
                           resolve);
    });
  }

  function getDataStoreId(synctoId, userid) {
    return new Promise(resolve => {
      asyncStorage.getItem(userid + HISTORY_SYNCTOID_PREFIX + synctoId,
                           resolve);
    });
  }

  function mergeRecordsToDataStore(localRecord, remoteRecord) {
    if (!localRecord || !remoteRecord ||
        localRecord.url !== remoteRecord.url) {
      // The local record has different url(id) with the new one.
      console.error('Inconsistent records on url', localRecord, remoteRecord);
      throw new Error('Inconsistent records on url');
    }
    if (!localRecord.fxsyncId && typeof remoteRecord.fxsyncId === 'string') {
      /* When a localRecord is existed without fxsyncId, assign fxsyncId to it
         from a remoteRecord. This case always happens at first synchronization
         or merging two records with the same URL. */
      localRecord.fxsyncId = remoteRecord.fxsyncId;
    } else if (localRecord.fxsyncId !== remoteRecord.fxsyncId) {
      // Two records have different fxsyncId but have the same url(id).
      console.log('Inconsistent records on FxSync ID',
        localRecord, remoteRecord);
      throw new Error('Inconsistent records on FxSync ID',
        localRecord, remoteRecord);
    }
    // We remember if a record had already been created locally before we got
    // remote data for that URL, so that we know not to remove it even when the
    // remote data is deleted. This applies only to readonly sync, and will be
    // removed when sync becomes read-write.
    if (localRecord.createdLocally === undefined) {
      localRecord.createdLocally = true;
    }

    localRecord.visits = localRecord.visits || [];
    // If a localRecord is without any visit records or with older visit
    // than remoteRecord, its title will be replaced by remoteRecord's.
    if ((localRecord.visits.length === 0 && remoteRecord.title) ||
        (remoteRecord.visits[0] >= localRecord.visits[0])) {
      localRecord.title = remoteRecord.title;
    }

    remoteRecord.visits.forEach(item => {
      if (localRecord.visits.indexOf(item) === -1) {
        localRecord.visits.push(item);
      }
    });

    localRecord.visits.sort((a, b) => {
      // sort in descending order
      return b - a;
    });

    return localRecord;
  }

  function addPlace(place, userid) {
    // 1. Get place by url(id of DataStore)
    // 2.A Merge the existing one and new one if it's an existing one,
    //     and update the places.
    // 2.B Add a new record with RevisionId.
    // 3. Add the DataStore record ID into LocalID <-> RemoteID matching table.

    var id = place.url;
    var revisionId;
    return _ensureStore().then(placesStore => {
      revisionId = placesStore.revisionId;
      return placesStore.get(id).then(existedPlace => {
        // Bug 1208352 - PlacesDS accessing code should be extracted to a shared
        // code to prevent drifting out of sync from different piece codes.
        if (existedPlace) {
          var newPlace = mergeRecordsToDataStore(existedPlace, place);
          return placesStore.put(newPlace, id, revisionId);
        }
        // Setting createdLocally to false will cause the record to be deleted
        // again if it's deleted remotely. This applies only to readonly sync,
        // and will be removed when sync becomes read-write.
        place.createdLocally = false;
        return placesStore.add(place, id, revisionId);
      }).then(() => {
        return setDataStoreId(place.fxsyncId, id, userid);
      });
    }).catch(e => {
      if (e.name === 'ConstraintError' &&
          e.message === 'RevisionId is not up-to-date') {
        return LazyLoader.load(['shared/js/sync/errors.js']).then(() => {
          throw new Error(ERROR_SYNC_APP_RACE_CONDITION);
        });
      }
      console.error(e);
    });
  }

  function deleteByDataStoreId(id) {
    return _ensureStore().then(store => {
      var revisionId = store.revisionId;
      return store.get(id).then(record => {
        // Do not delete records that were originally created locally, even if
        // they are deleted remotely. This applies only for readonly sync, and
        // will be removed in the future when we switch to two-way sync.
        if (record.createdLocally) {
          return Promise.resolve();
        }
        return store.remove(id, revisionId);
      });
    });
  }

  function deletePlace(fxsyncId, userid) {
    return getDataStoreId(fxsyncId, userid).then(id => {
      if (!id) {
        console.warn('Ignoring incoming tombstone for unknown FxSyncID',
            fxsyncId);
        return Promise.resolve();
      }
      return deleteByDataStoreId(id);
    });
  }

  function updateFxSyncId(url, fxsyncId) {
    var store;
    return _ensureStore().then(s => {
      store = s;
      return store.get(url);
    }).then((placeRecord) => {
      placeRecord.fxsyncId = fxsyncId;
      return store.put(placeRecord, url);
    });
  }

  function checkIfClearedSince(lastRevisionId, userid) {
    return _ensureStore().then(store => {
      if (lastRevisionId === null) {
        var cursor = store.sync();
        // Skip first task which is always { id: null, operation: 'clear' }
        cursor.next().then(() => {
          return cursor;
        });
      }
      return store.sync(lastRevisionId);
    }).then(cursor => {
      var wasCleared = false;
      return new Promise(resolve => {
        function runNextTask(cursor) {
          cursor.next().then(task => {
            if (task.operation === 'done') {
              resolve({
                newRevisionId: task.revisionId,
                wasCleared
              });
            } else {
              // In readonly mode, if the DataStore was cleared, or some records
              // were removed, it's possible that previously imported data was
              // lost. Therefore, we return wasCleared: true after playing the
              // DataStore history to its current revisionId, so that
              // removeSyncedCollectionMtime will be called, and a full
              // re-import is triggered.
              // If only one record was removed then it would not be necessary
              // to re-import the whole Kinto collection, but right now we have
              // no efficient way to retrieve just one record from the Kinto
              // collection based on URL, because we don't have a mapping from
              // URL to fxsyncId. Since readonly sync is idempotent, there is
              // not much harm in this, but it could possibly be made more
              // efficient, see
              // https://bugzilla.mozilla.org/show_bug.cgi?id=1223418.
              if (['clear', 'remove'].indexOf(task.operation) !== -1) {
                wasCleared = true;
              }
              // Avoid stack overflow:
              setTimeout(() => {
                // Will eventually get to a 'done' task:
                runNextTask(cursor);
              });
            }
          });
        }
        runNextTask(cursor);
      });
    });
  }

  function retrieveModification(userid, itemCallback) {
    return getLastRevisionId(userid).then(revisionId => {
      console.log(revisionId);
      return new Promise((resolve, reject) => {
        var cursor;
        _ensureStore().then(store => {
          cursor = store.sync(revisionId);
          runNextTask(cursor);
        });

        function runNextTask(cursor) {
          cursor.next().then(function(task) {
            if (task.operation === 'done') {
              resolve();
              return;
            }
            itemCallback(task).then(() => {
              runNextTask(cursor);
            });
          });
        }
      });
    });
  }

  /*
   * handleClear - trigger re-import if DataStore was cleared
   *
   * In the future, the bookmarks and history DataAdapters will support
   * two-way sync, so they will not only import data from the kinto.js
   * collection into the DataStore, but also check what changes have
   * been made recently in the DataStore, and reflect these in the kinto.js
   * collection. Until then, the only thing we check from the DataStore is
   * whether it has been cleared. If a `clear` operation was executed on the
   * DataStore since the last time we checked (`lastRevisionId`), then the
   * lastModifiedTime of the kinto.js collection is removed from asyncStorage,
   * triggering a full import.
   */
  function handleClear(userid) {
    var newRevisionId;
    return getLastRevisionId(userid).then(lastRevisionId => {
      return checkIfClearedSince(lastRevisionId, userid);
    }).then(result => {
      newRevisionId = result.newRevisionId;
      if(result.wasCleared) {
        // Removing this from asyncStorage will trigger a full re-import.
        return removeSyncedCollectionMtime(userid);
      }
      return Promise.resolve();
    }).then(() => {
      return setLastRevisionId(newRevisionId, userid);
    });
  }

  function reset(userid) {
    return Promise.all([
      removeSyncedCollectionMtime(userid),
      removeLastRevisionId(userid)
    ]);
  }

  return {
    mergeRecordsToDataStore,
    setSyncedCollectionMtime,
    getSyncedCollectionMtime,
    deletePlace,
    deleteByDataStoreId,
    addPlace,
    retrieveModification,
    updateFxSyncId,
    handleClear,
    reset
  };
})();

DataAdapters.history = {
/**
    KintoCollection.list() provides a list containing all the remotely retrieved
  Firefox Sync records sorted by "last_modified" property in descending order.
  After each sync request we save the "last_modified" property of the last
  processed record so we avoid going through the same records on following
  operations.

    History records are stored locally in a DataStore with format [1] while
  history records coming from Firefox Sync (via Kinto collection) have
  format[2]. We need to convert from [1] to [2] and viceversa. Also, we need to
  add the remote record ID[1.1] from the Kinto collection to its corresponding
  match in the local DataStore, so we can remove the local record afterwards
  when any deleting record requests with the format [3] are coming from FxSync.

  [1] Records stored in Places DataStore (PDS): {
    "url": "http://mozilla.org/", // KEY in PDS
    "title": "Mozilla",
    "icons": {
      "http://mozilla.org/favicon.ico": {
        "sizes": []
      }
    },
    "frecency": 1,
    "visits": [
      // NOTICE: date/time without ms
      1442247252490, 1442247250001
    ],
    "screenshot": {},
    "fxsyncId" "REMOTE_ID", // [1.1]
    "visited": 1442247252490
  }

  [2] Add/Update Records from History Collection (HC): {
    "id": "zMgfGkRinh92",
    "sortindex": 2000,
    "last_modified": 1442247272150,
    "payload": {
      "id": "zMgfGkRinh92",
      "histUri": "http://mozilla.org/",
      "title": "Mozilla",
      "visits": [
         // NOTICE: date/time with ms
        { "date": 1442247252490018, "type": 2 },
        { "date": 1442247250001234, "type": 2 }
      ]
    },
    "_status": "synced"
  }

  [3] Delete Records from History Collection (HC): {
    "id": "_Avscjx5srFy",
    "sortindex": 100,
    "last_modified": 1441985077970,
    "payload": {
      "id": "_Avscjx5srFy",
      "deleted": true
    },
    "_status": "synced"
  }
**/

  _updatePlace(payload, userid) {
    if (payload.deleted) {
      return HistoryHelper.deletePlace(payload.id, userid);
    }

    if (!payload.histUri || !payload.visits) {
      console.warn('Incorrect payload?', payload);
      return Promise.resolve();
    }

    if (payload.histUri && Array.isArray(payload.visits) &&
        payload.visits.length === 0) {
      return HistoryHelper.deleteByDataStoreId(payload.histUri);
    }

    return HistoryHelper.addPlace({
      url: payload.histUri,
      title: payload.title,
      visits: payload.visits.map(elem => Math.floor(elem.date / 1000)),
      fxsyncId: payload.id
    }, userid);
  },

  _next(remoteRecords, lastModifiedTime, userid, cursor) {
    if (cursor === remoteRecords.length) {
      return Promise.resolve();
    }
    if (!Number.isInteger(remoteRecords[cursor].last_modified)) {
      console.warn('Incorrect last_modified?', remoteRecords[cursor]);
      return this._next(remoteRecords, lastModifiedTime, userid, cursor + 1);
    }
    if (remoteRecords[cursor].last_modified <= lastModifiedTime) {
      return Promise.resolve();
    }

    return this._updatePlace(remoteRecords[cursor].payload, userid)
        .then(() => {
      return this._next(remoteRecords, lastModifiedTime, userid, cursor + 1);
    });
  },

  _syncUpRecords(remoteCollection, options) {
    return HistoryHelper.retrieveModification(options.userid, item => {
      console.log(item);
      if (item.operation === 'clear') {
        console.log('ignore clear operation');
        return Promise.resolve();
      }
      if (!item.id || !item.data) {
        console.error('Invalid item for sync-up:', item);
        return Promise.reject('Invalid item for sync-up');
      }
      if (item.data.url.indexOf('app://') === 0) {
        // Ignore app history records.
        console.log('ignore app history records');
        return Promise.resolve();
      }
      if (item.data.fxsyncId) {
        // update the record.
        var editedRecord = {
          id: item.data.fxsyncId,
          payload: {
            title: item.data.title,
            id: item.data.fxsyncId,
            histUri: item.data.url,
            visits: []
          }
        };
        item.data.visits.forEach(visit => {
          editedRecord.payload.visits.push({
            date: visit * 1000,
            type: 2
          });
        });

        console.log('Suppose to update a record.');
        console.log(editedRecord);
        return remoteCollection.update(editedRecord).then(result => {
          console.log(result);
          return Promise.resolve();
        });
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
        console.log('Suppose to create new record.');
        return remoteCollection.create(newRecord).then(result => {
          // write fxsyncId in result to PlacesDS.
          var fxsyncId = result.data.id, url = item.data.url;
          return HistoryHelper.updateFxSyncId(url, fxsyncId).then(() => {
            result.data.payload.id = fxsyncId;
            return remoteCollection.update(result.data);
          });
        });
      }
    });

  },

  update(remoteHistory, options = { readonly: true }) {
    var mtime;
    return LazyLoader.load(['shared/js/async_storage.js']).then(() => {
      if (options.readonly) {
        return Promise.resolve();
      } else {
        return this._syncUpRecords(remoteHistory, options);
      }
    }).then(() => {
      return HistoryHelper.getSyncedCollectionMtime(options.userid);
    }).then(_mtime => {
      mtime = _mtime;
      return remoteHistory.list();
    }).then(list => {
      return this._next(list.data, mtime, options.userid, 0).then(() => {
        if (list.data.length === 0) {
          return Promise.resolve();
        }
        var latestMtime = list.data[0].last_modified;
        return HistoryHelper.setSyncedCollectionMtime(latestMtime,
            options.userid);
      }).then(() => {
        return HistoryHelper.handleClear(options.userid);
      }).then(() => {
       // Always return false for a read-only operation.
       return Promise.resolve(!options.readonly);
      });
    }).catch(err => {
      console.error('History DataAdapter update error', err.message);
      throw err;
    });
  },

  handleConflict(conflict) {
    console.warn('CONFLICT!!!!');
    console.warn(conflict);
    return Promise.resolve(conflict.local);
  },

  reset(options) {
    return LazyLoader.load(['shared/js/async_storage.js']).then(() => {
      return HistoryHelper.reset(options.userid);
    });
  }
};
