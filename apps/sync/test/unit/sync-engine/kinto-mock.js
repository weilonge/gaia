'use strict';

/* global SynctoServerFixture, sinon */
/* exported Kinto */

var Kinto = (function() {
  var KintoCollectionMock = function(collectionName) {
    var _remoteTransformerUsed = null;
    return {
      sync: sinon.stub().returns(Promise.resolve({ ok: true })),
      list: () => {
        var dataToReturn = JSON.parse(JSON.stringify({
          data: [
            SynctoServerFixture.remoteData[collectionName]
          ]
        }));
        if (_remoteTransformerUsed) {
          return _remoteTransformerUsed.decode(dataToReturn.data[0]).then(
              decoded => {
            dataToReturn.data[0] = decoded;
            return dataToReturn;
          });
        } else {
          return Promise.resolve(dataToReturn);
        }
      },
      use: sinon.spy((adapter) => {
        _remoteTransformerUsed = adapter;
      })
    };
  };
  var UnreachableKintoCollectionMock = function(collectionName) {
    return {
      sync: sinon.stub().returns(Promise.reject({ ok: false })),
      list: sinon.stub(),
      use: sinon.stub()
    };
  };
  var Kinto = function(options) {
    this.options = options;
    this.collection = sinon.spy(collectionName => {
      if (options.remote === 'http://localhost:8000/v1/') {
        return KintoCollectionMock(collectionName);
      } else {
        return UnreachableKintoCollectionMock(collectionName);
      }
    });
  };
  Kinto.transformers = {
    RemoteTransformer: function() {}
  };
  return Kinto;
})();
