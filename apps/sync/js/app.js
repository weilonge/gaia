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
        'js/sync-credentials/sync-credentials.js',

        'js/fxsync-webcrypto/stringconversion.js',
        'js/fxsync-webcrypto/keyderivation.js',
        'js/fxsync-webcrypto/fxsyncwebcrypto.js',

        'js/ext/kinto.dev.js',
        'js/sync-engine/syncengine.js'
      ], resolve);
    });
  },

  init: function() {
    document.getElementById('sync-button')
      .addEventListener('click', App.sync.bind(App));
  },

  _getSyncEngine: function() {
    if (this._syncEngine) {
      return Promise.resolve();
    }
    return SyncCredentials.getCredentials().then(credentials => {
      this._syncEngine = new SyncEngine(credentials);
      return this._syncEngine.connect();
    });
  },

  sync: function() {
    return this.loadScripts()
        .then(this._getSyncEngine.bind(this))
        .then(() => {
          return this._syncEngine.syncNow.bind(this._syncEngine);
        }, err => {
          console.error(err);
        });
  }
};

//...
console.log('calling App.init();');
App.init();
