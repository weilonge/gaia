'use strict';
/* exported MockPlaces */

function MockPlaces() {}

MockPlaces.prototype = {
  init: function() {
    this._store = {};
  },
  start: function() {},

  defaultPlace: function(url) {
    return {
      url: url,
      title: url,
      icons: {},
      frecency: 0,
      // An array containing previous visits to this url
      visits: [],
      screenshot: null
    };
  },

  editPlace: function(url, fun) {
    return new Promise((resolve, reject) => {
      var place = this._store[url] || this.defaultPlace(url);
      fun(place, (newPlace) => {
        this._store[url] = place;
        resolve();
      });
    });
  },

  clear: function() {}
};
