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
    var array = [];
    bytes.forEach(function (byte){
      array.push((byte < 16 ? '0' : '') + byte.toString(16).toLowerCase());
    });
    return array.join('');
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
        this.getKeys().then(credentials => {
          var kBarray = [];
          var kB = credentials.kB;
          for(var i = 0; i < kB.length; i+=2){
            kBarray.push(parseInt(kB.substring(i, i+2), 16));
          }
          window.crypto.subtle.digest({name: "SHA-256"}, new Uint8Array(kBarray))
            .then(function(hash){
              var clientState = new Uint8Array(hash).slice(0, 16);
              console.log(bytesAsHex(clientState));
              resolve(bytesAsHex(clientState));
            })
            .catch(function(err){
              reject(err);
            });
        });
      });
    }
  };

  exports.SyncCredentials = SyncCredentials;
}(window));
