/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  crypto,
  FxSyncWebCrypto,
  Kinto
*/

/* exported
  SyncEngine
*/

var SyncEngine = (function() {
  var FxSyncIdSchema = Kinto.createIdSchema({
    constructor: function(collectionName) {
      this.collectionName = collectionName;
    },
    generate: function() {
      var bytes = new Uint8Array(9);
      crypto.getRandomValues(bytes);
      var binStr = '';
      for (var i=0; i<9; i++) {
          binStr += String.fromCharCode(bytes[i]);
      }
      // See https://docs.services.mozilla.com/storage/apis-1.5.html
      return window.btoa(binStr).replace('+', '-').replace('/', '_');
    },
    validate: function(id) {
      if ((this.collectionName === 'bookmarks') &&
          (['menu', 'toolbar'].indexOf(id) !== -1)) {
        return true;
      }
      // FxSync id's should be 12 ASCII characters, representing 9 bytes of data
      // in modified Base64 for URL variants exist, where the '+' and '/'
      // characters of standard Base64 are respectively replaced by '-' and '_'
      // See https://docs.services.mozilla.com/storage/apis-1.5.html
      return /^[A-Za-z0-9-_]{12}$/.test(id);
    }
  });

  var ControlCollectionIdSchema = Kinto.createIdSchema({
    constructor: function(collectionName, keyName) {
      this.collectionName = collectionName;
      this.keyName = keyName;
    },
    generate: function() {
      return this.keyName;
    },
    validate: function(id) {
      return (id === this.keyName);
    }
  });

  var WebCryptoTransformer = Kinto.createRemoteTransformer({
    constructor: function(collectionName, fswc) {
      if (!fswc.bulkKeyBundle) {
        throw new Error(`Attempt to register Transformer with no bulk key bundl\
e!`);
      }
      this.collectionName = collectionName;
      this.fswc = fswc;
    },
    encode: function(record) {
      return this.fswc.encrypt(record.payload, this.collectionName)
      .then(payloadEnc => {
        record.payload = JSON.stringify(payloadEnc);
        return record;
      });
    },
    decode: function(record) {
      // Allowing JSON.parse errors to bubble up to the errors list in the
      // syncResults:
      if (typeof record.payload === 'object' && record.payload.id) {
        // If record.payload is an object which has a valid ID,
        // that means it's a decrypted record which can be returned.
        return record;
      }
      return this.fswc.decrypt(JSON.parse(record.payload), this.collectionName)
      .then(payloadDec => {
        record.payload = payloadDec;
        return record;
      });
    }
  });

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
    this._controlCollections = {};
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
      var addControlCollection = (collectionName, keyName) => {
        this._controlCollections[collectionName] =
            this._kinto.collection(collectionName);
        this._controlCollections[collectionName].use(
            new ControlCollectionIdSchema(collectionName, keyName));
      };
      addControlCollection('meta', 'global');
      addControlCollection('crypto', 'keys');
    },

    _getCollection: function(collectionName, isControlCollection=false) {
      return (isControlCollection ?
          this._controlCollections[collectionName] :
          this._collections[collectionName]);
    },

    _getItem: function(collectionName, itemName, isControlCollection=false) {
      return this._getCollection(collectionName, isControlCollection).get(
          itemName);
    },

    _resolveConflicts: function(collectionName, conflicts) {
      return Promise.all(conflicts.map(conflict => {
        var resolution = this._adapters[collectionName].handleConflict(
            conflict);
        return this._collections[collectionName].resolve(conflict, resolution);
      }));
    },

    _syncCollection: function(collectionName, isControlCollection=false) {
      var collection = this._getCollection(collectionName, isControlCollection);
      // Let synchronization strategy default to 'manual', see
      // http://kintojs.readthedocs.org \
      //     /en/latest/api/#fetching-and-publishing-changes

      return collection.sync()
      .catch(err => {
        throw err;
      }).then(syncResults => {
        console.log('Sync results', collectionName, syncResults);
        if (syncResults.ok) {
          return syncResults;
        } else {
          return Promise.reject(new SyncEngine.UnrecoverableError());
        }
      }).then(syncResults => {
        if (syncResults.conflicts.length) {
          return this._resolveConflicts(collectionName, syncResults.conflicts);
        }
      }).catch(err => {
        if (err instanceof TypeError) {
          throw new SyncEngine.UnrecoverableError();
        } else if (err instanceof Error && typeof err.request === 'object') {
          if (err.request.status === 401) {
            throw new SyncEngine.AuthError();
          } else {
            throw new SyncEngine.TryLaterError();
          }
        } else {
          throw new SyncEngine.UnrecoverableError();
        }
      });
    },

    _storageVersionOK: function(metaGlobal) {
      var payloadObj;
      try {
        payloadObj = JSON.parse(metaGlobal.data.payload);
      } catch(e) {
        return false;
      }
      return (typeof payloadObj === 'object' &&
          payloadObj.storageVersion === 5);
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
      return this._syncCollection('meta', true)
      .then(() => this._getItem('meta', 'global', true))
      .then(metaGlobal => {
        if (!this._storageVersionOK(metaGlobal)) {
          return Promise.reject(new SyncEngine.UnrecoverableError(`Incompatible\
 storage version or storage version not recognized.`));
        }
        return this._syncCollection('crypto', true);
      }).then(() => this._getItem('crypto', 'keys', true))
      .then((cryptoKeysRecord) => {
        var cryptoKeys;
        try {
          cryptoKeys = JSON.parse(cryptoKeysRecord.data.payload);
        } catch (e) {
          return Promise.reject(new SyncEngine.UnrecoverableError(`Could not pa\
rse crypto/keys payload as JSON`));
        }
        return cryptoKeys;
      }).then((cryptoKeys) => {
        //Cannot do this from the constructor because we need cryptoKeys first,
        //and it's not nice to return a promise from a constructor:
        return this._initFxSyncWebCrypto(cryptoKeys);
      });
    },

    registerAdapter: function(collectionName, adapter) {
      this._collections[collectionName] = this._kinto.collection(
          collectionName);
      this._collections[collectionName].use(new FxSyncIdSchema(
          collectionName));
      this._collections[collectionName].use(new WebCryptoTransformer(
          collectionName, this._fswc));
      this._adapters[collectionName] = adapter;
    },

    _updateCollection: function(collectionName) {
      return this._syncCollection(collectionName)
      .then(() => this._adapters[collectionName].update(
          this._collections[collectionName]))
      .then(() => this._syncCollection(collectionName));
    },

    syncNow: function() {
      var promises = [];
      for (var collectionName in this._collections) {
        promises.push(this._updateCollection(collectionName));
      }
      return Promise.all(promises);
    }
  };

  SyncEngine.UnrecoverableError = function() {
    this.message = 'unrecoverable';
  };
  SyncEngine.UnrecoverableError.prototype = Object.create(Error.prototype);

  SyncEngine.TryLaterError = function() {
    this.message = 'try later';
  };
  SyncEngine.UnrecoverableError.prototype = Object.create(Error.prototype);

  SyncEngine.AuthError = function() {
    this.message = 'unauthorized';
  };
  SyncEngine.UnrecoverableError.prototype = Object.create(Error.prototype);

  SyncEngine.DataAdapterClasses = {};

  return SyncEngine;
})();
