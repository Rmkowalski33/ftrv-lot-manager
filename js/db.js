/* ================================================================
   IndexedDB Layer — FTRV Lot Manager PWA
   Stores inventory units, lot map, and queued field notes offline.
   ================================================================ */

var DB = (function () {
  var DB_NAME = "ftrv_lot_manager";
  var DB_VERSION = 2;
  var db = null;

  // ── Open / Initialize ──────────────────────────────────────────
  function open() {
    return new Promise(function (resolve, reject) {
      if (db) return resolve(db);
      var req = indexedDB.open(DB_NAME, DB_VERSION);

      req.onupgradeneeded = function (e) {
        var d = e.target.result;

        // Units store — keyed by stock_num
        if (!d.objectStoreNames.contains("units")) {
          var us = d.createObjectStore("units", { keyPath: "stock_num" });
          us.createIndex("vin", "vin", { unique: false });
          us.createIndex("make", "make", { unique: false });
          us.createIndex("model", "model", { unique: false });
          us.createIndex("status", "status", { unique: false });
          us.createIndex("lot_location", "lot_location", { unique: false });
          us.createIndex("lot_area", "lot_area", { unique: false });
          us.createIndex("veh_type", "veh_type", { unique: false });
          us.createIndex("pc", "pc", { unique: false });
        }

        // Meta store — key-value for sync timestamps, unit count, etc.
        if (!d.objectStoreNames.contains("meta")) {
          d.createObjectStore("meta", { keyPath: "key" });
        }

        // Field notes queue — offline notes pending submission
        if (!d.objectStoreNames.contains("note_queue")) {
          var nq = d.createObjectStore("note_queue", { keyPath: "id", autoIncrement: true });
          nq.createIndex("status", "status", { unique: false });
        }

        // Submitted notes — notes already sent to Google Sheet
        if (!d.objectStoreNames.contains("notes_history")) {
          var nh = d.createObjectStore("notes_history", { keyPath: "id", autoIncrement: true });
          nh.createIndex("timestamp", "timestamp", { unique: false });
        }

        // Replacement log — tracks replacement selections
        if (!d.objectStoreNames.contains("replacement_log")) {
          var rl = d.createObjectStore("replacement_log", { keyPath: "id", autoIncrement: true });
          rl.createIndex("status", "status", { unique: false });
          rl.createIndex("repl_stock", "repl_stock", { unique: false });
        }
      };

      req.onsuccess = function (e) {
        db = e.target.result;
        resolve(db);
      };
      req.onerror = function (e) {
        reject(e.target.error);
      };
    });
  }

  // ── Generic helpers ────────────────────────────────────────────
  function tx(storeName, mode) {
    return db.transaction(storeName, mode).objectStore(storeName);
  }

  function promisify(req) {
    return new Promise(function (resolve, reject) {
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }

  // ── Units ──────────────────────────────────────────────────────
  function putUnits(units) {
    return new Promise(function (resolve, reject) {
      var t = db.transaction("units", "readwrite");
      var store = t.objectStore("units");
      // Clear old data, then insert fresh
      store.clear();
      for (var i = 0; i < units.length; i++) {
        store.put(units[i]);
      }
      t.oncomplete = function () { resolve(units.length); };
      t.onerror = function () { reject(t.error); };
    });
  }

  function getAllUnits() {
    return open().then(function () {
      return promisify(tx("units", "readonly").getAll());
    });
  }

  function getUnit(stockNum) {
    return open().then(function () {
      return promisify(tx("units", "readonly").get(stockNum));
    });
  }

  function searchUnits(query) {
    var q = query.trim().toUpperCase();
    if (!q) return Promise.resolve([]);
    return getAllUnits().then(function (units) {
      var matches = [];
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        var searchable = [u.year, u.manufacturer, u.make, u.model,
          u.stock_num, u.vin, u.pc, u.lot_location, u.status,
          u.veh_type, u.floor_layout, u.body_style].join(" ").toUpperCase();
        if (searchable.indexOf(q) !== -1) {
          matches.push(u);
          if (matches.length >= 50) break;
        }
      }
      return matches;
    });
  }

  function getUnitsByIndex(indexName, value) {
    return open().then(function () {
      var store = tx("units", "readonly");
      var idx = store.index(indexName);
      return promisify(idx.getAll(value));
    });
  }

  // ── Meta ───────────────────────────────────────────────────────
  function setMeta(key, value) {
    return open().then(function () {
      return promisify(tx("meta", "readwrite").put({ key: key, value: value }));
    });
  }

  function getMeta(key) {
    return open().then(function () {
      return promisify(tx("meta", "readonly").get(key)).then(function (r) {
        return r ? r.value : null;
      });
    });
  }

  // ── Note Queue (offline) ───────────────────────────────────────
  function queueNote(note) {
    return open().then(function () {
      note.status = "pending";
      note.queued_at = new Date().toISOString();
      return promisify(tx("note_queue", "readwrite").add(note));
    });
  }

  function getPendingNotes() {
    return open().then(function () {
      return promisify(tx("note_queue", "readonly").getAll());
    }).then(function (all) {
      return all.filter(function (n) { return n.status === "pending"; });
    });
  }

  function markNoteSent(id) {
    return open().then(function () {
      var store = tx("note_queue", "readwrite");
      return promisify(store.get(id)).then(function (note) {
        if (note) {
          note.status = "sent";
          return promisify(store.put(note));
        }
      });
    });
  }

  function clearSentNotes() {
    return open().then(function () {
      return promisify(tx("note_queue", "readonly").getAll());
    }).then(function (all) {
      var t = db.transaction("note_queue", "readwrite");
      var store = t.objectStore("note_queue");
      for (var i = 0; i < all.length; i++) {
        if (all[i].status === "sent") store.delete(all[i].id);
      }
      return new Promise(function (resolve) { t.oncomplete = resolve; });
    });
  }

  // ── Notes History ──────────────────────────────────────────────
  function addToHistory(note) {
    return open().then(function () {
      return promisify(tx("notes_history", "readwrite").add(note));
    });
  }

  function getNotesHistory(limit) {
    limit = limit || 30;
    return open().then(function () {
      return promisify(tx("notes_history", "readonly").getAll());
    }).then(function (all) {
      // Newest first
      all.sort(function (a, b) {
        return (b.timestamp || "").localeCompare(a.timestamp || "");
      });
      return all.slice(0, limit);
    });
  }

  function clearNotesHistory() {
    return open().then(function () {
      return new Promise(function(resolve, reject) {
        var t = db.transaction("notes_history", "readwrite");
        t.objectStore("notes_history").clear();
        t.oncomplete = function() { resolve(); };
        t.onerror = function() { reject(t.error); };
      });
    });
  }

  // ── Replacement Log ──────────────────────────────────────────────
  function _hasStore(name) {
    return db && db.objectStoreNames.contains(name);
  }

  function addReplacement(entry) {
    return open().then(function () {
      if (!_hasStore("replacement_log")) return Promise.resolve();
      entry.status = "active";
      entry.timestamp = new Date().toISOString();
      return promisify(tx("replacement_log", "readwrite").add(entry));
    });
  }

  function getActiveReplacements() {
    return open().then(function () {
      if (!_hasStore("replacement_log")) return [];
      return promisify(tx("replacement_log", "readonly").getAll());
    }).then(function (all) {
      return (all || []).filter(function (r) { return r.status === "active"; });
    });
  }

  function getAllReplacements() {
    return open().then(function () {
      if (!_hasStore("replacement_log")) return [];
      return promisify(tx("replacement_log", "readonly").getAll());
    }).then(function (all) { return all || []; });
  }

  function updateReplacement(id, newStatus) {
    return open().then(function () {
      if (!_hasStore("replacement_log")) return;
      var store = tx("replacement_log", "readwrite");
      return promisify(store.get(id)).then(function (entry) {
        if (entry) {
          entry.status = newStatus;
          entry.updated_at = new Date().toISOString();
          return promisify(store.put(entry));
        }
      });
    });
  }

  function clearReplacements(statusFilter) {
    return open().then(function () {
      if (!_hasStore("replacement_log")) return;
      return promisify(tx("replacement_log", "readonly").getAll());
    }).then(function (all) {
      if (!all || all.length === 0) return;
      var t = db.transaction("replacement_log", "readwrite");
      var store = t.objectStore("replacement_log");
      for (var i = 0; i < all.length; i++) {
        if (!statusFilter || all[i].status === statusFilter) {
          store.delete(all[i].id);
        }
      }
      return new Promise(function (resolve) { t.oncomplete = resolve; });
    });
  }

  function isReplacementAssigned(replStock) {
    return getActiveReplacements().then(function (active) {
      for (var i = 0; i < active.length; i++) {
        if (active[i].repl_stock === replStock) return true;
      }
      return false;
    });
  }

  // ── Stats (computed from units) ────────────────────────────────
  function getInventoryStats() {
    return getAllUnits().then(function (units) {
      var stats = {
        total: units.length,
        by_status: {},
        by_area: {},
        by_type: {},
        flags: { critical: 0, warning: 0, info: 0 },
      };
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        var s = u.status || "UNKNOWN";
        var a = u.lot_area || "UNASSIGNED";
        var t = u.veh_type || "UNKNOWN";
        stats.by_status[s] = (stats.by_status[s] || 0) + 1;
        stats.by_area[a] = (stats.by_area[a] || 0) + 1;
        stats.by_type[t] = (stats.by_type[t] || 0) + 1;
      }
      return stats;
    });
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    open: open,
    putUnits: putUnits,
    getAllUnits: getAllUnits,
    getUnit: getUnit,
    searchUnits: searchUnits,
    getUnitsByIndex: getUnitsByIndex,
    setMeta: setMeta,
    getMeta: getMeta,
    queueNote: queueNote,
    getPendingNotes: getPendingNotes,
    markNoteSent: markNoteSent,
    clearSentNotes: clearSentNotes,
    addToHistory: addToHistory,
    getNotesHistory: getNotesHistory,
    clearNotesHistory: clearNotesHistory,
    addReplacement: addReplacement,
    getActiveReplacements: getActiveReplacements,
    getAllReplacements: getAllReplacements,
    updateReplacement: updateReplacement,
    clearReplacements: clearReplacements,
    isReplacementAssigned: isReplacementAssigned,
    getInventoryStats: getInventoryStats,
  };
})();
