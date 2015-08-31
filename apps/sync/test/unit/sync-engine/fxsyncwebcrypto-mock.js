'use strict';

/* global SynctoServerFixture, sinon, requireApp */
/* exported FxSyncWebCrypto */

requireApp('sync/test/unit/fixtures/synctoserver.js');

var FxSyncWebCrypto = function() {
  this.setKeys = sinon.spy(() => {
    this.bulkKeyBundle = true;
    return Promise.resolve();
  });
  this.encrypt = sinon.stub().returns(Promise.resolve(JSON.parse(
      SynctoServerFixture.remoteData.history.payload)));
  this.decrypt = sinon.spy((obj, collection) => {
    return Promise.resolve(SynctoServerFixture.historyEntryDec.payload);
  });
};
