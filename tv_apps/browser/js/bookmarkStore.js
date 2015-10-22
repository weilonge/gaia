/* globals BrowserDB, SyncBrowserDB, SyncManagerBridge */
'use strict';

(function(exports){

  var BookmarkStore = {
    isSynced: false,

    cache: [],

    currentFolder : null,

    reset: function(cb) {
      this.cache = [];
      this.currentFolder = null;
      SyncManagerBridge.getInfo().then(message => {
        this.isSynced = (message.state === 'enabled') ? true : false;
        cb();
      });
    },

    getByRange: function(start, num, folderId, cb) {
      var fn = function(){
        var i = start,
          length = (start + num) > this.cache.length ?
              (this.cache.length - start) : (start + num),
          result = [];
        for(; i < length; i++) {
          result.push(this.cache[i]);
        }
        cb(result);
      }.bind(this);

      if(folderId !== this.currentFolder) {
        this.currentFolder = folderId;
        this.updateCache(fn);
      } else {
        fn();
      }
    },

    getByIndex: function(index, folderId, cb) {
      var fn = function() {
        var result = null;
        if(index >= 0 && index < this.cache.length) {
          result = this.cache[index];
        }
        cb(result);
      }.bind(this);

      if(folderId !== this.currentFolder) {
        this.currentFolder = folderId;
        this.updateCache(fn);
      } else {
        fn();
      }
    },

    updateCache: function(cb){
      this.cache = [];

      if(this.isSynced) {
        if(!this.currentFolder) {
          SyncBrowserDB.getBookmark('places', bookmark => {
            // make sure if firefox synced data saved in indexdDB
            if(bookmark) {
              this.cache.push({
                id: bookmark.id,
                title: bookmark.title ? bookmark.title : 'Synced Bookmarks',
                type: bookmark.type,
                readOnly: true
              });
            }

            // get bookmark data from origin indexdDB
            BrowserDB.getBookmarks(bookmarks => {
              this.cache = this.cache.concat(bookmarks);
              cb();
            });
          });
        } else {
          SyncBrowserDB.getBookmark({
            parentid: this.currentFolder
          }, bookmarks => {
            bookmarks.forEach((b, i) => {
              // XXX: Now we only support two types: folder and bookmark.
              // And the data from firefox sync can't be modified.
              if(b.type === 'folder' && b.title) {
                b.readOnly = true;
                this.cache.push(b);
              } else if (b.type === 'bookmark') {
                b.uri = b.bmkUri;
                b.readOnly = true;
                this.cache.push(b);
              }
            });
            cb();
          });
        }
      } else {
        // Get bookmark data from origin indexdDB
        BrowserDB.getBookmarks(bookmarks => {
          this.cache = bookmarks;
          cb();
        });
      }
    }
  };

  exports.BookmarkStore = BookmarkStore;
})(window);
