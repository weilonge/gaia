'use strict';

/* global SynctoServerFixture, sinon */
/* exported Kinto */

var Kinto = (function() {
  var KintoCollectionMock = function(collectionName) {
    this.collectionName = collectionName;
    this._remoteTransformerUsed = null;
    this.data = null;
  };
  KintoCollectionMock.prototype = {
    sync: function() {
      if (this._remoteTransformerUsed) {
        return this._remoteTransformerUsed.decode({ payload: '{}'}).then(
            decoded => {
          this.listData = {
            data: [
              decoded
            ]
          };
          return Promise.resolve({ ok: true });
        }, () => {
          this.listData = {
            data: [
            ]
          };
          return Promise.resolve({ ok: false });
        });
      }
      this.listData = {
        data: [
          JSON.parse(JSON.stringify(
              SynctoServerFixture.remoteData[this.collectionName]))
        ]
      };
      return Promise.resolve({ ok: true });
    },
    list: function() {
      return Promise.resolve(this.listData);
    },
    use: function(adapter) {
      this._remoteTransformerUsed = adapter;
    }
  };

  var UnreachableKintoCollectionMock = function() {};
  UnreachableKintoCollectionMock.prototype.sync =  sinon.stub()
      .returns(Promise.reject({ ok: false }));
  UnreachableKintoCollectionMock.prototype.list = sinon.stub();
  UnreachableKintoCollectionMock.prototype.use = sinon.stub();

  var HttpCodeKintoCollectionMock = function(status) {
    this.status = status;
  };
  HttpCodeKintoCollectionMock.prototype.sync = sinon.spy(function() {
    var err = new Error();
    err.request = {
      status: this.status
    };
    return Promise.reject(err);
  });
  HttpCodeKintoCollectionMock.prototype.list = sinon.stub();
  HttpCodeKintoCollectionMock.prototype.use = sinon.stub();

  var Kinto = function(options) {
    this.options = options;
    this.collection = function(collectionName) {
      var xClientStateParts = options.headers['X-Client-State'].split(' ');
      if (xClientStateParts[0] === 'respond') {
        return new HttpCodeKintoCollectionMock(
            parseInt(xClientStateParts[1]));
      } else if (options.remote === 'http://localhost:8000/v1/') {
          return new KintoCollectionMock(collectionName);
      } else {
        return new UnreachableKintoCollectionMock(collectionName);
      }
    };
  };
  Kinto.transformers = {
    RemoteTransformer: function() {}
  };
  return Kinto;
})();
