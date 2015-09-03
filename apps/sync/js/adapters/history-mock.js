/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* exported HistoryAdapter */

var HistoryAdapter = {
  update(kintoCollection) {
    console.log('HistoryAdapter#update...');
    return kintoCollection.list().then(list => {
      console.log('Got history data', list);
    });
  },
  handleConflict(local, remote) {
    console.log('HistoryAdapter#handleConflict', local, remote);
    return remote;
  }
};
