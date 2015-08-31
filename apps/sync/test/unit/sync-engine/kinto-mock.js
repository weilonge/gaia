'use strict';

/* global SynctoServerFixture, sinon */
/* exported Kinto */

var Kinto = (function() {
  var Kinto = function(options) {
    var syncStub = {
      //'meta': sinon.stub().returns(Promise.resolve({ ok: true })),
      'meta': function() {
        console.log('syncing meta coll');
        return Promise.resolve({ ok: true });
      },
      'crypto': sinon.stub().returns(Promise.resolve({ ok: true })),
      'history': sinon.stub().returns(Promise.resolve({ ok: true })),
      'schmistory': sinon.stub().returns(Promise.resolve({ ok: true }))
    };
    var listStub = {
      'meta': sinon.stub().returns(Promise.resolve({
        data: [
          SynctoServerFixture.metaGlobalResponse
        ]
      })),
      'crypto': sinon.stub().returns(Promise.resolve({
        data: [
          SynctoServerFixture.cryptoKeysResponse
        ]
      })),
      'history': sinon.stub().returns(Promise.resolve({
        data: [
          SynctoServerFixture.historyEntryResponse
        ]
      })),
      'schmistory': sinon.stub().returns(Promise.resolve({
        data: [
          SynctoServerFixture.schmistoryEntryResponse
        ]
      }))
    };
    if (options.remote === 'http://example.com:24012/v1/') {
      syncStub = {
        'meta': sinon.stub().returns(Promise.resolve({ ok: false })),
        'crypto': sinon.stub().returns(Promise.resolve({ ok: false })),
        'history': sinon.stub().returns(Promise.resolve({ ok: false })),
        'schmistory': sinon.stub().returns(Promise.resolve({ ok: false }))
      };
      listStub = {
        'meta': sinon.stub().returns(Promise.resolve('timeout')),
        'crypto': sinon.stub().returns(Promise.resolve('timeout')),
        'history': sinon.stub().returns(Promise.resolve('timeout')),
        'schmistory': sinon.stub().returns(Promise.resolve('timeout'))
      };
    }

    this.options = options;
    this.collection = sinon.spy(collectionName => {
      return {
        sync: syncStub[collectionName],
        list: listStub[collectionName]
      };
    });
  };
  Kinto.transformers = {
    RemoteTransformer: function() {}
  };
  return Kinto;
})();
