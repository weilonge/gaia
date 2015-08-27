'use strict';

/* global KeyDerivation, FxSyncWebCryptoFixture,
    requireApp, expect, suite, test */

requireApp('sync/js/fxsync-webcrypto/stringconversion.js');
requireApp('sync/js/fxsync-webcrypto/keyderivation.js');
requireApp('sync/js/fxsync-webcrypto/main.js');
requireApp('sync/test/unit/fixtures/fxsyncwebcrypto.js');

suite('hkdf', function() {
  suite('hkdf', function() {
    test('can calculate a hkdf result correctly', function(done) {
      this.slow(500);
      var fixture = FxSyncWebCryptoFixture.hkdf;
      KeyDerivation.hkdf(fixture.kB, fixture.infoStr, new Uint8Array(64), 64)
          .then(function(bytes) {
        var hex = '';
        for (var i=0; i <bytes.length; ++i) {
          var zeropad = (bytes[i] < 0x10) ? '0' : '';
          hex += zeropad + bytes[i].toString(16);
        }
        expect(hex).to.equal(fixture.outputHex);
        done();
      });
    });
    test('rejects its promise if ikm is wrong', function(done) {
      var fixture = FxSyncWebCryptoFixture.hkdf;
      fixture.kB = 'foo';
      var promise = KeyDerivation.hkdf(fixture.kB, fixture.infoStr,
          new Uint8Array(64), 64);
      expect(promise).to.be.rejectedWith(Error).
           and.notify(done);
    });
    test('rejects its promise if info is wrong', function(done) {
      var fixture = FxSyncWebCryptoFixture.hkdf;
      fixture.kB = 'foo';
      var promise = KeyDerivation.hkdf(fixture.kB, fixture.infoStr,
          new Uint8Array(64), 64);
      expect(promise).to.be.rejectedWith(Error).
           and.notify(done);
    });
    test('rejects its promise if salt is wrong', function(done) {
      var fixture = FxSyncWebCryptoFixture.hkdf;
      fixture.kB = 'foo';
      var promise = KeyDerivation.hkdf(fixture.kB, fixture.infoStr,
          new Uint8Array(64), 64);
      expect(promise).to.be.rejectedWith(Error).
           and.notify(done);
    });
    test('rejects its promise if length is wrong', function(done) {
      var fixture = FxSyncWebCryptoFixture.hkdf;
      var promise = KeyDerivation.hkdf(fixture.kB, fixture.infoStr,
          new Uint8Array(64), 32);
      expect(promise).to.be.rejectedWith(Error).
           and.notify(done);
    });
  });
});
