/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  CryptoKey,
  expect,
  FxSyncWebCrypto,
  FxSyncWebCryptoFixture,
  requireApp,
  suite,
  test
*/

requireApp('sync/js/crypto/stringconversion.js');
requireApp('sync/js/crypto/keyderivation.js');
requireApp('sync/js/crypto/fxsyncwebcrypto.js');
requireApp('sync/test/unit/fixtures/fxsyncwebcrypto.js');

suite('FxSyncWebCrypto', () => {
  suite('constructor', () => {
    test('creates an object with the right methods', () => {
      var fswc = new FxSyncWebCrypto();
      expect(fswc).to.be.an('object');
      expect(fswc.setKeys).to.be.a('function');
      expect(fswc.decrypt).to.be.a('function');
      expect(fswc.encrypt).to.be.a('function');
    });
  });

  suite('setKeys', () => {
    test('populates mainSyncKey and defaultDecryptionKey correctly',
         done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      fswc.setKeys(fixture.kB, fixture.cryptoKeys).then(() => {
        expect(fswc.mainSyncKey).to.be.an('object');
        expect(fswc.mainSyncKey.aes).to.be.instanceof(CryptoKey);
        expect(fswc.mainSyncKey.hmac).to.be.instanceof(CryptoKey);
        expect(fswc.bulkKeyBundle).to.be.an('object');
        expect(fswc.bulkKeyBundle.default).to.be.instanceof(Array);
        expect(fswc.bulkKeyBundle.defaultAsKeyBundle).to.be.an('object');
        expect(fswc.bulkKeyBundle.defaultAsKeyBundle.aes).to.be.
            instanceof(CryptoKey);
        expect(fswc.bulkKeyBundle.defaultAsKeyBundle.hmac).to.be.
            instanceof(CryptoKey);
        done();
      });
    });

    test('rejects promise if cryptoKeys hmac is wrong', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      var cryptoKeysWrong = JSON.parse(JSON.stringify(fixture.cryptoKeys));
      cryptoKeysWrong.hmac = 'deadbeef';
      var promise = fswc.setKeys(fixture.kB, cryptoKeysWrong);
      expect(promise).to.be.rejectedWith(
          'SyncKeys hmac could not be verified with current main key').and.
          notify(done);
    });

    test('rejects promise if cryptoKeys ciphertext is wrong (1)', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      var cryptoKeysWrong = JSON.parse(JSON.stringify(fixture.cryptoKeys));
      cryptoKeysWrong.ciphertext = 'deadbeef';
      var promise = fswc.setKeys(fixture.kB, cryptoKeysWrong);
      expect(promise).to.be.rejectedWith(
          'SyncKeys hmac could not be verified with current main key').and.
           notify(done);
    });

    test('rejects promise if cryptoKeys ciphertext is wrong (2)', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      var cryptoKeysWrong = JSON.parse(JSON.stringify(fixture.cryptoKeys));
      cryptoKeysWrong.ciphertext = 'deadbee';
      var promise = fswc.setKeys(fixture.kB, cryptoKeysWrong);
      expect(promise).to.be.rejectedWith(
          'Could not parse ciphertext as a base64 string').and.
           notify(done);
    });

    test('rejects promise if cryptoKeys IV is wrong', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      var cryptoKeysWrong = JSON.parse(JSON.stringify(fixture.cryptoKeys));
      cryptoKeysWrong.IV = 'deadbeef';
      var promise = fswc.setKeys(fixture.kB, cryptoKeysWrong);
      expect(promise).to.be.rejectedWith(
          'Could not decrypt crypto keys using AES part of stretched kB key').
          and.notify(done);
    });
  });

  suite('decrypt', () => {
    test('can verify and decrypt a record', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      fswc.setKeys(fixture.kB, fixture.cryptoKeys).then(() => {
        return fswc.decrypt(fixture.historyEntryEnc.payload,
            fixture.historyEntryEnc.collectionName);
      }).then(decryptedRecord => {
        expect(decryptedRecord).to.be.an('object');
        expect(decryptedRecord.id).to.equal(fixture.historyEntryDec.payload.id);
        expect(decryptedRecord.histUri).to.equal(
            fixture.historyEntryDec.payload.histUri);
        expect(decryptedRecord.title).to.equal(
            fixture.historyEntryDec.payload.title);
        expect(decryptedRecord.visits).to.be.instanceof(Array);
        expect(decryptedRecord.visits.length).to.equal(1);
        expect(decryptedRecord.visits[0].date).to.equal(
            fixture.historyEntryDec.payload.visits[0].date);
        expect(decryptedRecord.visits[0].type).to.equal(
            fixture.historyEntryDec.payload.visits[0].type);
        done();
      });
    });

    test('rejects promise if collectionName is not a string', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(fixture.historyEntryEnc.payload, 5);
      });
      expect(promise).to.be.rejectedWith('collectionName is not a string').and.
          notify(done);
    });

    test('rejects promise if payload is not an object', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).then(
          () => {
        return fswc.decrypt(5, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith('PayloadStrings is not an object').and.
          notify(done);
    });

    test('rejects promise if payload.ciphertext is not a string',
        done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: 5,
        IV: fixture.historyEntryEnc.payload.IV,
        hmac: fixture.historyEntryEnc.payload.hmac
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(`Could not parse ciphertext as a base6\
4 string`).and.notify(done);
    });

    test('rejects promise if payload.ciphertext is not a Base64 string',
        done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: 'foo',
        IV: fixture.historyEntryEnc.payload.IV,
        hmac: fixture.historyEntryEnc.payload.hmac
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(`Could not parse ciphertext as a base6\
4 string`).and.notify(done);
    });

    test('rejects promise if payload.IV is not a string', done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: fixture.historyEntryEnc.payload.ciphertext,
        IV: null,
        hmac: fixture.historyEntryEnc.payload.hmac
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).then(
          () => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(`Could not parse IV as a base64 string\
`).and.notify(done);
    });

    test('rejects promise if payload.IV is not a Base64 string',
        done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: fixture.historyEntryEnc.payload.ciphertext,
        IV: 'foo',
        hmac: fixture.historyEntryEnc.payload.hmac
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(`Could not parse IV as a base64 string\
`).and.notify(done);
    });

    test('rejects promise if payload.hmac is not a string', done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: fixture.historyEntryEnc.payload.ciphertext,
        IV: fixture.historyEntryEnc.payload.IV,
        hmac: { foo: 'bar' }
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(
          'Could not parse hmac as a hex string').and.notify(done);
    });

    test('rejects promise if payload.hmac is not a hex string (1)',
        done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: fixture.historyEntryEnc.payload.ciphertext,
        IV: fixture.historyEntryEnc.payload.IV,
        hmac: 'fee' // should detect odd number of chars
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(
          'Could not parse hmac as a hex string').and.notify(done);
    });

    test('rejects promise if payload.hmac is not a hex string (2)',
        done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: fixture.historyEntryEnc.payload.ciphertext,
        IV: fixture.historyEntryEnc.payload.IV,
        hmac: 'fooz' // should detect verification failure due to non-hex string
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(
          'Record verification failed with current hmac key for history').and.
          notify(done);
    });

    test('rejects promise if record hmac is wrong', done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: fixture.historyEntryEnc.payload.ciphertext,
        IV: fixture.historyEntryEnc.payload.IV,
        hmac: 'deadbeef'
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(`Record verification failed with curre\
nt hmac key for history`).and.notify(done);

    });

    test('rejects promise if record ciphertext is wrong', done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: 'deadbeef',
        IV: fixture.historyEntryEnc.payload.IV,
        hmac: fixture.historyEntryEnc.payload.hmac
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(`Record verification failed with curre\
nt hmac key for history`).and.notify(done);
    });

    test('rejects promise if record IV is wrong', done => {
      var fixture = FxSyncWebCryptoFixture;
      var payload = {
        ciphertext: fixture.historyEntryEnc.payload.ciphertext,
        IV: 'deadbeef',
        hmac: fixture.historyEntryEnc.payload.hmac
      };
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.decrypt(payload, fixture.historyEntryEnc.collectionName);
      });
      expect(promise).to.be.rejectedWith(`Could not decrypt record using AES pa\
rt of key bundle for collection history`).and.notify(done);
    });
  });

  suite('encrypt', () => {
    test('can sign and encrypt a record', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      fswc.setKeys(fixture.kB, fixture.cryptoKeys).then(() => {
        return fswc.encrypt(fixture.historyEntryDec.payload,
                            fixture.historyEntryDec.collectionName);
      }).then(encryptedRecord => {
        // We cannot predict how the payload will be JSON-stringified into a
        // cleartext, so instead, see if we can at least decrypt it again
        return fswc.decrypt(encryptedRecord,
                            fixture.historyEntryDec.collectionName);
      }).then(redecryptedRecord => {
        expect(redecryptedRecord).to.deep.equal(
            fixture.historyEntryDec.payload);
        done();
      });
    });

    test('rejects promise if record is not an object', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.encrypt('boo', fixture.historyEntryDec.collectionName);
      });
      expect(promise).to.be.rejectedWith('Record should be an object').and.
          notify(done);
    });

    test('rejects promise if record cannot be JSON-stringified',
        done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        var myObject = {};
        myObject.cyclicReference = myObject;
        return fswc.encrypt(myObject, fixture.historyEntryDec.collectionName);
      });
      expect(promise).to.be.rejectedWith('Record cannot be JSON-stringified').
          and.notify(done);
    });

    test('rejects promise if collectionName is not a string', done => {
      var fixture = FxSyncWebCryptoFixture;
      var fswc = new FxSyncWebCrypto();
      var promise = fswc.setKeys(fixture.kB, fixture.cryptoKeys).
          then(() => {
        return fswc.encrypt(fixture.historyEntryDec.payload, 5);
      });
      expect(promise).to.be.rejectedWith('collectionName is not a string').
           and.notify(done);
    });
  });
});
