'use strict';

/* global Kinto, FxSyncWebCrypto */
/* exported SyncEngine */

var SyncEngine = (function() {
  function WebCryptoTransformer(setCollectionName, setFswc) {
    if (!setFswc.bulkKeyBundle) {
      throw new Error('Attempt to register Transformer with no bulk key ' +
          'bundle!');
    }
    this.collectionName = setCollectionName;
    this.fswc = setFswc;
  }
  WebCryptoTransformer.prototype =
      Kinto.transformers.RemoteTransformer.prototype;

  WebCryptoTransformer.prototype.encode = function(record) {
    return this.fswc.encrypt(record.payload, this.collectionName).then(
        payloadEnc => {
      record.payload = JSON.stringify(payloadEnc);
      return record;
    });
  };

  WebCryptoTransformer.prototype.decode = function(record) {
    // Allowing JSON.parse errors to bubble up to the errors list in the
    // syncResults:
    return this.fswc.decrypt(JSON.parse(record.payload), this.collectionName)
        .then(payloadDec => {
      record.payload = payloadDec;
      return record;
    });
  };

  var SyncEngine = function(options) {
    if (typeof options !== 'object') {
      throw new Error('options should be an Object');
    }
    if (typeof options.URL !== 'string') {
      throw new Error('options.URL should be a String');
    }
    if (typeof options.assertion !== 'string') {
      throw new Error('options.assertion should be a String');
    }
    if (typeof options.xClientState !== 'string') {
      throw new Error('options.xClientState should be a String');
    }
    if (typeof options.kB !== 'string') {
      throw new Error('options.kB should be a String');
    }
    this._kB = options.kB;
    this._collections = {};
    this._adapters = {};
    this._fswc = new FxSyncWebCrypto();
    this._initKinto({
       URL: options.URL,
       assertion: options.assertion,
       xClientState: options.xClientState
    });
  };

  SyncEngine.prototype = {
    _initKinto: function(kintoCredentials) {
      this._kinto = new Kinto({
        bucket: 'syncto',
        remote: kintoCredentials.URL,
        headers: {
          'Authorization': 'BrowserID ' + kintoCredentials.assertion,
          'X-Client-State': kintoCredentials.xClientState
        }
      });
      this._collections.meta = this._kinto.collection('meta');
      this._collections.crypto = this._kinto.collection('crypto');
    },


    _getItem: function(collectionName, itemName) {
      return this._collections[collectionName].get(itemName);
    },

    _getItemByIndex: function(collectionName, itemIndex) {
      return this._collections[collectionName].list().then(collRecords => {
        if (typeof collRecords === 'object' &&
            typeof collRecords.data === 'object' &&
            typeof collRecords.data[itemIndex] === 'object' &&
            typeof collRecords.data[itemIndex].payload !== 'undefined') {
          return {
            data: {
              payload: collRecords.data[itemIndex].payload
            }
          };
        } else {
          return null;
        }
      });
    },

    _syncCollection: function(collectionName) {
      // Let synchronization strategy default to 'manual', see
      // http://kintojs.readthedocs.org \
      //     /en/latest/api/#fetching-and-publishing-changes
      return this._collections[collectionName].sync()
        .then(syncResults => {
          if (syncResults.ok) {
            return syncResults;
          } else {
            return Promise.reject(syncResults);
          }
        })
        .catch(err => {
          if (err instanceof TypeError) {
            throw new SyncEngine.UnrecoverableError();
          } else if (err instanceof Error && typeof err.data === 'number') {
            if (err.request.status === 401) {
              throw new SyncEngine.AuthError();
            } else {
              throw new SyncEngine.TryLaterError();
            }
          } else {
            throw err;
          }
        });
    },

    _storageVersionOK: function(metaGlobal) {
      var payloadObj;
      if (typeof metaGlobal !== 'object' ||
          typeof metaGlobal.data !== 'object' ||
          typeof metaGlobal.data.payload !== 'string') {
        return false;
      }
      try {
        payloadObj = JSON.parse(metaGlobal.data.payload);
      } catch(e) {
        return false;
      }
      return (payloadObj.storageVersion === 5);
    },

    _initFxSyncWebCrypto: function(cryptoKeys) {
      this._fswc = new FxSyncWebCrypto();
      return this._fswc.setKeys(this._kB, cryptoKeys).then(() => {}, (err) => {
        if (err === 'SyncKeys hmac could not be verified with current main ' +
            'key') {
          throw new SyncEngine.UnrecoverableError();
        } else {
          throw err;
        }
      });
    },

    connect: function() {
      return this._syncCollection('meta').then(() => {
        // Alternative code to work around https://github.com \
        //     /mozilla-services/syncto/issues/6
        //
        // //this._getItem('meta', 'global').then(metaGlobal => {
        return this._getItemByIndex('meta', 0);
        //
      }).then(metaGlobal => {
        if (!this._storageVersionOK(metaGlobal)) {
          return Promise.reject('Incompatible storage version or storage ' +
              'version not recognized.');
        }
        return this._syncCollection('crypto');
      }).then(() => {
        // Alternative code to work around https://github.com \
        //     /mozilla-services/syncto/issues/6
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
      }).then(() => {}, (err) => {
        throw err;
      });
    },

    registerAdapter: function(collectionName, adapter) {
      this._collections[collectionName] = this._kinto.collection(
          collectionName);
      this._collections[collectionName].use(new WebCryptoTransformer(
          collectionName, this._fswc));
      this._adapters[collectionName] = adapter;
    },

    _updateCollection: function(collectionName) {
      return this._collections[collectionName].sync().then(syncResults => {
        if (syncResults.ok) {
          if (typeof this._adapters[collectionName] !== 'undefined') {
            return this._adapters[collectionName].update(
              this._collections[collectionName]);
          } else {
            return syncResults;
          }
        } else {
          for (var i=0; i<syncResults.errors.length; i++) {
            if (syncResults.errors[i] === 'payload.ciphertext is not a ' +
                'Base64 string') {
              throw new SyncEngine.UnrecoverableError();
            }
          }
        }
      });
    },

    syncNow: function() {
      var promises = [];
      //TODO: decide if we really want to include 'global' and 'crypto' in this:
      for (var collectionName in this._collections) {
        promises.push(this._updateCollection(collectionName));
      }
      return Promise.all(promises);
      //TODO:
      //push changes after adapter.update finishes
      //call handleConflict for each entry in results[i].conflicts
      //push conflict resolutions
    }
  };

  SyncEngine.UnrecoverableError = function() {};
  SyncEngine.UnrecoverableError.prototype = Error;

  SyncEngine.TryLaterError = function() {};
  SyncEngine.TryLaterError.prototype = Error;

  SyncEngine.AuthError = function() {};
  SyncEngine.AuthError.prototype = Error;

  return SyncEngine;
})();
