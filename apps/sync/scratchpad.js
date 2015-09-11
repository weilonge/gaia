var placesStore;

(function (){
  getPlacesStore();
  //listTitle();
})();

function history(){
  return syncEngine._getCollection('history');
}

function listTitle() {
  history().list().then(list => {
    list.data.forEach((item, index) => {
      /*console.log(item);*/
      if(item.payload.title){
        console.log(index, item.payload.title);
      }
    });
  });
}

function bookmarks(){
  return syncEngine._getCollection('bookmarks');
}

function listBookmarks() {
  bookmarks().list().then(list => {
    console.log(list);
  });
}

function getPlacesStore() {
  navigator.getDataStores('places').then(stores => {
    placesStore = stores[0];
  });
}

function dsSync(revisionId) {
  var cursor = placesStore.sync(revisionId);
  runNextTask(cursor);

  function runNextTask(cursor) {
   cursor.next().then(function(task) {
     manageTask(cursor, task);
   });
  }

  function manageTask(cursor, task) {
    console.log(task);
    if (task.operation == 'done') {
      // Finished adding contacts!
      return;
    }
/*
    if (task.operation == 'add') {
      // Add the contacts that are different to how it was before
      displayExisting(task.id, task.data);
    }
*/
    runNextTask(cursor);
  }
}
