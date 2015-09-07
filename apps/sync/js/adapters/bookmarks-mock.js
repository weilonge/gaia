/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/* global
  SyncEngine
*/

SyncEngine.DataAdapterClasses.bookmarks = {
  update(kintoCollection) {
    console.log('BookmarksAdapter#update...');
    return kintoCollection.list().then(list => {
      console.log('Got bookmarks data', list);
    });
  },
  handleConflict(local, remote) {
    console.log('BookmarksAdapter#handleConflict', local, remote);
    return remote;
  }
};
