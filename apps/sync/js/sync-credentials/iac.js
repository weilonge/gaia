/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  navigator
*/

/* exported
  IAC
*/

var IAC = {
  _ports: {},

  connect: function(portName) {
    if (this._ports[portName]) {
      return Promise.resolve(this._ports[portName]);
    }

    return new Promise((resolve, reject) => {
      navigator.mozApps.getSelf().onsuccess = event => {
        var app = event.target.result;
        app.connect(portName).then(ports => {
          if (!ports || !ports.length) {
            return reject();
          }
          this._ports[portName] = ports[0];
          resolve(this._ports[portName]);
        }).catch(reject);
      };
    });
  },

  request: function(portName, message) {
    return new Promise((resolve, reject) => {
      message.id = Date.now();

      var onmessage = (event) => {
        if (!event || !event.data) {
          return reject();
        }
        if (event.data.id != message.id) {
          return;
        }
        resolve(event.data.result);
      };

      this.connect(portName).then(port => {
        if (port) {
          port.postMessage(message);
          port.onmessage = onmessage;
        } else {
          console.error('No ' + portName + ' port');
          reject();
        }
      });
    });
  }
};
