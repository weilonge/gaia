/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  assert,
  asyncStorage,
  requireApp,
  setup,
  sinon,
  suite,
  teardown,
  test,
  SyncEngine
*/

var MockasyncStorage = {
    mItems: {},

    setItem: function(key, value, callback) {
        this.mItems[key] = value;
        if (typeof callback === 'function') {
          callback();
        }
    },

    getItem: function(key, callback) {
      var value = this.mItems[key];
      // use '|| null' will turn a 'false' to null
      if (value === undefined) {
        value = null;
      }
      if (typeof callback === 'function') {
        callback(value);
      }
    },

    mTeardown: function() {
      this.mItems = {};
    }
};

var MockIAC = {
  request(channel, data) {
    return Promise.resolve();
  }
};

window.SyncEngine = {
  DataAdapterClasses:{}
};

requireApp('sync/js/adapters/history-mock.js');

suite('sync/adapters/history >', () => {
  const SYNCED_STATUS_MTIME = 'LastSyncedStatus::Collection::mtime';
  var realIAC, realasyncStorage, testCollectionData, iacRequestSpy;
  var kintoCollection = {
    list() {
      return Promise.resolve({
        data: testCollectionData
      });
    }
  };

  function verifyAndGetIacRequest(channel, method) {
    assert.equal(iacRequestSpy.args[0][0], 'sync-history');
    assert.equal(iacRequestSpy.args[0][1].method, 'addPlaces');
    return iacRequestSpy.args[0][1].args[0];
  }

  function verifyPlaces(collectionItem, placesItem) {
    var payload = collectionItem.payload;
    assert.equal(payload.histUri, placesItem.url);
    assert.equal(payload.title, placesItem.title);
    for(var i = 0; i < payload.visits.length; i++){
      assert.equal(payload.visits[i].date, placesItem.visits[i] * 1000);
    }
    assert.equal(payload.id, placesItem.fxsyncId);
  }

  function testDataGenerator(initIndex, initDate, count) {
    var list = [];
    for (var i = initIndex; i < initIndex + count; i++) {
      list.unshift({
        id: 'UNIQUE_ID_' + i,
        last_modified: initDate + i * 10,
        payload: {
          id: 'UNIQUE_ID_' + i,
          histUri: 'http://example' + i + '.com/',
          title: 'Example ' + i + ' Title',
          visits: [{
            date: (initDate + i * 10) * 1000, type: 3
          }]
        }
      });
    }
    return list;
  }

  setup(() => {
    realIAC = window.IAC;
    realasyncStorage = window.asyncStorage;
    window.IAC = MockIAC;
    window.asyncStorage = MockasyncStorage;
    testCollectionData = [];
    iacRequestSpy = sinon.spy(MockIAC, 'request');
  });

  teardown(() => {
    window.IAC = realIAC;
    window.asyncStorage.mTeardown();
    window.asyncStorage = realasyncStorage;
    iacRequestSpy.restore();
  });

  test('update - empty records', done => {
    var historyAdapter = SyncEngine.DataAdapterClasses.history;
    historyAdapter.update(kintoCollection).then((result) => {
      assert.equal(result, false);
      assert.equal(iacRequestSpy.callCount, 0);
      assert.equal(asyncStorage.mItems[SYNCED_STATUS_MTIME], null);
      done();
    });
  });

  test('update - 5 new records', done => {
    var historyAdapter = SyncEngine.DataAdapterClasses.history;
    testCollectionData = testDataGenerator(1, 1440000000, 5);
    historyAdapter.update(kintoCollection).then((result) => {
      assert.equal(result, false);
      var mTime = testCollectionData[0].last_modified;
      assert.equal(asyncStorage.mItems[SYNCED_STATUS_MTIME], mTime);
      assert.equal(iacRequestSpy.callCount, 1);
      var placesRequest = verifyAndGetIacRequest('sync-history', 'addPlaces');
      verifyPlaces(testCollectionData[0], placesRequest[0]);
      done();
    });
  });

  test('update - 2 sync request', done => {
    var historyAdapter = SyncEngine.DataAdapterClasses.history;
    Promise.resolve().then(() => {
      testCollectionData = testDataGenerator(1, 100, 5);
      return historyAdapter.update(kintoCollection).then((result) => {
        assert.equal(result, false);
        var mTime = testCollectionData[0].last_modified;
        assert.equal(asyncStorage.mItems[SYNCED_STATUS_MTIME], mTime);
        assert.equal(iacRequestSpy.callCount, 1);
        var placesRequest = verifyAndGetIacRequest('sync-history', 'addPlaces');
        verifyPlaces(testCollectionData[0], placesRequest[0]);
        iacRequestSpy.reset();
        return Promise.resolve();
      });
    }).then(() => {
      testCollectionData = testDataGenerator(6, 500, 5);
      return historyAdapter.update(kintoCollection).then((result) => {
        assert.equal(result, false);
        var mTime = testCollectionData[0].last_modified;
        assert.equal(asyncStorage.mItems[SYNCED_STATUS_MTIME], mTime);
        assert.equal(iacRequestSpy.callCount, 1); // XXXX
        var placesRequest = verifyAndGetIacRequest('sync-history', 'addPlaces');
        verifyPlaces(testCollectionData[0], placesRequest[0]);
        iacRequestSpy.reset();
        return Promise.resolve();
      });
    }).then(() => {
      done();
    });
  });

  test('HistoryHelper - merge two records', done => {
    var place1 = {
      url: 'http://www.mozilla.org/en-US/',
      title: '',
      fxsyncId: '',
      visits: [ 1501000000000, 1502000000000 ]
    };

    var place2 = {
      url: 'http://www.mozilla.org/en-US/',
      title: 'Mozilla',
      fxsyncId: 'XXXXX_ID_XXXXX',
      visits: [ 1502000000000, 1503000000000 ]
    };

    var result = HistoryHelper.mergeRecordsToDataStore(place1, place2);
    var expectedPlace = {
      url: 'http://www.mozilla.org/en-US/',
      title: 'Mozilla',
      fxsyncId: 'XXXXX_ID_XXXXX',
      visits: [1503000000000, 1502000000000, 1501000000000]
    };

    assert.equal(result.title, expectedPlace.title);
    assert.equal(result.url, expectedPlace.url);
    assert.equal(result.visits.length, expectedPlace.visits.length);
    for(var i = 0; i < result.visits.length; i++){
      assert.equal(result.visits[i], expectedPlace.visits[i]);
    }
    done();
  });
});
