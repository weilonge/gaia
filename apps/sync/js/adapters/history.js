/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global SyncEngine */

const HISTORY_COLLECTION_MTIME = 'LastSyncedStatus::HistoryCollection::mtime';

var HistoryHelper = (() => {
  var placesStore;
  function _ensureStore() {
    if (placesStore) {
      return Promise.resolve(placesStore);
    }
    return new Promise(resolve => {
      navigator.getDataStores('places').then(stores => {
        placesStore = stores[0];
        resolve(placesStore);
      });
    });
  }

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

  function mergeRecordsToDataStore(existed, newPlace) {
    if (existed.url !== newPlace.url) {
      // The existed record has different url(id) with the new record.
      throw new Error('Inconsistent records');
    }
    if (!existed.fxsyncId) {
      existed.fxsyncId = newPlace.fxsyncId;
    } else if(existed.fxsyncId !== newPlace.fxsyncId) {
      // Two records have different fxSyncId but have the same url(id).
      throw new Error('Inconsistent records');
    }

    existed.visits = existed.visits || [];
    if (existed.visits.length === 0 && newPlace.title) {
      existed.title = newPlace.title;
    } else if (newPlace.visits[0] >= existed.visits[0]) {
      existed.title = newPlace.title;
    }

    newPlace.visits.forEach(item => {
      if (existed.visits.indexOf(item) === -1) {
        existed.visits.push(item);
      }
    });

    existed.visits.sort((a, b) => {
      return b - a;
    });

    return existed;
  }

  function addPlace(place) {
    // 1. get place by url(id of DataStore)
    // 2.A merge the existed one and new one if it's an existed one,
    //     and update the places.
    // 2.B Add a new record with RevisionId.

    var id = place.url;
    var revisionId;
    return _ensureStore().then(placesStore => {
      revisionId = placesStore.revisionId;
      return placesStore.get(id);
    }).then(existedPlace => {
      if (existedPlace) {
        var newPlace = mergeRecordsToDataStore(existedPlace, place);
        return placesStore.put(newPlace, id, revisionId);
      } else {
        return placesStore.add(place, id, revisionId);
      }
    }).catch(e => {
      console.error(e);
      return;
    });
  }

  function addPlaces(places) {
    return new Promise(resolve => {
      places.reduce((cur, next) => {
        return cur.then(() => {
          return addPlace(next);
        });
      }, Promise.resolve()).then(resolve);
    });
  }

  return {
    mergeRecordsToDataStore: mergeRecordsToDataStore,
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
