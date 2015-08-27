'use strict';

/* global StringConversion, KeyDerivation, crypto */
/* exported FxSyncWebCrypto */

// WebCrypto-based client for Firefox Sync.

var FxSyncWebCrypto = (function fxsync_webcrypto() {

  const HKDF_INFO_STR = 'identity.mozilla.com/picl/v1/oldsync';

  // constructor
  var FxSyncWebCrypto = function() {
    // Basic check for presence of WebCrypto
    if (!crypto || !crypto.subtle) {
      throw new Error('This environment does not support WebCrypto');
    }

    this.mainSyncKey = null;
    this.bulkKeyBundle = null;
  };

  function importKeyBundle(aesKeyAB, hmacKeyAB) {
    var pAes = crypto.subtle.importKey('raw', aesKeyAB,
                                          { name: 'AES-CBC', length: 256 },
                                          true, [ 'encrypt', 'decrypt' ]
                                    );
    var pHmac =  crypto.subtle.importKey('raw', hmacKeyAB,
                                          { name: 'HMAC', hash: 'SHA-256' },
                                          true, [ 'sign', 'verify' ]
                                      );
    return Promise.all([pAes, pHmac]).then(function(results) {
      return {
        aes: results[0],
        hmac: results[1]
      };
    });
  }

  FxSyncWebCrypto.prototype._importKb = function(kBByteArray) {
    // The number 64 here comes from
    // (256 bits for AES + 256 bits for HMAC) / (8 bits per byte)
    return KeyDerivation.hkdf(kBByteArray,
        StringConversion.rawStringToByteArray(HKDF_INFO_STR),
        new Uint8Array(64), 64).then(function (output) {
      var aesKeyAB = output.slice(0, 32).buffer;
      var hmacKeyAB = output.slice(32).buffer;
      return importKeyBundle(aesKeyAB, hmacKeyAB).then(function(keyBundle) {
        this.mainSyncKey = keyBundle;
      }.bind(this));
    }.bind(this));
  };

  FxSyncWebCrypto.prototype._verifySyncKeys = function(signedTextByteArray,
      cryptoKeysHmacByteArray) {
    return crypto.subtle.verify({ name: 'HMAC', hash: 'AES-256' },
        this.mainSyncKey.hmac, cryptoKeysHmacByteArray, signedTextByteArray);
  };

  FxSyncWebCrypto.prototype._importSyncKeys = function(cryptoKeysIVByteArray,
     cryptoKeysCiphertextByteArray) {
    return crypto.subtle.decrypt({ name: 'AES-CBC', iv: cryptoKeysIVByteArray },
        this.mainSyncKey.aes,
        cryptoKeysCiphertextByteArray).then(function(keyBundleAB) {
      var cryptoKeysJSON = String.fromCharCode.apply(null,
          new Uint8Array(keyBundleAB));
      try {
        this.bulkKeyBundle = JSON.parse(cryptoKeysJSON);
        return importKeyBundle(
            StringConversion.base64StringToByteArray(
                this.bulkKeyBundle.default[0]),
            StringConversion.base64StringToByteArray(
                this.bulkKeyBundle.default[1])
        ).then(function(keyBundle) {
          this.bulkKeyBundle.defaultAsKeyBundle = keyBundle;
        }.bind(this));
      } catch(e) {
        return Promise.reject('Deciphered crypto keys, but not JSON');
      }
    }.bind(this), function(err) {
      return Promise.reject(
          'Could not decrypt crypto keys using AES part of stretched kB key');
    });
  };

  function importFromStrings(obj) {
    var ret = {};
    try {
      ret.ciphertext = StringConversion.base64StringToByteArray(
          obj.ciphertext);
    } catch (e) {
      throw new Error(
          'Could not parse ciphertext as a base64 string');
    }

    // Intentionally using StringConversion.rawStringToByteArray
    // instead of StringConversion.base64StringToByteArray on the ciphertext
    // here - See https://github.com/mozilla/firefox-ios/blob/ \
    // 1cce59c8eac282e151568f1204ffbbcc27349eff/Sync/KeyBundle.swift#L178
    ret.hmacSignedText = StringConversion.rawStringToByteArray(
          obj.ciphertext);

    try {
      ret.IV =
          StringConversion.base64StringToByteArray(obj.IV);
    } catch (e) {
      throw new Error('Could not parse IV as a base64 string');
    }
    try {
      ret.hmacSignature =
          StringConversion.hexStringToByteArray(obj.hmac);
    } catch (e) {
      throw new Error('Could not parse hmac as a hex string');
    }
    return ret;
  }

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

    // Input checking
    try {
      kBByteArray = StringConversion.hexStringToByteArray(kB);
    } catch (e) {
      return Promise.reject('Could not parse kB as a hex string');
    }

    cryptoKeys = importFromStrings(cryptoKeysStrings);

    return this._importKb(kBByteArray).then(function() {
      return this._verifySyncKeys(cryptoKeys.hmacSignedText,
          cryptoKeys.hmacSignature);
    }.bind(this)).then(function(verified) {
      if (verified) {
        return this._importSyncKeys(cryptoKeys.IV,
            cryptoKeys.ciphertext);
      } else {
        return Promise.reject(
            'SyncKeys hmac could not be verified with current main key');
      }
    }.bind(this));
  };

  FxSyncWebCrypto.prototype.selectKeyBundle = function() {
    return this.bulkKeyBundle.defaultAsKeyBundle;
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
    var keyBundle, payload;
    if (typeof payloadStrings !== 'object') {
      throw new Error('PayloadStrings is not an object');
    }
    if (typeof collectionName !== 'string') {
      throw new Error('collectionName is not a string');
    }
    try {
      keyBundle = this.selectKeyBundle(collectionName);
    } catch(e) {
      throw new Error('No key bundle found for ' + collectionName +
          ' - did you call setKeys?');
    }

    payload = importFromStrings(payloadStrings);
    return crypto.subtle.verify({ name: 'HMAC', hash: 'SHA-256' },
        keyBundle.hmac, payload.hmacSignature, payload.hmacSignedText)
        .then(function (result) {
      if (!result) {
        throw new Error(
              'Record verification failed with current hmac key for ' +
              collectionName);
      }
    }).then(function() {
      return crypto.subtle.decrypt({
            name: 'AES-CBC',
            iv: payload.IV,
          }, keyBundle.aes,
          payload.ciphertext)
          .then(function (recordArrayBuffer) {
        var recordObj;
        var recordJSON = String.fromCharCode.apply(null,
            new Uint8Array(recordArrayBuffer));
        try {
          recordObj = JSON.parse(recordJSON);
        } catch(e) {
          return Promise.reject('Deciphered record, but not JSON');
        }
        return recordObj;
      }, function(err) {
        return Promise.reject(
            'Could not decrypt record using AES part of key bundle for ' +
            'collection ' + collectionName);
      });
    });
  };

  FxSyncWebCrypto.prototype._encryptAndSign = function(keyBundle, cleartext) {
    // Generate a random IV using the PRNG of the device
    var IV = new Uint8Array(16);
    crypto.getRandomValues(IV);
    return crypto.subtle.encrypt({
      name: 'AES-CBC',
      iv: IV
    }, keyBundle.aes, cleartext).then(ciphertext => {
      var ciphertextB64 = StringConversion.arrayBufferToBase64String(
          ciphertext);
      return crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' },
          keyBundle.hmac,
          StringConversion.rawStringToByteArray(ciphertextB64))
          .then(hmac => {
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
    var cleartext, cleartextStr, keyBundle;

    if (typeof record !== 'object') {
      return Promise.reject('Record should be an object');
    }
    if (typeof collectionName !== 'string') {
      return Promise.reject('collectionName is not a string');
    }

    try {
      cleartextStr = JSON.stringify(record);
    } catch(e) {
      return Promise.reject('Record cannot be JSON-stringified');
    }
    cleartext = StringConversion.rawStringToByteArray(cleartextStr);
    try {
      keyBundle = this.selectKeyBundle(collectionName);
    } catch(e) {
      return Promise.reject('No key bundle found for ' + collectionName +
          ' - did you call setKeys?');
    }
    return this._encryptAndSign(keyBundle, cleartext);
  };

  return FxSyncWebCrypto;
})();
