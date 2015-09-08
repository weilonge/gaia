/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * This is just a temporary IAC based API to allow the creation of a Syncto
 * client proof of concept.
 * We will expose the ability to obtain the Sync keys (kA and kB) and the
 * generation of the X-Client-State header. In the end, all this will only be
 * consumed by the System app, so there will be no need to expose anything.
 */

(function() {

  function sendPortMessage(portName, message) {
    var port = IACHandler.getPort(portName);
    if (port) {
      port.postMessage(message);
    }
  }

  function weaveCryptoRequest(id, method, args) {
    if (!WeaveCrypto[method]) {
      console.error('Wrong method ' + method);
      return;
    }

    (function(id) {
      WeaveCrypto[method].apply(WeaveCrypto, args).then(result => {
        sendPortMessage('weave-crypto', { id: id, result: result });
      }).catch(error => {
        sendPortMessage('weave-crypto', { id: id, error: error });
      });
    })(id);
  }

  function syncCredentialsRequest(id, method) {
    if (!SyncCredentials[method]) {
      console.error('Wrong method ' + method);
      return;
    }

    (function(id) {
      SyncCredentials[method]().then(result => {
        sendPortMessage('sync-credentials', { id: id, result: result });
      }).catch(error => {
        sendPortMessage('sync-credentials', { id: id, error: error });
      });
    })(id);
  }

  function syncHistroyRequest(id, method, args){
    if (!PlacesAdapter[method]) {
      console.error('Wrong method ' + method);
      return;
    }

    (function(id) {
      PlacesAdapter[method].apply(PlacesAdapter, args).then(result => {
        sendPortMessage('sync-history', { id: id, result: result });
      }).catch(error => {
        sendPortMessage('sync-history', { id: id, error: error });
      });
    })(id);
  }

  /**
   * We expect IAC requests of this form:
   * {
   *    id: <uuid>,
   *    method: <string>,
   *    args: <array>
   * }
   */
  function onPortMessage(portName, message) {
    if (!message || !message.detail) {
      console.error('Received wrong IAC message');
      return;
    }

    var id = message.detail.id;
    if (!id) {
      console.error('Missing id');
      return;
    }

    var args = message.detail.args;
    if (!args) {
      args = [];
    }
    if (!Array.isArray(args)) {
      args = [args];
    }

    switch(portName) {
      case 'weave-crypto':
        weaveCryptoRequest(id, message.detail.method, args);
        break;
      case 'sync-credentials':
        syncCredentialsRequest(id, message.detail.method);
        break;
      case 'sync-history':
        syncHistroyRequest(id, message.detail.method, args);
        break;
    }
  }

  window.addEventListener('iac-weave-crypto', message => {
    (function(message) {
      LazyLoader.load('js/sync/weave_crypto.js', () => {
        onPortMessage('weave-crypto', message);
      });
    })(message);
  });

  window.addEventListener('iac-sync-credentials', message => {
    (function(message) {
      LazyLoader.load('js/sync/sync_credentials.js', () => {
        onPortMessage('sync-credentials', message);
      });
    })(message);
  });

  window.addEventListener('iac-sync-history', message => {
    (function(message) {
      LazyLoader.load('js/sync/places_adapter.js', () => {
        onPortMessage('sync-history', message);
      });
    })(message);
  });

}());
