'use strict';

/* global SyncEngine, SynctoServerFixture, HistoryAdapter,
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
  suite('constructor', function() {
    test('constructs a SyncEngine object', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      expect(se).to.be.an('object');
      expect(se._fswc).to.be.an('object');
      expect(se._kinto).to.be.an('object');
      expect(se._collections).to.be.an('object');
      expect(se._adapters).to.be.an('object');
      done();
    });
  });
  suite('connect', function() {
    test('obtains the bulk key bundle', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      expect(se.connect()).to.eventually.equal(undefined).
             and.notify(done);
    });
    test('rejects its promise if syncto server not responding', function(done) {
      var credentials = cloneObject(
          SynctoServerFixture.testServerCredentials);
      credentials.URL = 'http://example.com:24012/v1/';
      var se = new SyncEngine(credentials);
      se.connect().then(() => {}, (err) => {
        expect(err).to.be.an('object');
        done();
      });
    });
    // test('rejects its promise if BrowserID assertion is wrong');
    // test('rejects its promise if X-Client-State is wrong');
    // test('rejects its promise if kB is wrong');
    // test('rejects its promise if global/meta response status not a 200');
    // test('rejects its promise if global/meta response body not JSON');
    // test('rejects its promise if storageVersion wrong');
    // test('rejects its promise if crypto/keys response status not a 200');
    // test('rejects its promise if crypto/keys response body not JSON');
    // test('rejects its promise if cryptoKeys not verified/not decrypted ' +
    //     'with kB');
  });
  suite('syncNow', function() {
    test('syncs the encrypted collections', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      se.connect().then(() => {
        se.registerAdapter('history', HistoryAdapter);
        return se.syncNow();
      }).then(() => {
        expect(se._collections.history).to.be.an('object');
        return se._collections.history.list();
      }).then(list => {
        expect(list).to.be.an('object');
        expect(list.data).to.be.instanceOf(Array);
        expect(list.data.length).to.be.greaterThan(0);
        expect(list.data[0]).to.be.an('object');
        expect(list.data[0].payload).to.be.an('object');
        expect(list.data[0].payload.histUri).to.be.a('string');
        done();
      });
    });
    test('rejects its promise if meta/global response status is a 401',
        function(done) {
      var options = {
        URL: SynctoServerFixture.testServerCredentials.URL,
        assertion: SynctoServerFixture.testServerCredentials.assertion,
        xClientState: 'respond 401',
        kB: SynctoServerFixture.testServerCredentials.kB
      };
      var se = new SyncEngine(options);
      se.connect().then(function() {}, function(err) {
        expect(err).to.be.instanceOf(SyncEngine.AuthError);
        done();
      });
    });
    test('rejects its promise if meta/global response is not JSON',
        function(done) {
      var options = {
        URL: SynctoServerFixture.testServerCredentials.URL,
        assertion: SynctoServerFixture.testServerCredentials.assertion,
        xClientState: 'respond 200',
        kB: SynctoServerFixture.testServerCredentials.kB
      };
      var se = new SyncEngine(options);
      se.connect().then(function() {}, function(err) {
        expect(err).to.be.instanceOf(SyncEngine.UnrecoverableError);
        done();
      });
    });
    test('rejects its promise if kB is wrong', function(done) {
      var options = {
        URL: SynctoServerFixture.testServerCredentials.URL,
        assertion: SynctoServerFixture.testServerCredentials.assertion,
        xClientState: SynctoServerFixture.testServerCredentials.xClientState,
        kB: 'deadbeef'
      };
      var se = new SyncEngine(options);
      se.connect().then(function() {}, function(err) {
        expect(err).to.be.instanceOf(SyncEngine.UnrecoverableError);
        done();
      });
    });
    test('rejects its promise if any record not verifiable/decryptable ' +
        'with Bulk Key Bundle', function(done) {
      var se = new SyncEngine(SynctoServerFixture.testServerCredentials);
      se.connect().then(() => {
        se.registerAdapter('schmistory', HistoryAdapter);
        return se.syncNow();
      }).then(() => {}, err => {
        expect(err).to.be.instanceOf(SyncEngine.UnrecoverableError);
        done();
      });
    });
  });
});
