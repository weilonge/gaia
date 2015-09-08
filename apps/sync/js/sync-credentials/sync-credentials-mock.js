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

  getCredentials(adapters) {
    return this.getAssertion().then((assertion) => {
      return Promise.resolve({
        URL: 'http://localhost:8000/v1/',
        assertion: assertion,
        xClientState: '12251bc53911c4d189663528c8de7400',
        kB: 'ee01d31bd2966270b6e7ec11c658e599bcc114f4f15756159c3e2bf672393edc',
        adapters: adapters
      });
    });
  }
};
