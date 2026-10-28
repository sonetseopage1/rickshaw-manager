// Local storage in IndexedDB. Falls back to memory-only if the browser blocks it.
(function () {
  var RM = window.RM;
  var db = null;

  function wrap(req) {
    return new Promise(function (res, rej) {
      req.onsuccess = function () { res(req.result); };
      req.onerror = function () { rej(req.error); };
    });
  }

  RM.db = {
    open: function (name, stores) {
      db = null;
      if (!window.indexedDB) return Promise.resolve(false);
      return new Promise(function (res) {
        var r;
        try { r = indexedDB.open(name, 2); } catch (e) { return res(false); }
        r.onupgradeneeded = function () {
          var d = r.result;
          // also runs when an older database is upgraded: add whatever is missing
          stores.forEach(function (s) { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
          if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta', { keyPath: 'k' });
        };
        r.onsuccess = function () { db = r.result; res(true); };
        r.onerror = function () { res(false); };
        r.onblocked = function () { res(false); };
      });
    },
    getAll: function (store) {
      if (!db) return Promise.resolve([]);
      return wrap(db.transaction(store, 'readonly').objectStore(store).getAll()).catch(function () { return []; });
    },
    getOne: function (store, id) {
      if (!db) return Promise.resolve(null);
      try { return wrap(db.transaction(store, 'readonly').objectStore(store).get(id)).then(function (r) { return r || null; }).catch(function () { return null; }); }
      catch (e) { return Promise.resolve(null); }
    },
    put: function (store, obj) {
      if (!db) return Promise.resolve();
      try { return wrap(db.transaction(store, 'readwrite').objectStore(store).put(obj)).catch(function () {}); }
      catch (e) { return Promise.resolve(); }
    },
    putMany: function (store, arr) {
      if (!db || !arr.length) return Promise.resolve();
      return new Promise(function (res) {
        try {
          var tx = db.transaction(store, 'readwrite');
          var os = tx.objectStore(store);
          arr.forEach(function (o) { os.put(o); });
          tx.oncomplete = function () { res(); };
          tx.onerror = function () { res(); };
        } catch (e) { res(); }
      });
    },
    del: function (store, id) {
      if (!db) return Promise.resolve();
      try { return wrap(db.transaction(store, 'readwrite').objectStore(store).delete(id)).catch(function () {}); }
      catch (e) { return Promise.resolve(); }
    },
    getMeta: function (k) {
      if (!db) return Promise.resolve(null);
      return wrap(db.transaction('meta', 'readonly').objectStore('meta').get(k))
        .then(function (r) { return r ? r.v : null; }).catch(function () { return null; });
    },
    setMeta: function (k, v) { return RM.db.put('meta', { id: k, k: k, v: v }); },
    close: function () { if (db) { db.close(); db = null; } },
  };
})();
