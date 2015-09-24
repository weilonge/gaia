/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* exported
  SyncCredentials
*/

var SyncCredentials = {
  getAssertion: function() {
    this._assertion = 'eyJhbGciOiJSUzI1NiJ9.eyJwdWJsaWMta2V5Ijp7ImFsZ29yaXRobSI6IkRTIiwieSI6IjNEOEU2Mjc2MDZDMUJDNjAyOEJDMjJDRDRDRkQ3NkY1QzdDOTMxNEJGNEIzMjJERjYzRUQzODI5NjJBODYzQTk5M0YyM0FFNTFDMTIwOENERjUwNUVBQzYwNkUxRjI3NDBBRDFERDA1Qjc3MjEyMUI0QkE5MjZGMDVBOUMyRjJEMTEyOUNERThCNzEzMzg4MkMwRjY2NTIwRTREMkI0NDVCMzI3RDE3OEM3OEJFQTYxNDRFRTRERTQ4MzFDRkZCMEEyQjhGRDhDMTRFOTI4MUNGRTdBQjZBRkExMTlDODZDNzI0MTUzRUJCMTgwRTBBOTVBNzQxOUU4OTAwNDFFMjMiLCJwIjoiRkY2MDA0ODNEQjZBQkZDNUI0NUVBQjc4NTk0QjM1MzNENTUwRDlGMUJGMkE5OTJBN0E4REFBNkRDMzRGODA0NUFENEU2RTBDNDI5RDMzNEVFRUFBRUZEN0UyM0Q0ODEwQkUwMEU0Q0MxNDkyQ0JBMzI1QkE4MUZGMkQ1QTVCMzA1QThEMTdFQjNCRjRBMDZBMzQ5RDM5MkUwMEQzMjk3NDRBNTE3OTM4MDM0NEU4MkExOEM0NzkzMzQzOEY4OTFFMjJBRUVGODEyRDY5QzhGNzVFMzI2Q0I3MEVBMDAwQzNGNzc2REZEQkQ2MDQ2MzhDMkVGNzE3RkMyNkQwMkUxNyIsInEiOiJFMjFFMDRGOTExRDFFRDc5OTEwMDhFQ0FBQjNCRjc3NTk4NDMwOUMzIiwiZyI6IkM1MkE0QTBGRjNCN0U2MUZERjE4NjdDRTg0MTM4MzY5QTYxNTRGNEFGQTkyOTY2RTNDODI3RTI1Q0ZBNkNGNTA4QjkwRTVERTQxOUUxMzM3RTA3QTJFOUUyQTNDRDVERUE3MDREMTc1RjhFQkY2QUYzOTdENjlFMTEwQjk2QUZCMTdDN0EwMzI1OTMyOUU0ODI5QjBEMDNCQkM3ODk2QjE1QjRBREU1M0UxMzA4NThDQzM0RDk2MjY5QUE4OTA0MUY0MDkxMzZDNzI0MkEzODg5NUM5RDVCQ0NBRDRGMzg5QUYxRDdBNEJEMTM5OEJEMDcyREZGQTg5NjIzMzM5N0EifSwicHJpbmNpcGFsIjp7ImVtYWlsIjoiMDk2ODA2MDE3ZTViNGY0MmFjYTQ2ZWY3YjdmMTQxYWZAYXBpLmFjY291bnRzLmZpcmVmb3guY29tIn0sImlhdCI6MTQ0MzA5MDY3NTMyNCwiZXhwIjoxNDQzMTEyMjg1MzI0LCJmeGEtZ2VuZXJhdGlvbiI6MTQ0MjU2MzY4MjUzNCwiZnhhLWxhc3RBdXRoQXQiOjE0NDMwOTA2ODQsImZ4YS12ZXJpZmllZEVtYWlsIjoiZ29vZGx1Y2tAbWFpbGluYXRvci5jb20iLCJpc3MiOiJhcGkuYWNjb3VudHMuZmlyZWZveC5jb20ifQ.ljpYroaIsKMva0H-ELjVvMAwYbnfIqMAz8KAMBKJONyeadGXbpoL-qT7YZfLD78ljC4gvXLIgV2XhMBKg9_I2h3TROSIcXI5GnGJmibdaRT3wDoviItuH8AwqvpgqZ2pdYTTVzKdmFayE3ZulBH9cs-0cc7PD4NV0VDEw7-OsjmmAIpRAa8WTdiv-FdYAT_Q0K2aOH7lWQ3BzTretJigHjOFY4QDIcpIOSHkGtiW6qT52pBaFYth9HwkAu9uc9MTwDMWIu6_l2uVcKV7Pw03IOFctBWXx5m7lG9TcBl9_sWRTeA8x1tq2fpvdlnM9QlSzuC36wP8tSH0b-5snKM1lA~eyJhbGciOiJEUzEyOCJ9.eyJleHAiOjIyMzE0OTA2ODUyNDksImF1ZCI6Imh0dHBzOi8vdG9rZW4uc2VydmljZXMubW96aWxsYS5jb20vIn0=.RtJVBaZCuZk8tirbwArJFNNwKIgnqcE33Xv-tOIxPMWfBms7anbxcg=='; // jshint ignore:line
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
        xClientState: '611c7e96a16778e40016504c1928fc57',
        kB: '67285b9b5567d0702b6d87e067891480505dcd0ca013cb0b6f8996160e602b89',
        adapters: adapters
      });
    });
  }
};
