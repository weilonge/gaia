/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* global PlacesAdapter, MocksHelper, MockAppWindowManager, MockPlaces */

'use strict';

requireApp('system/js/sync/places_adapter.js');
requireApp('system/test/unit/mock_app_window_manager.js');
requireApp('system/test/unit/mock_places.js');

var mocksForService = new MocksHelper([
  'AppWindowManager'
]).init();

suite('system/sync/PlacesAdapter >', () => {
  var realAppWindowManager;
  mocksForService.attachTestHelpers();

  setup(() => {
    realAppWindowManager = window.appWindowManager;
    //realPlaces = window.appWindowManager.places;
    window.appWindowManager = new MockAppWindowManager();
    window.appWindowManager.places = new MockPlaces();
    window.appWindowManager.places.init();
  });

  teardown(() => {
    window.appWindowManager = realAppWindowManager;
  });

  test('addPlace - add two records', done => {
    var place1 = {
      url: 'http://www.mozilla.org/en-US/',
      title: '',
      visits: [ 1501000000000, 1502000000000 ]
    };

    var place2 = {
      url: 'http://www.example.org/en-US/',
      title: 'Mozilla',
      visits: [ 1502000000000, 1503000000000, 1504000000000 ]
    };

    PlacesAdapter.addPlace(place1).then(() => {
      PlacesAdapter.addPlace(place2).then(() => {
        var result1 = window.appWindowManager.places._store[place1.url];
        assert.equal(result1.title, place1.url);
        assert.equal(result1.url, place1.url);
        assert.equal(result1.visits.length, place1.visits.length);
        var expectedVisits1 = [ 1502000000000, 1501000000000 ];
        for(var i = 0; i < result1.visits.length; i++){
          assert.equal(result1.visits[i], expectedVisits1[i]);
        }

        var result2 = window.appWindowManager.places._store[place2.url];
        assert.equal(result2.title, place2.title);
        assert.equal(result2.url, place2.url);
        assert.equal(result2.visits.length, place2.visits.length);
        var expectedVisits2 = [ 1504000000000, 1503000000000, 1502000000000 ];
        for(var j = 0; j < result2.visits.length; j++){
          assert.equal(result2.visits[j], expectedVisits2[j]);
        }

        done();
      });
    });
  });

  test('addPlace - merge two records', done => {
    var place1 = {
      url: 'http://www.mozilla.org/en-US/',
      title: '',
      visits: [ 1501000000000, 1502000000000 ]
    };

    var place2 = {
      url: 'http://www.mozilla.org/en-US/',
      title: 'Mozilla',
      visits: [ 1502000000000, 1503000000000 ]
    };

    PlacesAdapter.addPlace(place1).then(() => {
      PlacesAdapter.addPlace(place2).then(() => {
        var result = window.appWindowManager.places._store[place1.url];
        var expectedPlace = {
          url: 'http://www.mozilla.org/en-US/',
          title: 'Mozilla',
          visits: [1503000000000, 1502000000000, 1501000000000]
        };

        assert.equal(result.title, expectedPlace.title);
        assert.equal(result.url, expectedPlace.url);
        assert.equal(result.visits.length, expectedPlace.visits.length);
        for(var i = 0; i < result.visits.length; i++){
          assert.equal(result.visits[i], expectedPlace.visits[i]);
        }
        done();
      });
    });
  });

  test('addPlaces', done => {
    var places = [{
      url: 'http://www.mozilla.org/en-US/',
      title: '',
      visits: [ 1501000000000, 1502000000000 ]
    },{
      url: 'http://www.mozilla.org/en-US/',
      title: 'Mozilla',
      visits: [ 1502000000000, 1503000000000 ]
    }];

    PlacesAdapter.addPlaces(places).then(() => {
      var expectedPlace = {
        url: 'http://www.mozilla.org/en-US/',
        title: 'Mozilla',
        visits: [1503000000000, 1502000000000, 1501000000000]
      };

      var result = window.appWindowManager.places._store[places[0].url];
      assert.equal(result.title, expectedPlace.title);
      assert.equal(result.url, expectedPlace.url);
      assert.equal(result.visits.length, expectedPlace.visits.length);
      for(var i = 0; i < result.visits.length; i++){
        assert.equal(result.visits[i], expectedPlace.visits[i]);
      }

      done();
    });
  });

});
