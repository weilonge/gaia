/* -*- Mode: Java; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- /
/* vim: set shiftwidth=2 tabstop=2 autoindent cindent expandtab: */

/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

/* global BaseModule */
/* global Deferred */
/* global Service */
/* global SyncStateMachineTransitions */

'use strict';

requireApp('system/test/unit/deferred.js');
requireApp('system/js/service.js');
requireApp('system/js/base_module.js');
requireApp('system/js/sync_state_machine.js');

suite('system/SyncStateMachine >', () => {

  var syncStateMachine;

  suiteSetup(function() {
    syncStateMachine = BaseModule.instantiate('SyncStateMachine');
    syncStateMachine.start();
  });

  suite('Initial state', () => {
    test('Integrity', () => {
      assert.ok(syncStateMachine !== undefined);

      // SyncStateMachine is supposed to expose a function per transition.
      for (var name in SyncStateMachineTransitions) {
        if (!SyncStateMachineTransitions.hasOwnProperty(name)) {
          continue;
        }
        assert.ok(syncStateMachine[name] !== undefined);
        assert.ok(syncStateMachine[name] instanceof Function);
      }
    });

    test('Initial state should be disabled', () => {
      assert.equal(Service.query('SyncStateMachine.state'), 'disabled');
    });
  });

  suite('Events invalid for state', () => {
    [{
      from: 'disabled',
      invalidEvents: [
        'disable',
        'sync',
        'error',
        'success'
      ],
      transition: 'enable'
    }, {
      from: 'enabling',
      invalidEvents: [
        'enable',
        'disable',
        'sync'
      ],
      transition: 'success'
    }, {
      from: 'enabled',
      invalidEvents: [
        'enable',
        'success',
        'error'
      ],
      transition: 'sync'
    }, {
      from: 'syncing',
      invalidEvents: [
        'enable',
        'disable',
        'sync'
      ],
      transition: 'error'
    }, {
      from: 'errored',
      invalidEvents: [
        'sync',
        'success',
        'error'
      ],
      transition: 'disable'
    }].forEach(config => {
      test(config.from + ' - invalid events', (done) => {
        config.invalidEvents.forEach(event => {
          try {
            Service.request('SyncStateMachine:'+ event);
            assert.ok(false, 'Should have thrown exception');
          } catch(e) {
            assert.ok(true, 'Expected exception');
            assert.equal(e.message, 'Event ' + event +
                         ' invalid for the current state');
            assert.equal(Service.query('SyncStateMachine.state'),
                         config.from);
          }
        });
        Service.request('SyncStateMachine:' + config.transition).then(done);
      });
    });
  });

  suite('State transitions', () => {
    // Some of the events are repeated so we can test all the possible
    // transitions.
    [{
      from: 'disabled',
      to: 'enabling',
      transition: 'enable',
      expectedEvent: 'Enabling',
      unexpectedEvents: [
        'Enabled',
        'Errored',
        'Disabled',
        'Syncing'
      ],
    }, {
      from: 'enabling',
      to: 'errored',
      transition: 'error',
      expectedEvent: 'Errored',
      unexpectedEvents: [
        'Enabled',
        'Disabled',
        'Enabling',
        'Syncing'
      ]
    }, {
      from: 'errored',
      to: 'disabled',
      transition: 'disable',
      expectedEvent: 'Disabled',
      unexpectedEvents: [
        'Enabled',
        'Enabling',
        'Errored',
        'Syncing'
      ]
    }, {
      from: 'disabled',
      to: 'enabling',
      transition: 'enable',
      expectedEvent: 'Enabling',
      unexpectedEvents: [
        'Enabled',
        'Errored',
        'Disabled',
        'Syncing'
      ]
    }, {
      from: 'enabling',
      to: 'enabled',
      transition: 'success',
      expectedEvent: 'Enabled',
      unexpectedEvents: [
        'Enabling',
        'Errored',
        'Disabled',
        'Syncing'
      ]
    }, {
      from: 'enabled',
      to: 'syncing',
      transition: 'sync',
      expectedEvent: 'Syncing',
      unexpectedEvents: [
        'Enabled',
        'Enabling',
        'Disabled',
        'Errored'
      ]
    }, {
      from: 'syncing',
      to: 'enabled',
      transition: 'success',
      expectedEvent: 'Enabled',
      unexpectedEvents: [
        'Disabled',
        'Enabling',
        'Errored',
        'Syncing'
      ]
    }, {
      from: 'enabled',
      to: 'syncing',
      transition: 'sync',
      expectedEvent: 'Syncing',
      unexpectedEvents: [
        'Enabled',
        'Enabling',
        'Disabled',
        'Errored'
      ]
    }, {
      from: 'syncing',
      to: 'errored',
      transition: 'error',
      expectedEvent: 'Errored',
      unexpectedEvents: [
        'Enabled',
        'Disabled',
        'Enabling',
        'Syncing'
      ]
    }, {
      from: 'errored',
      to: 'enabled',
      transition: 'enable',
      expectedEvent: 'Enabled',
      unexpectedEvents: [
        'Disabled',
        'Enabling',
        'Syncing',
        'Errored'
      ]
    }, {
      from: 'enabled',
      to: 'disabled',
      transition: 'disable',
      expectedEvent: 'Disabled',
      unexpectedEvents: [
        'Enabled',
        'Enabling',
        'Errored',
        'Syncing'
      ]
    }].forEach(config => {
      test('Transition ' + config.transition + ' while on ' +
           config.from + ' state', done => {
        var promises = [];

        var onexpectedDeferred = new Deferred();
        promises.push(onexpectedDeferred.promise);
        var onexpected = event => {
          assert.ok(true, 'Received expected SyncStateMachine' +
                    config.expectedEvent);
          assert.equal(event.detail.transition, config.transition);
          assert.equal(event.detail.from, config.from);
          onexpectedDeferred.resolve();
        };

        var onunexpected = () => {
          assert.ok(false, 'Received unexpected event');
          cleanup();
        };

        function cleanup() {
          config.unexpectedEvents.forEach(unexpectedEvent => {
            window.removeEventListener('Sync' + unexpectedEvent,
                                       onunexpected);
          });
          window.removeEventListener('Sync' + config.expectedEvent,
                                     onexpected);
                                     done();
        }

        window.addEventListener('Sync' + config.expectedEvent,
                                onexpected);

        config.unexpectedEvents.forEach(unexpectedEvent => {
          window.addEventListener('Sync' + unexpectedEvent,
                                  onunexpected);
        });

        promises.push(new Promise(resolve => {
          Service.request('SyncStateMachine:' + config.transition).then(() => {
            assert.equal(Service.query('SyncStateMachine.state'), config.to);
            resolve();
          });
        }));

        Promise.all(promises).then(cleanup);
      });
    });
  });
});
