var SyncEngine = (function() {

  function WebCryptoTransformer(setCollectionName, setFswc) {
    this.collectionName = setCollectionName;
    this.fswc = setFswc;
  }
  WebCryptoTransformer.prototype = Kinto.transformers.RemoteTransformer.prototype;
 
  WebCryptoTransformer.prototype.encode = function(record) {
    return this.fswc.encrypt(record.payload, this.collectionName).then(payloadEnc => {
      record.payload = payloadEnc;
      return record;
    });
  };
 
  WebCryptoTransformer.prototype.decode = function(record) {
    return this.fswc.decrypt(record.payload, this.collectionName).then(payloadDec => {
      record.payload = payloadDec;
      return record;
    });
  };

  var SyncEngine = function(synctoCredentials, encryptedCollectionNames, kB) {
    if (typeof synctoCredentials !== 'object') {
      throw new Error('assertion should be an Object');
    }
    if (typeof synctoCredentials.URL !== 'string') {
      throw new Error('synctoCredentials.URL should be a String');
    }
    if (typeof synctoCredentials.assertion !== 'string') {
      throw new Error('synctoCredentials.assertion should be a String');
    }
    if (typeof synctoCredentials.xClientState !== 'string') {
      throw new Error('synctoCredentials.xClientState should be a String');
    }
    if (!(encryptedCollectionNames instanceof Array)) {
      throw new Error('encryptedCollectionNames should be an Array');
    }
    if (typeof kB !== 'string') {
      throw new Error('kB should be a String');
    }
    this._fswc = new FxSyncWebCrypto();
    this._initKinto(synctoCredentials, ['meta', 'crypto'], encryptedCollectionNames);
    this._encryptedCollectionNames = encryptedCollectionNames;
    this._kB = kB;
  };

  SyncEngine.prototype._initKinto = function(synctoCredentials, cleartextCollectionNames, encryptedCollectionNames) {
    this._kinto = new Kinto({
      bucket: 'syncto',
      remote: synctoCredentials.URL,
      headers: {
        'Authorization': 'BrowserID ' + synctoCredentials.assertion,
        'X-Client-State': synctoCredentials.xClientState
      }
    });

    //create Kinto collection objects in this._collections:
    var allCollectionNames = cleartextCollectionNames.concat(encryptedCollectionNames);
    this._collections = {};
    allCollectionNames.map((collectionName) => {
      this._collections[collectionName] = this._kinto.collection(collectionName);
    });
  };


  SyncEngine.prototype._getItem = function(collectionName, itemName) {
    return this._collections[collectionName].get(itemName);
  };

  SyncEngine.prototype._getItemByIndex = function(collectionName, itemIndex) {
    return this._collections[collectionName].list().then(collRecords => {
      return {
        data: {
          payload: collRecords.data[itemIndex].payload
        }
      };
    });
  };

  SyncEngine.prototype._syncCollection = function(collectionName) {
    this._collections[collectionName].sync({strategy: 'server wins'});
  };

  SyncEngine.prototype._checkStorageFormatOK = function(metaGlobal) {
    return Promise.resolve('not implemented yet');
  };

  SyncEngine.prototype._initFxSyncWebCrypto = function(cryptoKeys) {
    this._fswc = new FxSyncWebCrypto();
    return this._fswc.setKeys(this._kB, cryptoKeys);
  };

  SyncEngine.prototype.connect = function() {
    return this._collections.meta.sync().then(() => {
      // Alternative code to work around https://github.com/mozilla-services/syncto/issues/6
      //
      // //this._getItem('meta', 'global').then(metaGlobal => {
      return this._getItemByIndex('meta', 0);
      //
    }).then(metaGlobal => {
      return this._checkStorageFormatOK(metaGlobal);
    }).then(() => {
      return this._collections.crypto.sync();
    }).then(() => {
      // Alternative code to work around https://github.com/mozilla-services/syncto/issues/6
      //
      // //return this._fetchItem('crypto', 'keys');
      return this._getItemByIndex('crypto', 0);
      //

    }).then((cryptoKeysRecord) => {
      var cryptoKeys;
      try {
        cryptoKeys = JSON.parse(cryptoKeysRecord.data.payload);
      } catch (e) {
        return Promise.reject('Could not parse crypto/keys payload as JSON');
      }
      return cryptoKeys;
    }).then((cryptoKeys) => {
      //Cannot do this from the constructor because we need cryptoKeys first,
      //and it's not nice to return a promise from a constructor:
      return this._initFxSyncWebCrypto(cryptoKeys);
    }).then(() => {
      //install transformers for encrypted collections:
      this._encryptedCollectionNames.map(collectionName => {
        this._collections[collectionName].use(new WebCryptoTransformer(collectionName, this._fswc));
      });
    });
  };

  SyncEngine.prototype.syncNow = function() {
    var promises = [];
    //TODO: decide if we really want to include 'global' and 'crypto' in this:
    for (var collectionName in this._collections) {
      promises.push(this._collections[collectionName].sync());
    }
    return Promise.all(promises).then((results) => {
      //...
    });
  };

  return SyncEngine;
})();

//...
window.SyncEngine = SyncEngine;
