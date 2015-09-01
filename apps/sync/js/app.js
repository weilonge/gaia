var App = {
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
    return this._getSyncEngine()
        .then(this._syncEngine.syncNow.bind(this._syncEngine));
  }
};
