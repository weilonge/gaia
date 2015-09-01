/* global StringConversion */
/* exported KeyDerivation */

'use strict';

var KeyDerivation = (function key_derivation() {
  // hash length is 32 because only SHA256 is used at this moment
  var HASH_LENGTH = 32;
  var subtle = window.crypto.subtle;

  var concatU8Array = (buffer1, buffer2) => {
    var aux = new Uint8Array(buffer1.byteLength + buffer2.byteLength);
    aux.set(new Uint8Array(buffer1), 0);
    aux.set(new Uint8Array(buffer2), buffer1.byteLength);
    return aux;
  };

  var alg = {
    name: 'HMAC',
    hash: 'SHA-256'
  };

  var doImportKey = (rawKey) => {
    return subtle.importKey('raw', rawKey, alg, false, ['sign']);
  };

  // Converts a ArrayBuffer into a ArrayBufferView (U8) if it's not that
  // already.
  var arrayBuffer2Uint8 = (buff) => {
    return buff.buffer && buff || new Uint8Array(buff);
  };

  var doHMAC = (tbsData, hmacKey) => {
    return subtle.sign(alg.name, hmacKey, tbsData).then(arrayBuffer2Uint8);
  };

  var bitSlice = (arr, start, end) => {
    return (end !== undefined ? arr.subarray(start / 8, end / 8) :
                         arr.subarray(start / 8));
  };

  var newEmptyArray = () => new Uint8Array(0);

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
          var output = prevOutput +
              StringConversion.byteArrayToHexString(digest);

          if (++roundNumber <= numBlocks) {
            return doHKDFRound(roundNumber, digest, output, hkdfKey);
          } else {
            return new Promise(function(resolve, reject) {
              var truncated = bitSlice(
                  StringConversion.hexStringToByteArray(output), 0,
                  length * 8);
              resolve(truncated);
            });
          }
        }
        var input = concatU8Array(
          concatU8Array(prevDigest, info),
          StringConversion.rawStringToByteArray(
               String.fromCharCode(roundNumber)));
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
