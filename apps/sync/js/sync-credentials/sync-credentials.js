/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  IAC,
  navigator
*/

/* exported
  SyncCredentials
*/

var SyncCredentials = {
  _getAssertion() {
    console.log('SynCredentials._getAssertion() called');
    if (this._credentials.assertion) {
      return Promise.resolve();
    }
    var self = this;
    return new Promise((resolve, reject) => {
      navigator.mozId.watch({
        wantIssuer: 'firefox-accounts',
        audience: 'https://token.services.mozilla.com/',
        onlogin: function(assertion) {
          self._credentials.assertion = assertion;
          resolve();
        },
        onerror: function(error) {
          reject(error);
        },
        onlogout: function() {},
        onready: function() {}
      });
      navigator.mozId.request();
    });
  },

  _getKb() {
    console.log('SynCredentials._getKb() called');
    if (this._credentials.kB) {
      return Promise.resolve();
    }
    return IAC.request('sync-credentials', {
      method: 'getKeys'
    }).then(keys => {
      this._credentials.kB = keys.kB;
    });
  },

  _getXClientState() {
    console.log('SynCredentials._getXClientState() called');
    if (this._credentials.xClientState) {
      return Promise.resolve();
    }
    return IAC.request('sync-credentials', {
      method: 'getXClientState'
    }).then(xClientState => {
      this._credentials.xClientState = xClientState;
    });
  },

  getCredentials() {
    console.log('SynCredentials.getCredentials() called');
    if (this._credentials) {
      return Promise.resolve(this._credentials);
    }
    this._credentials = {};
    return this._getAssertion()
        .then(this._getKb.bind(this))
        .then(this._getXClientState.bind(this))
        .then(() => {
      return this._credentials;
    }, err => {
      console.error(err);
      this._credentials = null;
      throw err;
    });
  }
};
