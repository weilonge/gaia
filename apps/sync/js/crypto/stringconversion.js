/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* exported
  StringConversion
*/

var StringConversion = (() => {
  return {
    rawStringToByteArray(str) {
      if (typeof str != 'string') {
        throw new Error('Not a string');
      }
      var strLen = str.length;
      var byteArray = new Uint8Array(strLen);
      for (var i = 0; i < strLen; i++) {
        byteArray[i] = str.charCodeAt(i);
      }
      return byteArray;
    },

    base64StringToByteArray(base64) {
      if (typeof base64 != 'string' || base64.length % 4 !== 0) {
        throw new Error(`Number of base64 digits must be a multiple of 4 to con\
vert to bytes`);
      }
      return StringConversion.rawStringToByteArray(window.atob(base64));
    },

    hexStringToByteArray(hexStr) {
      if (typeof hexStr != 'string' || hexStr.length % 2 !== 0) {
        throw new Error(`Must have an even number of hex digits to convert to b\
ytes`);
      }
      var numBytes = hexStr.length / 2;
      var byteArray = new Uint8Array(numBytes);
      //FIXME: Can this be done faster?
      for (var i = 0; i < numBytes; i++) {
        byteArray[i] = parseInt(hexStr.substr(i * 2, 2), 16);
      }
      return byteArray;
    },

    byteArrayToBase64String(bytes) {
      if (!(bytes instanceof Uint8Array)) {
        throw new Error('Not a Uint8Array');
      }
      var binary = '';
      var len = bytes.byteLength;
      for (var i=0; i<len; i++) {
          binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    },

    arrayBufferToBase64String(buffer) {
      if (!(buffer instanceof ArrayBuffer)) {
        throw new Error('Not an ArrayBuffer');
      }
      var bytes = new Uint8Array(buffer);
      return StringConversion.byteArrayToBase64String(bytes);
    },

    byteArrayToHexString(bytes) {
      if (!(bytes instanceof Uint8Array)) {
        throw new Error('Not a Uint8Array');
      }
      var hex = '';
      for (var i=0; i <bytes.length; ++i) {
        var zeropad = (bytes[i] < 0x10) ? '0' : '';
        hex += zeropad + bytes[i].toString(16);
      }
      return hex;
    },

    arrayBufferToHexString(buffer) {
      if (!(buffer instanceof ArrayBuffer)) {
        throw new Error('Not an ArrayBuffer');
      }
      var bytes = new Uint8Array(buffer);
      return StringConversion.byteArrayToHexString(bytes);
    }
  };
})();
