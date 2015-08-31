'use strict';

/* global SynctoServerFixture, sinon, requireApp */
/* exported FxSyncWebCrypto */

requireApp('sync/test/unit/fixtures/synctoserver.js');

var FxSyncWebCrypto = function() {
  this.setKeys = sinon.stub().returns(Promise.resolve());
  this.encrypt = sinon.stub().returns(Promise.resolve(
      JSON.parse(
        SynctoServerFixture.historyEntryResponse.payload)));
  this.decrypt = sinon.stub().returns(Promise.resolve(
      SynctoServerFixture.historyEntryDec));
};
