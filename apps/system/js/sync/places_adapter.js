/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/* globals appWindowManager */
/* exported PlacesAdapter */

'use strict';

(function(exports) {
  var PlacesAdapter = {
    addPlace: function (place) {
      var url = place.url;
      var visits =  place.visits;
      var title = place.title;
      var lastModifiedFromRemote = place.last_modified;

      var places = appWindowManager.places;
      return places.editPlace(url, (newPlace, cb) => {
        var isNewPlace = newPlace.visits.length === 0;
        if(isNewPlace && title){
          newPlace.title = title;
        } else if (lastModifiedFromRemote >= newPlace.visits[0]) {
          newPlace.title = title;
        }
        newPlace.visits = newPlace.visits || [];
        for  (var i=0; i<visits.length; i++) {
          if (newPlace.visits.indexOf(visits[i]) === -1) {
            newPlace.visits.push(visits[i]);
          }
        }
        newPlace.visits.sort((a, b) => {
          return b - a;
        });
        newPlace.fxsyncId = place.fxsyncId;
        cb(newPlace);
      });
    },

    addPlaces: function (places){
      return new Promise((resolve, reject) => {
        places.reduce((cur, next) => {
          return cur.then(() => {
            return this.addPlace(next);
          });
        }, Promise.resolve()).then(() => {
          resolve();
        });
      });
    }
  };

  exports.PlacesAdapter = PlacesAdapter;

}(window));
