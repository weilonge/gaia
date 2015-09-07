/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  SyncEngine
*/

SyncEngine.DataAdapterClasses.tabs = {
  update(kintoCollection) {
    console.log('TabsAdapter#update...');
    return kintoCollection.list().then(list => {
      console.log('Got tabs data', list);
    });
  },
  handleConflict(local, remote) {
    console.log('TabsAdapter#handleConflict', local, remote);
    return remote;
  }
};
