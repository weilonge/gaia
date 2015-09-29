/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  assert,
  asyncStorage,
  DataAdapters,
  BOOKMARKS_COLLECTION_MTIME,
  BOOKMARKS_SYNCTOID_PREFIX,
  BookmarksHelper,
  MockasyncStorage,
  MockDatastore,
  MockLazyLoader,
  MockNavigatorDatastore,
  require,
  requireApp,
  setup,
  sinon,
  suite,
  suiteSetup,
  suiteTeardown,
  teardown,
  test
*/

require('/apps/music/test/unit/mock_lazy_loader.js');
require('/shared/test/unit/mocks/mock_navigator_datastore.js');
require('/apps/system/test/unit/mock_asyncStorage.js');
requireApp('sync/js/adapters/bookmarks.js');

window.DataAdapters = {};

suite('sync/adapters/bookmarks >', () => {
  var realDatastore, realLazyLoader, realAsyncStorage, testCollectionData;
  var updateBookmarksSpy;
  var kintoCollection = {
    list() {
      return Promise.resolve({
        data: testCollectionData
      });
    }
  };

  function getBookmarksStore() {
    return navigator.getDataStores().then(stores => {
      return Promise.resolve(stores[0]);
    });
  }

  function verifyBookmarks(collectionItem, bookmarksItem) {
    var payload = collectionItem.payload;
    if (payload.type === 'bookmark') {
      assert.equal(payload.bmkUri, bookmarksItem.url);
      assert.equal(payload.title, bookmarksItem.name);
    }
    assert.equal(payload.id, bookmarksItem.fxsyncId);
  }

  function testDataGenerator(initIndex, initDate, count) {
    var list = [];
    for (var i = initIndex; i < initIndex + count; i++) {
      var visits = [];
      var startData = initDate + i * 100;
      for (var j = 0; j < 3; j++) {
        visits.push({
          date: (startData + j * 10) * 1000, type: 3
        });
      }

      list.unshift({
        id: 'UNIQUE_ID_' + i,
        last_modified: initDate + i * 10,
        payload: {
          id: 'UNIQUE_ID_' + i,
          bmkUri: 'http://example' + i + '.com/',
          title: 'Example ' + i + ' Title',
          type: 'bookmark'
        }
      });
    }
    return list;
  }

  suiteSetup(() => {
    realDatastore = navigator.getDataStores;

    realAsyncStorage = window.asyncStorage;
    window.asyncStorage = MockasyncStorage;

    realLazyLoader = window.LazyLoader;
    window.LazyLoader = MockLazyLoader;
  });

  suiteTeardown(() => {
    navigator.getDataStores = realDatastore;

    window.LazyLoader = realLazyLoader;

    window.asyncStorage = realAsyncStorage;
  });

  setup(() => {
    navigator.getDataStores = MockNavigatorDatastore.getDataStores;
    updateBookmarksSpy = sinon.spy(BookmarksHelper, 'updateBookmarks');
    testCollectionData = [];
  });

  teardown(() => {
    updateBookmarksSpy.restore();
    MockDatastore._inError = false;
    MockDatastore._records = Object.create(null);
    window.asyncStorage.mTeardown();
  });

  test('update - empty records', done => {
    var bookmarksAdapter = DataAdapters.bookmarks;
    bookmarksAdapter.update(kintoCollection).then((result) => {
      assert.equal(result, false);
      assert.equal(updateBookmarksSpy.callCount, 0);
      assert.equal(asyncStorage.mItems[BOOKMARKS_COLLECTION_MTIME], null);
    }).then(done, reason => {
      assert.ok(false, reason);
    });
  });

  test('update - 1 sync request with 5 new records', done => {
    var bookmarksAdapter = DataAdapters.bookmarks;
    testCollectionData = testDataGenerator(1, 1440000000, 5);
    bookmarksAdapter.update(kintoCollection).then((result) => {
      assert.equal(result, false);
      var mTime = testCollectionData[0].last_modified;
      assert.equal(asyncStorage.mItems[BOOKMARKS_COLLECTION_MTIME], mTime);
      assert.equal(updateBookmarksSpy.callCount, 1);
      return Promise.resolve();
    }).then(getBookmarksStore).then(placesStore => {
      var ids = testCollectionData.map(item => {
        return item.payload.id;
      });
      return placesStore.get.apply(placesStore, ids).then(list => {
        for (var i = 0; i < ids.length; i++) {
          verifyBookmarks(testCollectionData[i], list[i]);
          assert.equal(
            asyncStorage.mItems[BOOKMARKS_SYNCTOID_PREFIX + list[i].fxsyncId],
            list[i].id);
        }
      });
    }).then(done, reason => {
      assert.ok(false, reason);
    });
  });

  test('update - 2 sync requests', done => {
    var bookmarksAdapter = DataAdapters.bookmarks;
    Promise.resolve().then(() => {
      testCollectionData = testDataGenerator(1, 100, 5)
        .concat(testCollectionData);
      return bookmarksAdapter.update(kintoCollection);
    }).then((result) => {
      assert.equal(result, false);
      var mTime = testCollectionData[0].last_modified;
      assert.equal(asyncStorage.mItems[BOOKMARKS_COLLECTION_MTIME], mTime);
      assert.equal(updateBookmarksSpy.callCount, 1);
      return Promise.resolve();
    }).then(() => {
      testCollectionData = testDataGenerator(6, 500, 5)
        .concat(testCollectionData);
      return bookmarksAdapter.update(kintoCollection);
    }).then((result) => {
      assert.equal(result, false);
      var mTime = testCollectionData[0].last_modified;
      assert.equal(asyncStorage.mItems[BOOKMARKS_COLLECTION_MTIME], mTime);
      assert.equal(updateBookmarksSpy.callCount, 2);
      return Promise.resolve();
    }).then(getBookmarksStore).then(placesStore => {
      var ids = testCollectionData.map(item => {
        return item.payload.id;
      });
      return placesStore.get.apply(placesStore, ids).then(list => {
        for (var i = 0; i < ids.length; i++) {
          verifyBookmarks(testCollectionData[i], list[i]);
          assert.equal(
            asyncStorage.mItems[BOOKMARKS_SYNCTOID_PREFIX + list[i].fxsyncId],
            list[i].id);
        }
      });
    }).then(done, reason => {
      assert.ok(false, reason);
    });
  });
/*
  test('update - 2 sync requests with 2 deleted: true records', done => {
    var bookmarksAdapter = DataAdapters.bookmarks, store;
    var deletedQueue = ['UNIQUE_ID_1', 'UNIQUE_ID_4'];
    Promise.resolve().then(() => {
      testCollectionData = testDataGenerator(1, 100, 5)
        .concat(testCollectionData);
      return bookmarksAdapter.update(kintoCollection);
    }).then((result) => {
      assert.equal(result, false);
      var mTime = testCollectionData[0].last_modified;
      assert.equal(asyncStorage.mItems[BOOKMARKS_COLLECTION_MTIME], mTime);
      assert.equal(updateBookmarksSpy.callCount, 1);
      return Promise.resolve();
    }).then(() => {
      testCollectionData = testDataGenerator(6, 500, 5)
        .concat(testCollectionData);
      var latestModified = testCollectionData[0].last_modified + 10000;
      var deletedRecords = [];
      deletedQueue.forEach((synctoId, i) => {
        deletedRecords.push({
          id: synctoId,
          last_modified: latestModified + 10000 * i,
          payload: {
            deleted: true,
            id: synctoId
          }
        });
      });
      testCollectionData = deletedRecords.concat(testCollectionData);
      return bookmarksAdapter.update(kintoCollection);
    }).then((result) => {
      assert.equal(result, false);
      var mTime = testCollectionData[0].last_modified;
      assert.equal(asyncStorage.mItems[BOOKMARKS_COLLECTION_MTIME], mTime);
      assert.equal(updateBookmarksSpy.callCount, 2);
      return Promise.resolve();
    }).then(getBookmarksStore).then(placesStore => {
      store = placesStore;
      var ids = testCollectionData.map(item => {
        return item.payload.histUri;
      });
      return store.get.apply(store, ids).then(list => {
        for (var i = 0; i < list.length; i++) {
          if (list[i]) {
            verifyBookmarks(testCollectionData[i], list[i]);
            assert.equal(
              asyncStorage.mItems[BOOKMARKS_SYNCTOID_PREFIX + list[i].fxsyncId],
              list[i].url);
          } else {
            assert.notEqual(deletedQueue.indexOf(testCollectionData[i].id), -1);
          }
        }
      });
    }).then(done, reason => {
      assert.ok(false, reason);
    });
  });

  test('update - empty visits record', done => {
    var bookmarksAdapter = DataAdapters.bookmarks;
    var i = 1;
    testCollectionData.unshift({
      id: 'UNIQUE_ID_' + i,
      last_modified: 100 + i * 10,
      payload: {
        id: 'UNIQUE_ID_' + i,
        histUri: 'http://example' + i + '.com/',
        title: 'Example ' + i + ' Title',
        visits: []
      }
    });
    bookmarksAdapter.update(kintoCollection).then((result) => {
      assert.equal(result, false);
      assert.equal(asyncStorage.mItems[BOOKMARKS_COLLECTION_MTIME], null);
      assert.equal(updateBookmarksSpy.callCount, 0);
      return Promise.resolve();
    }).then(done, reason => {
      assert.ok(false, reason);
    });
  });

  test('update - empty bookmarks-uri record', done => {
    var bookmarksAdapter = DataAdapters.bookmarks;
    var i = 1;
    testCollectionData.unshift({
      id: 'UNIQUE_ID_' + i,
      last_modified: 100 + i * 10,
      payload: {
        id: 'UNIQUE_ID_' + i,
        histUri: '',
        title: 'Example ' + i + ' Title',
        visits: [10000, 20000]
      }
    });
    bookmarksAdapter.update(kintoCollection).then((result) => {
      assert.equal(result, false);
      assert.equal(asyncStorage.mItems[BOOKMARKS_COLLECTION_MTIME], null);
      assert.equal(updateBookmarksSpy.callCount, 0);
      return Promise.resolve();
    }).then(done, reason => {
      assert.ok(false, reason);
    });
  });

  test('update - empty last_modified record', done => {
    var bookmarksAdapter = DataAdapters.bookmarks;
    var i = 1;
    testCollectionData.unshift({
      id: 'UNIQUE_ID_' + i,
      last_modified: null,
      payload: {
        id: 'UNIQUE_ID_' + i,
        histUri: 'http://example' + i + '.com/',
        title: 'Example ' + i + ' Title',
        visits: [10000, 20000]
      }
    });
    bookmarksAdapter.update(kintoCollection).then((result) => {
      assert.equal(result, false);
      assert.equal(asyncStorage.mItems[BOOKMARKS_COLLECTION_MTIME], null);
      assert.equal(updateBookmarksSpy.callCount, 0);
      return Promise.resolve();
    }).then(done, reason => {
      assert.ok(false, reason);
    });
  });

  test('BookmarksHelper - merge two records', done => {
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

    var result = BookmarksHelper.mergeRecordsToDataStore(place1, place2);
    var expectedBookmark = {
      url: 'http://www.mozilla.org/en-US/',
      title: 'Mozilla',
      fxsyncId: 'XXXXX_ID_XXXXX',
      visits: [1503000000000, 1502000000000, 1501000000000]
    };

    assert.equal(result.title, expectedBookmark.title);
    assert.equal(result.url, expectedBookmark.url);
    assert.equal(result.visits.length, expectedBookmark.visits.length);
    for(var i = 0; i < result.visits.length; i++){
      assert.equal(result.visits[i], expectedBookmark.visits[i]);
    }
    done();
  });

  test('BookmarksHelper - merge two records with incorrect URL', done => {
    var place1 = {
      url: 'dummy',
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

    assert.throws(() => {
      BookmarksHelper.mergeRecordsToDataStore(place1, place2);
    });
    done();
  });

  test('BookmarksHelper - merge two records with incorrect fxsyncId', done => {
    var place1 = {
      url: 'http://www.mozilla.org/en-US/',
      title: '',
      fxsyncId: 'dummy',
      visits: [ 1501000000000, 1502000000000 ]
    };

    var place2 = {
      url: 'http://www.mozilla.org/en-US/',
      title: 'Mozilla',
      fxsyncId: 'XXXXX_ID_XXXXX',
      visits: [ 1502000000000, 1503000000000 ]
    };

    assert.throws(() => {
      BookmarksHelper.mergeRecordsToDataStore(place1, place2);
    });
    done();
  });
*/
});
