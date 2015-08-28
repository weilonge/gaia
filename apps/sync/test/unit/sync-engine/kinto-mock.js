'use strict';

/* global SynctoServerFixture, stub, spy */
/* exported Kinto */

var Kinto = function(options) {
  var syncStub, listStub;
  if (options.URL === 'http://localhost:8000/v1/') {
    syncStub = {
      'global': stub.returns(Promise.resolve()),
      'crypto': stub.returns(Promise.resolve()),
      'history': stub.returns(Promise.resolve()),
      'schmistory': stub.returns(Promise.resolve())
    };
    listStub = {
      'global': stub.returns(Promise.resolve(
          SynctoServerFixture.metaGlobalResponse)),
      'crypto': stub.returns(Promise.resolve(
          SynctoServerFixture.cryptoKeysResponse)),
      'history': stub.returns(Promise.resolve(
          SynctoServerFixture.historyEntryResponse)),
      'schmistory': stub.returns(Promise.resolve(
          SynctoServerFixture.schmistoryEntryResponse))
    };
  } else if (options.URL === 'http://example.com:24012/v1/') {
    syncStub = {
      'global': stub.returns(Promise.resolve()),
      'crypto': stub.returns(Promise.resolve()),
      'history': stub.returns(Promise.resolve()),
      'schmistory': stub.returns(Promise.resolve())
    };
    listStub = {
      'global': stub.returns(Promise.resolve(
          SynctoServerFixture.metaGlobalResponse)),
      'crypto': stub.returns(Promise.resolve(
          SynctoServerFixture.cryptoKeysResponse)),
      'history': stub.returns(Promise.resolve(
          SynctoServerFixture.historyEntryResponse)),
      'schmistory': stub.returns(Promise.resolve(
          SynctoServerFixture.schmistoryEntryResponse))
    };
  }

  this.options = options;
  this.collection = spy(collectionName => {
    return {
      sync: syncStub[collectionName],
      list: listStub[collectionName]
    };
  });
};
