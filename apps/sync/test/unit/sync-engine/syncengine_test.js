/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global SyncEngine, SynctoServerFixture, AdapterMock,
   suite, test, requireApp, suite, test, expect */

requireApp('sync/test/unit/fixtures/synctoserver.js');
requireApp('sync/test/unit/sync-engine/fxsyncwebcrypto-mock.js');
requireApp('sync/test/unit/sync-engine/kinto-mock.js');
requireApp('sync/test/unit/sync-engine/adapter-mock.js');
requireApp('sync/js/sync-engine/syncengine.js');

function cloneObject(obj) {
  return JSON.parse(JSON.stringify(obj));
}

suite('SyncEngine', function() {
  this.timeout(1000);
  suite('constructor', function() {
    test('constructs a SyncEngine object', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      expect(se).to.be.an('object');
      expect(se._fswc).to.be.an('object');
      expect(se._kinto).to.be.an('object');
      expect(se._collections).to.be.an('object');
      expect(se._controlCollections).to.be.an('object');
      expect(se._adapters).to.be.an('object');
      done();
    });
  });
  suite('connect', function() {
    test('resolves its promise', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      expect(se.connect()).to.eventually.equal(undefined).
             and.notify(done);
    });
    ['URL', 'assertion', 'xClientState', 'kB'].forEach(function(field) {
      test(`rejects its promise if ${field} is wrong`, function(done) {
        var credentials = cloneObject(
            SynctoServerFixture.testServerCredentials);
        credentials[field] = 'whoopsie';
        var se = new SyncEngine(credentials);
        se.connect().then(() => {
          expect(false, 'SyncEngine#connect should have rejected its promise');
        }, (err) => {
          if (['assertion', 'xClientState'].indexOf(field) !== -1) {
            expect(err).to.be.instanceOf(SyncEngine.AuthError);
          } else {
            expect(err).to.be.instanceOf(SyncEngine.UnrecoverableError);
          }
          done();
        });
      });
    });
    ['meta', 'crypto'].forEach(function(collectionName) {
      [
        '401',
        '404',
        '500',
        '503',
        'wrong-payload-meta',
        'wrong-payload-crypto',
        'wrong-ciphertext',
        'wrong-id'
      ].forEach(function(problem) {
        test(`Rejects its promise if ${collectionName} response is ${problem}`,
            function(done) {
          var credentials = cloneObject(
              SynctoServerFixture.testServerCredentials);
          credentials.xClientState = `${collectionName} ${problem}`;
          var se = new SyncEngine(credentials);
          se.connect().then(() => {
            expect(false, 'SyncEngine#connect should have rejected promise');
          }, (err) => {
            if (problem === '401') {
              expect(err.message).to.equal('unauthorized');
            } else if (['404', '500', '503'].indexOf(problem) !== -1) {
              expect(err.message).to.equal('try later');
            } else {
              expect(err.message).to.equal('unrecoverable');
            }
            done();
          });
        });
      });
    });
  });
  suite('syncNow', function() {
    test('retrieves and decrypts the remote data', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      se.connect().then(() => {
        se.registerAdapter('history', AdapterMock());
        return se.syncNow();
      }).then(() => {
        expect(se._collections.history).to.be.an('object');
        return se._collections.history.list();
      }).then(list => {
        expect(list).to.be.an('object');
        expect(list.data).to.be.instanceOf(Array);
        expect(list.data.length).to.equal(1);
        expect(list.data[0]).to.be.an('object');
        expect(list.data[0].payload).to.be.an('object');
        expect(list.data[0].payload.histUri).to.be.a('string');
        done();
      });
    });
    [
      '401',
      '404',
      '500',
      '503',
      'wrong-payload-history',
      'wrong-ciphertext',
      'wrong-id'
    ].forEach(problem => {
      test(`rejects its promise if response is ${problem}`, function(done) {
        var options = {
          URL: SynctoServerFixture.testServerCredentials.URL,
          assertion: SynctoServerFixture.testServerCredentials.assertion,
          xClientState: `history ${problem}`,
          kB: SynctoServerFixture.testServerCredentials.kB
        };
        var se = new SyncEngine(options);
        se.connect()
        .then(() => {
          se.registerAdapter('history', AdapterMock());
          return se.syncNow();
        }, (err) => {
          expect(false, 'Problem before SyncNow');
        }).then(() => {
          expect(false, 'SyncEngine#syncNow should have rejected its promise');
        }, (err) => {
          if (problem === '401') {
            expect(err.message).to.equal('unauthorized');
          } else if (['404', '500', '503'].indexOf(problem) !== -1) {
            expect(err.message).to.equal('try later');
          } else {
            expect(err.message).to.equal('unrecoverable');
          }
          done();
        });
      });
    });
    test('encrypts and pushes added records', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      se.connect().then(() => {
        se.registerAdapter('history', AdapterMock('create', [ { foo: 'bar'} ]));
        return se.syncNow();
      }).then(() => {
        return se._collections.history.list();
      }).then(list => {
        expect(list.data.length).to.equal(2);
        expect(se._collections.history.pushData.length).to.equal(2);
        expect(list.data[0].payload.histUri).to.be.a('string');
        expect(list.data[1].payload.foo).to.equal('bar');
        done();
      });
    });
    test('enforces FxSyncIdSchema on added records', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      se.connect().then(() => {
        se.registerAdapter('history', AdapterMock('create', [
          { foo: 'bar'},
          { forceId: 'wrong' }
        ]));
        return se.syncNow();
      }).then(() => {
        expect(false, 'SyncEngine#syncNow should have rejected its promise');
      }, (err) => {
        expect(err.message).to.be.equal('Invalid id: wrong');
        done();
      });
    });
    test('encrypts and pushes updated records', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      se.connect().then(() => {
        se.registerAdapter('history', AdapterMock('update', [ {
          id: SynctoServerFixture.remoteData.history.id,
          foo: 'bar'
        } ]));
        return se.syncNow();
      }).then(() => {
        return se._collections.history.list();
      }).then(list => {
        expect(list.data.length).to.equal(1);
        expect(se._collections.history.pushData.length).to.equal(1);
        expect(list.data[0].foo).to.be.a('string');
        done();
      });
    });
    test('pushes deletes of records', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      se.connect().then(() => {
        se.registerAdapter('history', AdapterMock('delete', [
          SynctoServerFixture.remoteData.history.id
        ]));
        return se.syncNow();
      }).then(() => {
        return se._collections.history.list();
      }).then(list => {
        expect(list.data.length).to.equal(0);
        expect(se._collections.history.pushData.length).to.equal(0);
        done();
      });
    });
    test('encrypts and pushes conflict resolutions', function(done) {
      var credentials = cloneObject(
          SynctoServerFixture.testServerCredentials);
      credentials.xClientState = `history conflicts`;
      var se = new SyncEngine(credentials);
      se.connect().then(() => {
        se.registerAdapter('history', AdapterMock());
        return se.syncNow();
      }).then(() => {
        return se._collections.history.list();
      }).then(list => {
        expect(list.data.length).to.equal(1);
        expect(list.data[0].bar).to.equal('local');
        expect(se._collections.history.pushData[0].payload).to.equal('{}');
        done();
      });
    });
  });
});
