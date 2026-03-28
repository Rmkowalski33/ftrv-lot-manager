/* ================================================================
   Access Gate — FTRV Lot Manager PWA
   Access codes stored in access_codes.json on GitHub Pages.
   Each code maps to a location so the app fetches the right
   data file and displays the correct location name.

   Format of access_codes.json:
     {
       "FTRV-CLE-2026": { "location": "CLE", "name": "Cleburne",
                          "data_file": "data-CLE.json", "type": "internal" },
       "FTRV-AUS-2026": { "location": "AUS", "name": "Austin",  ... }
     }

   To add a location: add an entry to access_codes.json and push.
   To rotate a code: change the key and push. No redeployment needed.
   ================================================================ */

var Gate = (function () {

  var STORAGE_KEY  = "ftrv_access_code";
  var LOCATION_KEY = "ftrv_location";

  // Fallback map — used if fetch fails (e.g. offline on first visit)
  var FALLBACK_MAP = {
    "FTRV-CLE-2026": { location: "CLE", name: "Cleburne", data_file: "data-CLE.json", type: "internal" }
  };
  var _locationMap = FALLBACK_MAP;

  // ── Load code map from GitHub Pages ────────────────────────────
  function _loadCodes() {
    return fetch("access_codes.json?_=" + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data) return;

        var map = {};

        // Legacy format: { "codes": ["FTRV-CLE-2026", ...] }
        if (data.codes && Array.isArray(data.codes)) {
          data.codes.forEach(function (c) {
            var upper = c.toUpperCase();
            map[upper] = FALLBACK_MAP[upper] ||
              { location: "CLE", name: "Cleburne", data_file: "data-CLE.json", type: "internal" };
          });
        } else {
          // New dict format: { "FTRV-CLE-2026": { location, name, data_file, type }, ... }
          Object.keys(data).forEach(function (k) {
            map[k.toUpperCase()] = data[k];
          });
        }

        if (Object.keys(map).length > 0) _locationMap = map;
      })
      .catch(function () {
        // Offline or file missing — use fallback
      });
  }

  // ── Storage helpers ─────────────────────────────────────────────
  function getSavedCode() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function saveCode(code) {
    try {
      var upper = code.trim().toUpperCase();
      localStorage.setItem(STORAGE_KEY, upper);
      var loc = _locationMap[upper];
      if (loc) localStorage.setItem(LOCATION_KEY, JSON.stringify(loc));
    } catch (e) { /* ignore */ }
  }

  function clearCode() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LOCATION_KEY);
    } catch (e) { /* ignore */ }
  }

  // ── Location context ────────────────────────────────────────────
  function getLocation() {
    try {
      var stored = localStorage.getItem(LOCATION_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    // Derive from saved code if storage entry is missing
    var code = getSavedCode();
    if (code && _locationMap[code]) return _locationMap[code];
    return { location: "CLE", name: "Cleburne", data_file: "data-CLE.json", type: "internal" };
  }

  // ── Validation ──────────────────────────────────────────────────
  function isValidCode(code) {
    if (!code) return false;
    return !!_locationMap[code.trim().toUpperCase()];
  }

  function isAuthenticated() {
    return isValidCode(getSavedCode());
  }

  // ── Gate screen ─────────────────────────────────────────────────
  function showGate() {
    var app   = document.getElementById("appShell");
    var gate  = document.getElementById("gateScreen");
    if (app)  app.style.display  = "none";
    if (gate) gate.style.display = "flex";

    var input = document.getElementById("gateInput");
    var btn   = document.getElementById("gateSubmit");
    var error = document.getElementById("gateError");

    if (input) input.focus();

    function tryCode() {
      var code = input ? input.value.trim() : "";
      if (isValidCode(code)) {
        saveCode(code);
        if (error) error.style.display = "none";
        if (gate)  gate.style.display  = "none";
        if (app)   app.style.display   = "";
        App.init();
      } else {
        if (error) error.style.display = "block";
        if (input) { input.value = ""; input.focus(); }
      }
    }

    if (btn)   btn.addEventListener("click", tryCode);
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); tryCode(); }
    });
  }

  // ── Main entry point ────────────────────────────────────────────
  function check() {
    _loadCodes().then(function () {
      if (isAuthenticated()) {
        // Refresh stored location metadata in case the map changed
        var code = getSavedCode();
        if (code && _locationMap[code]) {
          try { localStorage.setItem(LOCATION_KEY, JSON.stringify(_locationMap[code])); } catch (e) {}
        }
        var gate = document.getElementById("gateScreen");
        if (gate) gate.style.display = "none";
        App.init();
      } else {
        clearCode();
        showGate();
      }
    });
  }

  return {
    check:           check,
    isAuthenticated: isAuthenticated,
    clearCode:       clearCode,
    getLocation:     getLocation,
  };
})();

// Boot — gate check instead of direct App.init()
document.addEventListener("DOMContentLoaded", Gate.check);
