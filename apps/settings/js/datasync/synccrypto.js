(function() {
  var _mainSyncKey, _defaultDecryptionKey;

  // some util functions:
  function str2ba(str) {
    var buf = new ArrayBuffer(str.length); // 1 bytes for each char
    var bufView = new Uint8Array(buf);
    for (var i = 0, strLen = str.length; i < strLen; i++) {
      bufView[i] = str.charCodeAt(i);
    }
    return bufView;
  }

  function hexStringToByteArray(hexString) {
    if (hexString.length % 2 !== 0) {
      throw Error('Must have an even number of hex digits to convert to bytes');
    }
    var numBytes = hexString.length / 2;
    var byteArray = new Uint8Array(numBytes);
    for (var i = 0; i < numBytes; i++) {
      byteArray[i] = parseInt(hexString.substr(i * 2, 2), 16);
    }
    return byteArray;
  }

  function base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function fetchCollection(collection) {
    return App.ensureDb().then(function (db) {
      return db.collection(collection)
    }).then(function (result) {
      return result.list();
    });
  }
  
  //first, fetch kB from FxAccounts (we don't need kA), stretch it with hkdf, and import it into WebCrypto:
  function getMainSyncKey() {
    if (_mainSyncKey) {
      return Promise.resolve(_mainSyncKey);
    }
    return SyncCredentials.getKeys().then(function (syncCredentials) {
      return hexStringToByteArray(syncCredentials.kB);
    }).then(function (kB) {
      return window.hawkCredentials.then(function(hC) {
        return hC.hkdf(kB, str2ba('identity.mozilla.com/picl/v1/oldsync'), new Uint8Array(64), 64);
      });
    }).then(function (output) {
      _mainSyncKey = window.crypto.subtle.importKey('raw', output.slice(0, 32).buffer, {
        name: 'AES-CBC',
        length: 256
      }, true, [
        'encrypt',
        'decrypt'
      ]);
      return _mainSyncKey;
    }, function(err) {
      console.log('error getting main sync key', err);
    });
  }

  //with the main sync key we can decrypt the bundle of collection sync keys - for POC we assume the history collection is encrypted with the default collections key
  function getDefaultDecryptionKey() {
    if (_defaultDecryptionKey) {
      return Promise.resolve(_defaultDecryptionKey);
    }
    return getMainSyncKey().then(function(mainSyncKey) {
      return fetchCollection('sync').then(result => {
        //Make demo work: ;)
        result = {data: [{'id': 'keys',
          'modified': 1438880400.58,
          'payload': '{"ciphertext":"v6Q+y9yjkUgDCYdzSJhu+mqtvkGLVz1Rjd3uaxYpKvhTK4rG+uOeWTdmmMXOgEaE18meOhfFec9Xg7XZ4ylmjzzBuvbB6r25xUrFHxYTrlZP2jh2OilNGVqKZU1aQmbRLHXBz7OuMcf3PeJvnn8IOhaoQiBLuiMk3oZBJ245dIIqsmCNhq3b6m1eo4rkUGx5X5Ineyi1yOzLalAcYaurGg==","IV":"KM3guoZ7mYY1sFytBVRtOg==","hmac":"964673171f3fcc4b680a4e7e16261f71b209fb65b7bded56a4950318f00881eb"}'}]};
        console.log('Fetched the crypto collection to get the keys record', result);
        var firstCryptoCollObj = JSON.parse(result.data[0].payload);
 
        //assume the first object in the 'crypto' collection is the 'keys' record that we're looking for.
        //convert payload.ciphertext and payload.iv from base64:
        cryptoKeysCiphertext = base64ToArrayBuffer(firstCryptoCollObj.ciphertext);
        cryptoKeysIV = base64ToArrayBuffer(firstCryptoCollObj.IV);
        
        //try to decrypt crypto/keys with main sync key:
        return crypto.subtle.decrypt({
          name: 'AES-CBC',
          iv: cryptoKeysIV
        }, mainSyncKey, cryptoKeysCiphertext);
      }).then(function (keyBundleAB) {
        var keyBundleObj = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(keyBundleAB)));
        console.log('here is the keyBundle you were looking for:', keyBundleAB, window.keyBundleObj);
        return keyBundleObj;
      }).then(function (keyBundleObj) {
        _defaultDecryptionKey = crypto.subtle.importKey('raw', base64ToArrayBuffer(keyBundleObj.default[0]), {
          name: 'AES-CBC',
          length: 256
        }, true, [
          'decrypt'
        ]);
        console.log('created _defaultDecryptionKey', _defaultDecryptionKey);
        return _defaultDecryptionKey;
      });
    }, function(err) {
      console.log('error getting default decryption key', err);
    });
  }

  
  function decryptRecord(record) {
    var payload = JSON.parse(record.payload);
    return getDefaultDecryptionKey().then(function(defaultDecryptionKey) {
      console.log('defaultDecryptionKey', defaultDecryptionKey);
      return crypto.subtle.decrypt({
        name: 'AES-CBC',
        iv: base64ToArrayBuffer(payload.IV)
      }, defaultDecryptionKey, base64ToArrayBuffer(payload.ciphertext)).then(function (recordAB) {
        var recordObj = JSON.parse(String.fromCharCode.apply(null, new Uint8Array(recordAB)));
        return recordObj;
      });
    }, function (err) {
      console.log('error decrypting record', err);
    });
  }

 
  //...
  window.SyncCrypto = {
    fetchCollection: fetchCollection,
    decryptRecord: decryptRecord
  };
})();

