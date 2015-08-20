'use strict';
/* globals IAC */
/* exported SynctoHistoryAdapter */

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

var SynctoHistoryAdapter = {
  update: function(kintoCollection) {
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
          last_modified: decryptedRecord.last_modified
        };
        places.push(place);
      });

      return HistoryAPI.addPlaces(places);
    }

    return kintoCollection.list().then(list => {
      return updateHistoryCollection(list);
    });
  }
};
