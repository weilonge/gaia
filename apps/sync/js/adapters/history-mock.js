/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global IAC,
  SyncEngine
*/

var HistoryAPI = {
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

      return HistoryAPI.addPlaces(places);
    }

    return kintoCollection.list().then(list => {
      return updateHistoryCollection(list);
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
