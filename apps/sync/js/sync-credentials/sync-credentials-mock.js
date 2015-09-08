/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* exported
  SyncCredentials
*/

var SyncCredentials = {
  getAssertion: function() {
    if (this._assertion) {
      return Promise.resolve(this._assertion);
    }
    var self = this;
    return new Promise((resolve, reject) => {
      navigator.mozId.watch({
        wantIssuer: 'firefox-accounts',
        audience: 'https://token.services.mozilla.com/',
        onlogin: function(assertion) {
          self._assertion = assertion;
          resolve(assertion);
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

  getCredentials() {
    return this.getAssertion().then((assertion) => {
      return Promise.resolve({
        URL: 'http://localhost:8000/v1/',
        assertion: assertion,
        xClientState: '736097fbe86585b1ca297b1c0f97f2cb',
        kB: '61b0c274b95b1e27507f4794a17caa6484378e30637b1c2cd9bac38c0f02e5b7'
      });
    });
  }
};
