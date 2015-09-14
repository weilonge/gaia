/* global SettingsHelper */
/* global LazyLoader */

'use strict';

const REMOTE = "http://localhost:8000/v1/"

function toCamelCase(str) {
  var rdashes = /-(.)/g;
  return str.replace(rdashes, (str, p1) => {
    return p1.toUpperCase();
  });
}

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

var CryptoAPI = {
  encrypt: function(clearText, symmetricKey, iv) {
    return IAC.request('weave-crypto', {
      method: 'encrypt',
      args: [clearText, symmetricKey, iv]
    });
  },
  decrypt: function(cypherText, symmetricKey, iv) {
    return IAC.request('weave-crypto', {
      method: 'decrypt',
      args: [cypherText, symmetricKey, iv]
    });
  },
  generateRandomIV: function() {
    return IAC.request('weave-crypto', {
      method: 'generateRandomIV'
    });
  }
};

var SyncCredentials = {
  getKeys() {
    if (this._credentials) {
      console.log(this._credentials);
      return Promise.resolve(this._credentials);
    }

    return IAC.request('sync-credentials', {
      method: 'getKeys'
    }).then(credentials => {
      this._credentials = credentials;
      return this._credentials;
    });
  },
  getXClientState() {
    return IAC.request('sync-credentials', {
      method: 'getXClientState'
    });
  }
};

define('fxsync', ['modules/settings_utils', 'shared/settings_listener'
], function(SettingsUtils, SettingsListener) {
  var FxSync = {
    _adapters: {},
    _credentialCache: {},
    init: function fmd_init() {
      this.syncButton = document.querySelector('#sync-button');
      this.syncButton.
        addEventListener('click', FxSync.syncHistory.bind(FxSync));
      SyncCrypto.assignApp(FxSync);
      this.registerAdapter('history', SynctoHistoryAdapter);
    },

    registerAdapter: function(collectionName, adapter) {
      this._adapters[collectionName] = adapter;
    },

    ensureDb: function(assertion) {
      return this.getAssertion().then(assertion => {
        if (this._db) {
          return this._db;
        }
        return SyncCredentials.getXClientState().then(xClientState => {
          this._credentialCache = {
            synctoCredentials: {
             URL: REMOTE,
             assertion: assertion,
             xClientState: xClientState
            }
          };

          this._db = new Kinto({
            bucket: 'syncto',
            remote: REMOTE,
            headers: {
              "Authorization": "BrowserID " + assertion,
              // XXX use generated client state
              "X-Client-State": xClientState
            }
          });
          return this._db;
        });
      });
    },

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

    getTabsCollection() {
      if (this._tabs) {
        return Promise.resolve(this._tabs);
      }
      return this.ensureDb().then(db => {
        this._tabs = db.collection('tabs');
        return this._tabs;
      });
    },

    renderTabs: function() {
      // Ideally we should store the data unencrypted instead of doing
      // the decryption while rendering it on the screen, but whatever,
      // this is just a prototype...
      SyncCredentials.getKeys().then(credentials => {
        this.getTabsCollection().then(tabsCollection => {
          return tabsCollection.list();
        }).then(result => {
          var tabs = result.tabs;
          tabs.forEach(tab => {
            var payload = JSON.parse(payload);
            CryptoAPI.decrypt(payload.cypherText, payload.iv);
          });
        });
      });
    },

    syncTabs: function() {
      this.getTabsCollection().then(tabs =>{
        console.log('Tabs ', tabs);
        tabs.sync().then(result => {
          console.log('Sync results ', result);
          this.renderTabs();
        }).catch(error => {
          console.error(error);
        });
      });
    },

    // ==== History ====
    getHistoryCollection() {
      if (this._history) {
        return Promise.resolve(this._history);
      }
      return this.ensureDb().then(db => {
        SyncCredentials.getKeys().then(credentials => {
          console.log('credentials');
          console.log(credentials);
          document.querySelector('#sync-account').textContent = credentials.email;
        });

        this._history = db.collection('history');
        return this._history;
      });
    },

    storeHistoryToDS: function(historyCollection) {
      this.getHistoryCollection().then(coll => {
        return coll.list();
      }).then(recordsData => {
        var historyRecords = recordsData.data;
        var partialRecoreds = historyRecords.slice(0, 10);
        partialRecoreds.forEach(function (encryptedRecord){

          SyncCrypto.decryptRecord(encryptedRecord).then(function(record) {
            console.log('decrypted first record', record);

            if(!record.histUri || !record.visits || !record.visits[0]){
              console.log('invalid history: ', record);
              return ;
            }

            var visits = [];
            record.visits.forEach(function (elem){
              visits.push(elem.date);
            });

            var place = {
              url: record.histUri,
              title: record.title,
              visits: visits,
              visited: record.visits[0]
            };
            HistoryAdapter.addPlace(place).then(function (d){
              console.log(d);
            }, function (e){
              console.log(e);
            });
            document.querySelector('#sync-time').textContent =
              new Date().toString();
          });

        });
      });
     },

    syncHistory: function() {
      console.log('Retrieving history collection... this may take several minutes on first run');
      this.ensureDb().then(db => {
        SyncCredentials.getKeys().then(credentials => {
          this._credentialCache.kB = credentials.kB;
          console.log('      assertion: \'' + this._credentialCache.synctoCredentials.assertion + '\',');
          console.log('      xClientState: \'' + this._credentialCache.synctoCredentials.xClientState + '\',');
          console.log('      kB: \'' + this._credentialCache.kB + '\'');
          document.querySelector('#sync-account').textContent = credentials.email;

          var se = new SyncEngine(this._credentialCache.synctoCredentials, ['history'], this._credentialCache.kB);
          se.connect().then(() => {
            return se.syncNow();
          }).then(() => {
            this._adapters.history.update(se._collections.history).then(() => {
              document.querySelector('#sync-time').textContent =
                new Date().toString();
            });
          });
        });
      });
    },

    testHistory: function () {
      console.log('testHistory');
      /*
      Object {
        url: "https://www.mozilla.org/en-US/",
        title: "",
        icons: Object,
        frecency: 3,
        visits: Array[2],   #### Array [ 1438614210311, 1438450706238 ]
        screenshot: Blob,
        visited: 1438614210311
      }
      */
      var place = {
        url: 'http://www.mozilla.org/en-US/',
        title: "",
        frecency: 3,
        visits: [ 1438614210311, 1438450706238 ],
        visited: 1438614210311
      }; // TODO
      HistoryAdapter.addPlace(place).then(function (d){
        console.log(d);
      }, function (e){
        console.log(e);
      });
    }

  };

  return FxSync;
});

navigator.mozL10n.once(function() {
  require(['fxsync'], function(FxSync) {
    FxSync.init();
  });
});
