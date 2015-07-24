/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* exported SyncCredentials */

'use strict';

(function(exports) {
  function hexToBytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length - 1; i += 2) {
      bytes.push(parseInt(str.substr(i, 2), 16));
    }
    return String.fromCharCode.apply(String, bytes);
  }

  function bytesAsHex(bytes) {
    return [("0" + bytes.charCodeAt(byte).toString(16)).slice(-2)
      for (byte in bytes)].join("");
  }

  var SyncCredentials = {

    /*
     getSyncKeyBundle: function() {
      if (this._syncKeyBundle) {
        return Promise.resolve(this._syncKeyBundle);
      }
      return this.getKeys().then(credentials => {
        var kB = credentials.kB;
        this._syncKeyBundle = deriveKeyBundle(hexToBytes(kB));
        return this._syncKeyBundle;
      });
    },*/

    getKeys: function() {
      return new Promise((resolve, reject) => {
        LazyLoader.load('js/fx_accounts_client.js', () => {
          FxAccountsClient.getKeys(resolve, reject);
        });
      });
    },

    // Return string: hex(first16Bytes(sha256(kBbytes)))
    getXClientState: function() {
      return new Promise((resolve, reject) => {
        LazyLoader.load('js/sync/sjcl.js', () => {
          this.getKeys().then(result => {
            console.log('Got result ', result);
            console.log('kB ' + result.kB);
            var bitArray = sjcl.hash.sha256.hash(bytesAsHex(result.kB));
            var sha256Digest = sjcl.codec.hex.fromBits(bitArray);
            var state = bytesAsHex(sha256Digest.slice(0,16));
            console.log('result ' + state);
            resolve(result);
          });
        });
      });
    }
  };

  exports.SyncCredentials = SyncCredentials;
}(window));
