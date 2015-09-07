/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global SynctoServerFixture, requireApp */
/* exported FxSyncWebCrypto */

requireApp('sync/test/unit/fixtures/synctoserver.js');

var FxSyncWebCrypto = function() {};
FxSyncWebCrypto.prototype = {
  setKeys: function(kB, cryptoKeys) {
    this.shouldWork = true;
    if (kB !== SynctoServerFixture.testServerCredentials.kB) {
      this.shouldWork = false;
    }
    var correctCryptoKeys = JSON.parse(
        SynctoServerFixture.remoteData.crypto.payload);
    if (cryptoKeys.ciphertext !== correctCryptoKeys.ciphertext ||
        cryptoKeys.IV !== correctCryptoKeys.IV ||
        cryptoKeys.hmac !== correctCryptoKeys.hmac) {
      this.shouldWork = false;
    }
    if (this.shouldWork) {
      this.bulkKeyBundle = true;
      return Promise.resolve();
    } else {
      return Promise.reject(`SyncKeys hmac could not be verified with current m\
ain key`);
    }
  },
  encrypt: function(payload) {
    if (this.shouldWork) {
      return Promise.resolve({ mockEncrypted: JSON.stringify(payload) });
    } else {
      return Promise.reject();
    }
  },
  decrypt: function(record) {
    var decryptablePayload = JSON.parse(
        SynctoServerFixture.remoteData.history.payload);
    if (this.shouldWork &&
        record.ciphertext === decryptablePayload.ciphertext &&
        record.IV === decryptablePayload.IV &&
        record.hmac === decryptablePayload.hmac) {
      return Promise.resolve(
          SynctoServerFixture.historyEntryDec.payload);
    } else {
      return Promise.reject(new Error(`payload.ciphertext is not a Base64 strin\
g`));
    }
  }
};
