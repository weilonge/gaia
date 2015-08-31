'use strict';

/* global sinon */
/* exported HistoryAdapter */

var HistoryAdapter = {
  update: sinon.stub().returns(Promise.resolve()),
  handleConflict: sinon.spy(function(local, remote) {
    return local;
  })
};
