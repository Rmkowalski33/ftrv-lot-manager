/* ================================================================
   Sync Layer — FTRV Lot Manager PWA
   Pulls inventory JSON from Google Drive, pushes field notes to
   Google Apps Script endpoint. Works with offline queue.
   ================================================================ */

var Sync = (function () {

  // ── Config ─────────────────────────────────────────────────────
  var JSON_URL = "";      // Set by Sync.configure() — always the master data.json
  var SUBMIT_URL = "";
  var API_KEY = "FTRV-CLE-2026";
  var SYNC_INTERVAL = 5 * 60 * 1000;  // 5 minutes
  var _syncTimer = null;
  var _isSyncing = false;

  function configure(opts) {
    if (opts.jsonUrl)   JSON_URL   = opts.jsonUrl;
    if (opts.submitUrl) SUBMIT_URL = opts.submitUrl;
    if (opts.apiKey)    API_KEY    = opts.apiKey;
  }

  // ── Filter helper ───────────────────────────────────────────────
  // Applies the access-code filter rule to a single unit.
  // filter = { field: "pc", values: ["CLE", "BCLE"] }
  // Returns true if the unit passes (should be stored locally).
  function _matchesFilter(unit, filter) {
    if (!filter || !filter.field || !filter.values || !filter.values.length) return true;
    var unitVal = (unit[filter.field] || "").trim().toUpperCase();
    for (var i = 0; i < filter.values.length; i++) {
      if (filter.values[i].trim().toUpperCase() === unitVal) return true;
    }
    return false;
  }

  // ── UI Helpers ─────────────────────────────────────────────────
  function showSyncBar(msg) {
    var bar = document.getElementById("syncBar");
    var msgEl = document.getElementById("syncMsg");
    if (bar && msgEl) {
      msgEl.textContent = msg || "Syncing...";
      bar.classList.remove("hidden");
    }
  }

  function hideSyncBar() {
    var bar = document.getElementById("syncBar");
    if (bar) bar.classList.add("hidden");
  }

  function updateOnlineIndicator() {
    var dot = document.getElementById("headerOnline");
    if (dot) {
      if (navigator.onLine) {
        dot.classList.add("online");
      } else {
        dot.classList.remove("online");
      }
    }
  }

  // ── Pull Inventory ─────────────────────────────────────────────
  function pullInventory(silent) {
    if (_isSyncing) return Promise.resolve(false);
    if (!JSON_URL) return Promise.resolve(false);
    _isSyncing = true;

    if (!silent) showSyncBar("Syncing inventory...");

    return fetch(JSON_URL)
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        // Apply the access-code filter so only the user's units are stored
        var filter = Gate.getFilter();
        var unitList = [];
        var keys = Object.keys(data.units || {});
        var seen = {};
        for (var i = 0; i < keys.length; i++) {
          var u = data.units[keys[i]];
          if (!u.stock_num || seen[u.stock_num]) continue;
          if (!_matchesFilter(u, filter)) continue;
          seen[u.stock_num] = true;
          unitList.push(u);
        }

        // Apply the same location filter to retail sold records
        var soldList = (data.retail_sold_today || []).filter(function (s) {
          return _matchesFilter(s, filter);
        });

        return DB.putUnits(unitList).then(function (count) {
          var ts = data.exported_at || new Date().toISOString();
          return Promise.all([
            DB.setMeta("last_sync", ts),
            DB.setMeta("unit_count", count),
            DB.setMeta("exported_at", data.exported_at || ""),
            DB.setMeta("retail_sold_today", soldList),
          ]).then(function () {
            if (!silent) {
              showSyncBar(count + " units synced");
              setTimeout(hideSyncBar, 2000);
            }
            _isSyncing = false;
            return true;
          });
        });
      })
      .catch(function (err) {
        console.warn("Sync pull failed:", err.message);
        if (!silent) {
          showSyncBar("Offline — using cached data");
          setTimeout(hideSyncBar, 3000);
        }
        _isSyncing = false;
        return false;
      });
  }

  // ── Push Field Notes ───────────────────────────────────────────
  function pushPendingNotes() {
    if (!SUBMIT_URL || !navigator.onLine) return Promise.resolve(0);

    return DB.getPendingNotes().then(function (notes) {
      if (notes.length === 0) return 0;

      var promises = notes.map(function (note) {
        var payload = Object.assign({}, note);
        payload.key = API_KEY;
        payload.action = "submit_field_note";
        delete payload.id;
        delete payload.status;
        delete payload.queued_at;

        return fetch(SUBMIT_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          redirect: "follow",
          body: JSON.stringify(payload),
        })
          .then(function (res) {
            return res.json();
          })
          .then(function (result) {
            if (result && result.success) {
              return DB.markNoteSent(note.id).then(function () {
                return DB.addToHistory({
                  timestamp: note.queued_at,
                  user: note.user,
                  entry_type: note.entry_type,
                  stock: note.stock,
                  description: note.description,
                  zone: note.zone,
                  verified: note.verified,
                  status: "Submitted",
                });
              });
            } else {
              console.warn("Note rejected by server:", result && result.error);
              // Don't mark as sent — keep in queue for retry
            }
          })
          .catch(function (err) {
            console.warn("Note push failed:", err.message);
            // Keep in queue for retry on next sync
          });
      });

      return Promise.all(promises).then(function () {
        return DB.clearSentNotes().then(function () {
          return notes.length;
        });
      });
    });
  }

  // ── Full Sync (pull + push) ────────────────────────────────────
  function fullSync(silent) {
    updateOnlineIndicator();
    if (!navigator.onLine) {
      if (!silent) {
        showSyncBar("Offline — using cached data");
        setTimeout(hideSyncBar, 3000);
      }
      return Promise.resolve(false);
    }

    return pullInventory(silent).then(function (pulled) {
      return pushPendingNotes().then(function (pushed) {
        updateQueueBadge();
        return pulled;
      });
    });
  }

  // ── Auto-sync Timer ────────────────────────────────────────────
  function startAutoSync() {
    stopAutoSync();
    _syncTimer = setInterval(function () {
      fullSync(true);
    }, SYNC_INTERVAL);
  }

  function stopAutoSync() {
    if (_syncTimer) {
      clearInterval(_syncTimer);
      _syncTimer = null;
    }
  }

  // ── Queue Badge ────────────────────────────────────────────────
  function updateQueueBadge() {
    DB.getPendingNotes().then(function (notes) {
      var notesTab = document.querySelector('.tab[data-view="notes"]');
      if (!notesTab) return;
      var badge = notesTab.querySelector(".queue-badge");
      if (notes.length > 0) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "queue-badge";
          notesTab.appendChild(badge);
        }
        badge.textContent = notes.length;
      } else if (badge) {
        badge.remove();
      }
    });
  }

  // ── Network status listeners ───────────────────────────────────
  function init() {
    window.addEventListener("online", function () {
      updateOnlineIndicator();
      fullSync(false);
    });
    window.addEventListener("offline", function () {
      updateOnlineIndicator();
    });
    updateOnlineIndicator();
  }

  return {
    configure: configure,
    pullInventory: pullInventory,
    pushPendingNotes: pushPendingNotes,
    fullSync: fullSync,
    startAutoSync: startAutoSync,
    stopAutoSync: stopAutoSync,
    updateQueueBadge: updateQueueBadge,
    hideSyncBar: hideSyncBar,
    init: init,
  };
})();
