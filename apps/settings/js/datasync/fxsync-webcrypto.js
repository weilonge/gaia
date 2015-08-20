(function(window) {
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var StringConversion = {
  rawStringToByteArray: function(str) {
    if (typeof str != 'string') {
      throw new Error('Not a string');
    }
    var strLen = str.length;
    var byteArray = new Uint8Array(strLen);
    for (var i = 0; i < strLen; i++) {
      byteArray[i] = str.charCodeAt(i);
    }
    return byteArray;
  },

  base64StringToByteArray: function(base64) {
    if (typeof base64 != 'string' || base64.length % 4 !== 0) {
      throw new Error('Number of base64 digits must be a multiple of 4 to convert to bytes');
    }
    return this.rawStringToByteArray(window.atob(base64));
  },

  hexStringToByteArray: function(hexStr) {
    if (typeof hexStr != 'string' || hexStr.length % 2 !== 0) {
      throw new Error('Must have an even number of hex digits to convert to bytes');
    }
    var numBytes = hexStr.length / 2;
    var byteArray = new Uint8Array(numBytes);
    for (var i = 0; i < numBytes; i++) {
      byteArray[i] = parseInt(hexStr.substr(i * 2, 2), 16); //FIXME: Can this be done faster?
    }
    return byteArray;
  },

  byteArrayToBase64String: function(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new Error('Not a Uint8Array');
    }
    var binary = '';
    var len = bytes.byteLength;
    for (var i=0; i<len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  },

  arrayBufferToBase64String: function(buffer) {
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error('Not an ArrayBuffer');
    }
    var bytes = new Uint8Array(buffer);
    return this.byteArrayToBase64String(bytes);
  },

  byteArrayToHexString: function(bytes) {
    if (!(bytes instanceof Uint8Array)) {
      throw new Error('Not a Uint8Array');
    }
    var hex = '';
    for (var i=0; i <bytes.length; ++i) {
      var zeropad = (bytes[i] < 0x10) ? "0" : "";
      hex += zeropad + bytes[i].toString(16);
    }
    return hex;
  },

  arrayBufferToHexString: function(buffer) {
    if (!(buffer instanceof ArrayBuffer)) {
      throw new Error('Not an ArrayBuffer');
    }
    var bytes = new Uint8Array(buffer);
    return this.byteArrayToHexString(bytes);
  }

};
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// NB: This code was copied from the hawk_creds.js file from
// https://github.com/mozilla-b2g/firefoxos-loop-client

var KeyDerivation = (function() {
  // hash length is 32 because only SHA256 is used at this moment
  var HASH_LENGTH = 32;
  var subtle = window.crypto.subtle;

  concatU8Array = (buffer1, buffer2) => {
    var aux = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    aux.set(new Uint8Array(buffer1), 0);
    aux.set(new Uint8Array(buffer2), buffer1.byteLength);
    return aux;
  };

  var alg = {
    name: "HMAC",
    hash: "SHA-256"
  };
  doImportKey = rawKey => subtle.importKey('raw', rawKey, alg,
                                           false, ['sign']);

  // Converts a ArrayBuffer into a ArrayBufferView (U8) if it's not that
  // already.
  var arrayBuffer2Uint8 =
        buff => buff.buffer && buff || new Uint8Array(buff);

  doHMAC = (tbsData, hmacKey) =>
    subtle.sign(alg.name, hmacKey, tbsData).then(arrayBuffer2Uint8);

  doMAC = (tbhData) =>
    subtle.digest(alg.hash, StringConversion.rawStringToByteArray(tbhData)).then(arrayBuffer2Uint8);

  bitSlice = (arr, start, end) =>
    (end !== undefined ? arr.subarray(start / 8, end / 8) :
                         arr.subarray(start / 8));

  newEmptyArray = () => new Uint8Array(0);

  return {
    /**
     * hkdf - The HMAC-based Key Derivation Function
     *
     * @param {bitArray} ikm Initial keying material
     * @param {bitArray} info Key derivation data
     * @param {bitArray} salt Salt
     * @param {integer} length Length of the derived key in bytes
     * @return promise object- It will resolve with `output` data
     */
    hkdf: function(ikm, info, salt, length) {
      var numBlocks = Math.ceil(length / HASH_LENGTH);

      function doHKDFRound(roundNumber, prevDigest, prevOutput, hkdfKey) {
        // Do the data accumulating part of an HKDF round. Also, it
        // checks if there are still more rounds left and fires the next
        // Or just finishes the process calling the callback.
        function addToOutput(digest) {
          var output = prevOutput + StringConversion.byteArrayToHexString(digest);

          if (++roundNumber <= numBlocks) {
            return doHKDFRound(roundNumber, digest, output, hkdfKey);
          } else {
            return new Promise(function(resolve, reject) {
              var truncated = bitSlice(StringConversion.hexStringToByteArray(output), 0, length * 8);
              resolve(truncated);
            });
          }
        }
        var input = concatU8Array(
          concatU8Array(prevDigest, info),
          StringConversion.rawStringToByteArray(String.fromCharCode(roundNumber)));
        return doHMAC(input, hkdfKey).then(addToOutput);
      }

      return doImportKey(salt). // Imports the initial key
        then(doHMAC.bind(undefined, ikm)). // Generates the key deriving key
        then(doImportKey). // Imports the key deriving key
        then(doHKDFRound.bind(undefined, 1, newEmptyArray(), ''));
      // Launches the first HKDF round
    }
  };
})();
/* This Source Code Form is subject to the terms of the Mozilla Public
* License, v. 2.0. If a copy of the MPL was not distributed with this
* file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// WebCrypto-based client for Firefox Sync.

const HKDF_INFO_STR = 'identity.mozilla.com/picl/v1/oldsync';

// constructor
window.FxSyncWebCrypto = function() {
  // Basic check for presence of WebCrypto
  if (!window || !window.crypto || !window.crypto.subtle) {
    throw new Error('This environment does not support WebCrypto');
  }

  this.mainSyncKey = null;
  this.bulkKeyBundle = null;
};

function importKeyBundle(aesKeyAB, hmacKeyAB) {
  var pAes = window.crypto.subtle.importKey('raw', aesKeyAB,
                                        { name: 'AES-CBC', length: 256 },
                                        true, [ 'encrypt', 'decrypt' ]
                                  );
  var pHmac =  window.crypto.subtle.importKey('raw', hmacKeyAB,
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
window.FxSyncWebCrypto.prototype._importKb = function(kBByteArray) {
  // The number 64 here comes from (256 bits for AES + 256 bits for HMAC) / (8 bits per byte)
  return KeyDerivation.hkdf(kBByteArray, StringConversion.rawStringToByteArray(HKDF_INFO_STR), new Uint8Array(64), 64)
  .then(function (output) {
    var aesKeyAB = output.slice(0, 32).buffer;
    var hmacKeyAB = output.slice(32).buffer;
    return importKeyBundle(aesKeyAB, hmacKeyAB).then(function(keyBundle) {
      this.mainSyncKey = keyBundle;
    }.bind(this));
  }.bind(this));
};

window.FxSyncWebCrypto.prototype._verifySyncKeys = function(signedTextByteArray,
                                                              cryptoKeysHmacByteArray) {
  return crypto.subtle.verify({ name: 'HMAC', hash: 'AES-256' }, this.mainSyncKey.hmac,
                        cryptoKeysHmacByteArray, signedTextByteArray);
};

window.FxSyncWebCrypto.prototype._importSyncKeys = function(cryptoKeysIVByteArray,
                                                              cryptoKeysCiphertextByteArray) {
  return crypto.subtle.decrypt({ name: 'AES-CBC', iv: cryptoKeysIVByteArray }, this.mainSyncKey.aes,
                        cryptoKeysCiphertextByteArray).then(function (keyBundleAB) {
    var cryptoKeysJSON = String.fromCharCode.apply(null, new Uint8Array(keyBundleAB));
    try {
      this.bulkKeyBundle = JSON.parse(cryptoKeysJSON);
      return importKeyBundle(
          StringConversion.base64StringToByteArray(this.bulkKeyBundle.default[0]),
          StringConversion.base64StringToByteArray(this.bulkKeyBundle.default[1])
      ).then(function(keyBundle) {
        this.bulkKeyBundle.defaultAsKeyBundle = keyBundle;
      }.bind(this));
    } catch(e) {
      return Promise.reject('Deciphered crypto keys, but not JSON');
    }
  }.bind(this), function(err) {
    return Promise.reject('Could not decrypt crypto keys using AES part of stretched kB key');
  });
};

/*
 * setKeys - import kB and crypto/keys
 *
 * @param {String} kB Hex string with kB from FxA onepw protocol
 * @param {Object} cryptoKeys Object with:
 *                 - ciphertext {String} A Base64 String containing an AES-CBC ciphertext
 *                 - IV {String} A Base64 String containing the AES-CBC Initialization Vector
 *                 - hmac {String} A Hex String containing the HMAC-SHA256 signature
 * @returns {Promise} A promise that will resolve after import of kB and decryption of cryptoKeys.
 */
window.FxSyncWebCrypto.prototype.setKeys = function(kB, cryptoKeys) {
  var kBByteArray, cryptoKeysCiphertextByteArray, cryptoKeysIVByteArray, cryptoKeysHmacByteArray;
console.log('input checking', kB, cryptoKeys);
  // Input checking
  try {
    kBByteArray = StringConversion.hexStringToByteArray(kB);
  } catch (e) {
    return Promise.reject('Could not parse kB as a hex string');
  }
  try {
    cryptoKeysCiphertextByteArray = StringConversion.base64StringToByteArray(cryptoKeys.ciphertext);
  } catch (e) {
    return Promise.reject('Could not parse cryptoKeys.ciphertext as a base64 string');
  }
  try {
    cryptoKeysIVByteArray = StringConversion.base64StringToByteArray(cryptoKeys.IV);
  } catch (e) {
    return Promise.reject('Could not parse cryptoKeys.IV as a base64 string');
  }
  try {
    cryptoKeysHmacByteArray = StringConversion.hexStringToByteArray(cryptoKeys.hmac);
  } catch (e) {
    return Promise.reject('Could not parse cryptoKeys.hmac as a hex string');
  }

  return this._importKb(kBByteArray).then(function() {
    // Intentionally using StringConversion.rawStringToByteArray instead of StringConversion.base64StringToByteArray on the ciphertext here -
    // See https://github.com/mozilla/firefox-ios/blob/1cce59c8eac282e151568f1204ffbbcc27349eff/Sync/KeyBundle.swift#L178
    return this._verifySyncKeys(StringConversion.rawStringToByteArray(cryptoKeys.ciphertext),
                                                cryptoKeysHmacByteArray);
  }.bind(this)).then(function(verified) {
    if (verified) {
      return this._importSyncKeys(cryptoKeysIVByteArray, cryptoKeysCiphertextByteArray);
    } else {
      return Promise.reject('SyncKeys hmac could not be verified with current main key');
    }
  }.bind(this));
};

window.FxSyncWebCrypto.prototype.selectKeyBundle = function() {
  return this.bulkKeyBundle.defaultAsKeyBundle;
};

/*
 * decrypt - verify and decrypt a Weave Basic Object
 *
 * @param {Object} payload Object with:
 *                 - ciphertext {String} A Base64 String containing an AES-CBC ciphertext
 *                 - IV {String} A Base64 String containing the AES-CBC Initialization Vector
 *                 - hmac {String} A Hex String containing the HMAC-SHA256 signature
 * @param {String} collectionName String The name of the Sync collection (currently ignored)
 * @returns {Promise} A promise for the decrypted Weave Basic Object.
 */
window.FxSyncWebCrypto.prototype.decrypt = function(payload, collectionName) {
  var recordEnc, keyBundle;
  if (typeof payload !== 'string') {
    return Promise.reject('Payload is not a string');
  }
  if (typeof collectionName !== 'string') {
    return Promise.reject('collectionName is not a string');
  }
  try {
    recordEnc = JSON.parse(payload);
  } catch(e) {
    return Promise.reject('Payload is not a JSON string');
  }
  try {
    keyBundle = this.selectKeyBundle(collectionName);
  } catch(e) {
    return Promise.reject('No key bundle found for ' + collectionName + ' - did you call setKeys?');
  }
  return crypto.subtle.verify({ name: 'HMAC', hash: 'SHA-256' },
                              keyBundle.hmac, StringConversion.hexStringToByteArray(recordEnc.hmac),
                              StringConversion.rawStringToByteArray(recordEnc.ciphertext)
                             ).then(function (result) {
    if (!result) {
      return Promise.reject('Record verification failed with current hmac key for ' + collectionName);
    }
  }).then(function() {
    return crypto.subtle.decrypt({
      name: 'AES-CBC',
      iv: StringConversion.base64StringToByteArray(recordEnc.IV)
    }, keyBundle.aes, StringConversion.base64StringToByteArray(recordEnc.ciphertext)).then(function (recordArrayBuffer) {
      var recordObj;
      var recordJSON = String.fromCharCode.apply(null, new Uint8Array(recordArrayBuffer));
      try {
        recordObj = JSON.parse(recordJSON);
      } catch(e) {
        return Promise.reject('Deciphered record, but not JSON');
      }
      return recordObj;
    }, function(err) {
      return Promise.reject('Could not decrypt record using AES part of key bundle for collection ' + collectionName);
    });
  });
};

window.FxSyncWebCrypto.prototype._encryptAndSign = function(keyBundle, cleartext) {
  // Generate a random IV using the PRNG of the device
  var IV = new Uint8Array(16);
  window.crypto.getRandomValues(IV);
  return crypto.subtle.encrypt({
    name: 'AES-CBC',
    iv: IV
  }, keyBundle.aes, cleartext).then(ciphertext => {
    var ciphertextB64 = StringConversion.arrayBufferToBase64String(ciphertext);
    return crypto.subtle.sign({ name: 'HMAC', hash: 'SHA-256' },
                       keyBundle.hmac,
                       StringConversion.rawStringToByteArray(ciphertextB64)
                      ).then(hmac => {
      return JSON.stringify({
        hmac: StringConversion.arrayBufferToHexString(hmac),
        ciphertext: ciphertextB64,
        IV: StringConversion.byteArrayToBase64String(IV)
      });
    });
  });
};

/*
 * encrypt - encrypt and sign a record
 *
 * @param {Object} record Object The data to be JSON-stringified and stored
 * @param {String} collectionName String The name of the Sync collection (currently ignored)
 * @returns {Promise} A promise for the encrypted Weave Basic Object.
 */
window.FxSyncWebCrypto.prototype.encrypt = function(record, collectionName) {
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
    return Promise.reject('No key bundle found for ' + collectionName + ' - did you call setKeys?');
  }
  return this._encryptAndSign(keyBundle, cleartext);
};

//expose these for mocha tests:
window.FxSyncWebCrypto._stringConversion = StringConversion;
window.FxSyncWebCrypto._keyDerivation = KeyDerivation;
})(window);
