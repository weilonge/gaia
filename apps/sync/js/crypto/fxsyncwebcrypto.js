/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  crypto,
  KeyDerivation,
  StringConversion
*/

/* exported
  FxSyncWebCrypto
*/

// WebCrypto-based client for Firefox Sync.

var FxSyncWebCrypto = (() => {

  const HKDF_INFO_STR = 'identity.mozilla.com/picl/v1/oldsync';

  var FxSyncWebCrypto = function() {
    // Basic check for presence of WebCrypto.
    if (!crypto || !crypto.subtle) {
      throw new Error('This environment does not support WebCrypto');
    }

    this.mainSyncKey = null;
    this.bulkKeyBundle = null;
  };

  var importKeyBundle = (aesKeyAB, hmacKeyAB) => {
    var pAes = crypto.subtle.importKey('raw', aesKeyAB,
                                       { name: 'AES-CBC', length: 256 },
                                       true, [ 'encrypt', 'decrypt' ]);
    var pHmac =  crypto.subtle.importKey('raw', hmacKeyAB,
                                         { name: 'HMAC', hash: 'SHA-256' },
                                         true, [ 'sign', 'verify' ]);
    return Promise.all([pAes, pHmac]).then(results => {
      return {
        aes: results[0],
        hmac: results[1]
      };
    });
  };

  FxSyncWebCrypto.prototype._importKb = function(kBByteArray) {
    // The number 64 here comes from
    // (256 bits for AES + 256 bits for HMAC) / (8 bits per byte).
    return KeyDerivation.hkdf(kBByteArray,
                              StringConversion.rawStringToByteArray(
                                  HKDF_INFO_STR),
                              new Uint8Array(64), 64).then(output => {
      var aesKeyAB = output.slice(0, 32).buffer;
      var hmacKeyAB = output.slice(32).buffer;
      return importKeyBundle(aesKeyAB, hmacKeyAB).then(keyBundle => {
        this.mainSyncKey = keyBundle;
      });
    });
  };

  FxSyncWebCrypto.prototype._verifySyncKeys = function(
      signedTextByteArray,
      cryptoKeysHmacByteArray) {
    return crypto.subtle.verify({ name: 'HMAC', hash: 'AES-256' },
        this.mainSyncKey.hmac, cryptoKeysHmacByteArray, signedTextByteArray);
  };

  FxSyncWebCrypto.prototype._importSyncKeys = function(
      cryptoKeysIVByteArray,
      cryptoKeysCiphertextByteArray) {
    return crypto.subtle.decrypt({ name: 'AES-CBC', iv: cryptoKeysIVByteArray },
                                 this.mainSyncKey.aes,
                                 cryptoKeysCiphertextByteArray)
        .then(keyBundleAB => {
      var cryptoKeysJSON = String.fromCharCode.apply(
          null,
          new Uint8Array(keyBundleAB));
      try {
        this.bulkKeyBundle = JSON.parse(cryptoKeysJSON);
        return importKeyBundle(
            StringConversion.base64StringToByteArray(
                this.bulkKeyBundle.default[0]),
            StringConversion.base64StringToByteArray(
                this.bulkKeyBundle.default[1])).then(keyBundle => {
          this.bulkKeyBundle.defaultAsKeyBundle = keyBundle;
        });
      } catch(e) {
        return Promise.reject('Deciphered crypto keys, but not JSON');
      }
    }, () => {
      return Promise.reject(
          'Could not decrypt crypto keys using AES part of stretched kB key');
    });
  };

  var importFromStrings = (obj) => {
    var ret = {};
    try {
      ret.ciphertext = StringConversion.base64StringToByteArray(obj.ciphertext);
    } catch (e) {
      throw new Error('Could not parse ciphertext as a base64 string');
    }

    // Intentionally using StringConversion.rawStringToByteArray
    // instead of StringConversion.base64StringToByteArray on the ciphertext
    // here - see https://github.com/mozilla/firefox-ios/blob/ \
    // 1cce59c8eac282e151568f1204ffbbcc27349eff/Sync/KeyBundle.swift#L178.
    ret.hmacSignedText = StringConversion.rawStringToByteArray(obj.ciphertext);

    try {
      ret.IV = StringConversion.base64StringToByteArray(obj.IV);
    } catch (e) {
      throw new Error('Could not parse IV as a base64 string');
    }
    try {
      ret.hmacSignature = StringConversion.hexStringToByteArray(obj.hmac);
    } catch (e) {
      throw new Error('Could not parse hmac as a hex string');
    }
    return ret;
  };

  /*
   * setKeys - import kB and crypto/keys
   *
   * @param {String} kB Hex string with kB from FxA onepw protocol
   * @param {Object} cryptoKeysStrings Object with:
   *     - ciphertext {String} A Base64 String containing an AES-CBC ciphertext
   *     - IV {String} A Base64 String containing the AES-CBC Initialization
   *         Vector
   *     - hmac {String} A Hex String containing the HMAC-SHA256 signature
   * @returns {Promise} A promise that will resolve after import of kB and
   *     decryption of cryptoKeys.
   */
  FxSyncWebCrypto.prototype.setKeys = function(kB, cryptoKeysStrings) {
    var kBByteArray, cryptoKeys;

    // Input checking.
    try {
      kBByteArray = StringConversion.hexStringToByteArray(kB);
    } catch (e) {
      return Promise.reject('Could not parse kB as a hex string');
    }

    try {
      cryptoKeys = importFromStrings(cryptoKeysStrings);
    } catch(err) {
      return Promise.reject(err);
    }

    return this._importKb(kBByteArray).then(() => {
      return this._verifySyncKeys(cryptoKeys.hmacSignedText,
                                  cryptoKeys.hmacSignature);
    }).then(verified => {
      if (verified) {
        return this._importSyncKeys(cryptoKeys.IV,
                                    cryptoKeys.ciphertext);
      } else {
        return Promise.reject(
            'SyncKeys hmac could not be verified with current main key');
      }
    });
  };

  /*
   * decrypt - verify and decrypt a Weave Basic Object
   *
   * @param {Object} payloadStrings Object with:
   *     - ciphertext {String} A Base64 String containing an AES-CBC ciphertext
   *     - IV {String} A Base64 String containing the AES-CBC Initialization
   *         Vector
   *     - hmac {String} A Hex String containing the HMAC-SHA256 signature
   * @param {String} collectionName String The name of the Sync collection
   *     (currently ignored, see
   *     https://github.com/michielbdejong/fxsync-webcrypto/issues/19)
   * @returns {Promise} A promise for the decrypted Weave Basic Object.
   */
  FxSyncWebCrypto.prototype.decrypt = function(payloadStrings, collectionName) {
    if (typeof payloadStrings !== 'object') {
      throw new Error('PayloadStrings is not an object');
    }
    if (typeof collectionName !== 'string') {
      throw new Error('collectionName is not a string');
    }

    var keyBundle, payload;

    try {
      keyBundle = this.bulkKeyBundle.defaultAsKeyBundle;
    } catch(e) {
      throw new Error(`No key bundle found for ${collectionName} - did you call\
 setKeys?`);
    }

    payload = importFromStrings(payloadStrings);
    return crypto.subtle.verify({ name: 'HMAC', hash: 'SHA-256' },
                                keyBundle.hmac, payload.hmacSignature,
                                payload.hmacSignedText).then(result => {
      if (!result) {
        throw new Error(`Record verification failed with current hmac key for \
${collectionName}`);
      }
    }).then(() => {
      return crypto.subtle.decrypt({ name: 'AES-CBC', iv: payload.IV },
                                   keyBundle.aes,
                                   payload.ciphertext)
          .then(recordArrayBuffer => {
        var recordObj;
        var recordJSON = StringConversion.byteArrayToUtf16String(
            new Uint8Array(recordArrayBuffer));
        try {
          recordObj = JSON.parse(recordJSON);
        } catch(e) {
          return Promise.reject('Deciphered record, but not JSON');
        }
        return recordObj;
      }, () => {
        return Promise.reject(`Could not decrypt record using AES part of key b\
undle for collection ${collectionName}`);
      });
    });
  };

  var encryptAndSign = (keyBundle, cleartext) => {
    // Generate a random IV using the PRNG of the device.
    var IV = new Uint8Array(16);
    crypto.getRandomValues(IV);
    return crypto.subtle.encrypt({ name: 'AES-CBC', iv: IV }, keyBundle.aes,
                                 cleartext).then(ciphertext => {
      var ciphertextB64 = StringConversion.arrayBufferToBase64String(
          ciphertext);
      return crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' },
                                keyBundle.hmac,
                                StringConversion.rawStringToByteArray(
                                    ciphertextB64)).
          then(hmac => {
        return {
          hmac: StringConversion.arrayBufferToHexString(hmac),
          ciphertext: ciphertextB64,
          IV: StringConversion.byteArrayToBase64String(IV)
        };
      });
    });
  };

  /*
   * encrypt - encrypt and sign a record
   *
   * @param {Object} record Object The data to be JSON-stringified and stored
   * @param {String} collectionName String The name of the Sync collection
   *     (currently ignored, see
   *     https://github.com/michielbdejong/fxsync-webcrypto/issues/19)
   * @returns {Promise} A promise for an object with ciphertext, IV, and hmac.
   */
  FxSyncWebCrypto.prototype.encrypt = function(record, collectionName) {
    if (typeof record !== 'object') {
      return Promise.reject('Record should be an object');
    }
    if (typeof collectionName !== 'string') {
      return Promise.reject('collectionName is not a string');
    }

    var cleartext, cleartextStr, keyBundle;

    try {
      cleartextStr = JSON.stringify(record);
    } catch(e) {
      return Promise.reject('Record cannot be JSON-stringified');
    }
    cleartext = StringConversion.utf16StringToByteArray(cleartextStr);
    try {
      keyBundle = this.bulkKeyBundle.defaultAsKeyBundle;
    } catch(e) {
      return Promise.reject('No key bundle found for ' + collectionName +
          ' - did you call setKeys?');
    }
    return encryptAndSign(keyBundle, cleartext);
  };

  return FxSyncWebCrypto;
})();
