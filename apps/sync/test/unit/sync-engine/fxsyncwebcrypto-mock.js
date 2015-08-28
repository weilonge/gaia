'use strict';

/* global FxSyncWebCryptoFixture, stub, spy */
/* exported FxSyncWebCrypto */

var FxSyncWebCrypto = function() {
  this.setKeys = stub.returns(Promise.resolve());
  this.encrypt = spy((obj, collectionName) => {
    return Promise.resolve(FxSyncWebCryptoFixture.historyEntryEnc);
  });
  this.decrypt = spy((obj, collectionName) => {
    return Promise.resolve(FxSyncWebCryptoFixture.historyEntryDec);
  });
};
