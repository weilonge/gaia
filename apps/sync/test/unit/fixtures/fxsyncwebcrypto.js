/* exported FxSyncWebCryptoFixture */

'use strict';

var FxSyncWebCryptoFixture = (function fxsync_webcrypto_fixture() {
  // NB: This data is from an FxSync account, freshly created for this purpose,
  // and then synced once using FxDesktop with a fresh empty Firefox profile:

  function hex2ba(hexStr) {
    var numBytes = hexStr.length / 2;
    var byteArray = new Uint8Array(numBytes);
    for (var i = 0; i < numBytes; i++) {
      byteArray[i] = parseInt(hexStr.substr(i * 2, 2), 16);
    }
    return byteArray;
  }

  return {
    kB: '85c4f8c1d8e3e2186824c127af786891dd03c6e05b1b45f28f7181211bf2affb',
    hkdf: {
      kB: hex2ba(
          '85c4f8c1d8e3e2186824c127af786891dd03c6e05b1b45f28f7181211bf2affb'),
      infoStr: hex2ba(
          '6964656e746974792e6d6f7a696c6c612e636f6d2f7069636c2f76312f6f6c647' +
          '3796e63'), // 'identity.mozilla.com/picl/v1/oldsync'
      outputHex:
          'd63eb2610f1e5edc21b37fed22b93b0f9ea379840fb5c3c5eb95991b9b3bfab69' +
          'cbabfda0762bdf0b27431d81960c8cf5dab7d482901213a5a1b003eb0081ed0'
    },
    cryptoKeys: {
      ciphertext: 'PP5yNUYwJJoLcsL5o85i6RZfvanYDrwtChDD/LdKTZ8JOLubZ9DyRv3HMe' +
          'tSkbhL3HLvVm/FJ1Z4F2Z6IKQCxAc5dNnLsBIUUxhOHLbT0x9/jfnqZ8fLtlbkogI3' +
          'ZlNvbc8iUF1aX+boe0Pv43vM0VvzxrnJDYzZ2a6jm9nbzUn0ldV9sv6vuvGHE6dANn' +
          'RkZ3wA/q0q8UvjdwpzXBixAw==',
      IV: 'FmosM+XBNy81/9oEAgI4Uw==',
      hmac: '01a816e4577c6cf3f97b66b4382d0a3e7e9178c75a3d38ed9ac8ad6397c2ecce'
    },
    historyEntryEnc: {
      payload: {
        ciphertext: 'o/VpkqMj1tlT8t2youwsS2FgvQeonoHxqjGsRTu1+4swfyBq/QsnKfgO' +
            'OMmDIXZiPC3hOCNUlf/NtQiEe55hzJZEKLBshaLfXotai6KrprwrmykfiXnwn73n' +
            '+nYNs8BXL5awDHoaJToyFgF4PYokl7mwN7YC2xFiPgwO7Z2u/8r5RfnPV9Moafqv' +
            'lvUkW+Tqs+QHeHS/iuSA0P2h/j5ynt9v4xDWLVfEMce0KOKHQ5Qj7BmEPAieWP1t' +
            'rkkDmTdVi2euWrs+fuG4C6PgY4A2j2DbNLVIloqpDVkqM2fgh0YOM9L2NC/uiKEb' +
            '1Ynr2Fos',
        IV: 'kXL3hb11ltD+Jl0YFk+PlQ==',
        hmac: 'cb727efe7a3f0307921cecbd1a97c03f06a4d75c42026089494d84fcf92dbff9'
      },
      collectionName: 'history'
    },
    historyEntryDec: {
      payload: {
        id: '_9sCUbahs0ay',
        histUri: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Ref' +
            'erence/Global_Objects/Object/proto',
        title: 'Object.prototype.__proto__ - JavaScript | MDN',
        visits:[ { date: 1439366063808983, type:1 } ]
      },
      collectionName: 'history'
    }
  };
})();
