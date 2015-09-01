var SyncCredentials = {
  _getAssertion() {
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
    if (!this._credentials) {
      this._credentials = {};
    }

    return this._getAssertion()
        .then(this._getKb.bind(this))
        .then(this._getXClientState.bind(this))
        .then(() => {
      return this._credentials;
    });
  }
};
