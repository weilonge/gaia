/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  LazyLoader,
  SyncEngine,
  SyncCredentials
*/

/* exported
  App
*/

var App = {
  loadScripts: function() {
    return new Promise(function(resolve, reject) {
      LazyLoader.load([
        'js/sync-credentials/iac.js',
        //'js/sync-credentials/sync-credentials.js',
        'js/sync-credentials/sync-credentials-mock.js',

        'js/crypto/stringconversion.js',
        'js/crypto/keyderivation.js',
        'js/crypto/fxsyncwebcrypto.js',

        'js/ext/kinto.dev.js',
        'js/sync-engine/syncengine.js'
      ], resolve);
    });
  },

  init: function() {
    document.getElementById('sync-button')
      .addEventListener('click', App.sync.bind(App));
  },

  _connectSyncEngine: function() {
    if (this._syncEngine) {
      return Promise.resolve();
    }
    return SyncCredentials.getCredentials().then(credentials => {
      this._syncEngine = new SyncEngine(credentials);
      return this._syncEngine.connect();
    });
  },

  loadAdapter(collectionName) {
    return new Promise((resolve, reject) => {
      LazyLoader.load([`js/adapters/${collectionName}-mock.js`], () => {
        this._syncEngine.registerAdapter(collectionName,
            SyncEngine.DataAdapterClasses[collectionName]);
        resolve();
      });
    });
  },

  sync: function() {
    console.log('Syncing...');
    return this.loadScripts().then(() => {
      return this._connectSyncEngine();
    }).then(() => {
      return Promise.all([
        this.loadAdapter('history'),
        //this.loadAdapter('passwords'),
        //this.loadAdapter('bookmarks'),
        //this.loadAdapter('tabs')
      ]);
    }).then(() => {
      return this._syncEngine.syncNow();
    }).then(() => {
      console.log('Sync success.');
    }, err => {
      console.error('Sync failure.', err);
    });
  }
};

App.init();
