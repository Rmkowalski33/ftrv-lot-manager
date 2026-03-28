/* ================================================================
   Access Gate — FTRV Lot Manager PWA

   Each access code maps to a filter rule that scopes what data
   the user sees. One master data.json is fetched; the filter is
   applied at sync time so only the user's units are stored locally.

   access_codes.json format:
   {
     "FTRV-CLE-2026": {
       "type":     "internal",          // "internal" | "manufacturer"
       "name":     "Cleburne",          // human-readable label
       "location": "CLE",              // location code (internal) or brand (mfr)
       "filter":   { "field": "pc", "values": ["CLE", "BCLE"] }
     }
   }

   To add a location: add an entry to access_codes.json and push.
   To rotate a code:  change the key and push. No redeployment needed.
   ================================================================ */

var Gate = (function () {

  var STORAGE_KEY = "ftrv_access_code";
  var CONTEXT_KEY = "ftrv_context";

  // Fallback — used if fetch fails (e.g. offline on first visit)
  var FALLBACK_MAP = {
    "FTRV-CLE-2026": {
      type: "internal", name: "Cleburne", location: "CLE",
      filter: { field: "pc", values: ["CLE", "BCLE"] }
    }
  };
  var _codeMap = FALLBACK_MAP;

  // ── Load code map from GitHub Pages ────────────────────────────
  function _loadCodes() {
    return fetch("access_codes.json?_=" + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data) return;
        var map = {};

        // Legacy array format: { "codes": ["FTRV-CLE-2026"] }
        if (data.codes && Array.isArray(data.codes)) {
          data.codes.forEach(function (c) {
            var upper = c.toUpperCase();
            map[upper] = FALLBACK_MAP[upper] || FALLBACK_MAP["FTRV-CLE-2026"];
          });
        } else {
          // Current dict format: { "CODE": { type, name, location, filter } }
          Object.keys(data).forEach(function (k) {
            map[k.toUpperCase()] = data[k];
          });
        }

        if (Object.keys(map).length > 0) _codeMap = map;
      })
      .catch(function () { /* offline — use fallback */ });
  }

  // ── Storage helpers ─────────────────────────────────────────────
  function getSavedCode() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function _saveContext(code) {
    try {
      var upper = code.trim().toUpperCase();
      localStorage.setItem(STORAGE_KEY, upper);
      var ctx = _codeMap[upper];
      if (ctx) localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
    } catch (e) { /* ignore */ }
  }

  function clearCode() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CONTEXT_KEY);
    } catch (e) { /* ignore */ }
  }

  // ── Context accessors ───────────────────────────────────────────
  function _getContext() {
    try {
      var stored = localStorage.getItem(CONTEXT_KEY);
      if (stored) return JSON.parse(stored);
    } catch (e) { /* ignore */ }
    // Derive from saved code
    var code = getSavedCode();
    if (code && _codeMap[code]) return _codeMap[code];
    return FALLBACK_MAP["FTRV-CLE-2026"];
  }

  /** Returns the filter rule: { field, values } */
  function getFilter() {
    return _getContext().filter || null;
  }

  /** Returns location code string (e.g. "CLE") — kept for backward compat */
  function getLocation() {
    var ctx = _getContext();
    // Support both new { location } and legacy { data_file } shapes
    return {
      location: ctx.location || "CLE",
      name:     ctx.name     || "Cleburne",
      type:     ctx.type     || "internal",
    };
  }

  // ── Validation ──────────────────────────────────────────────────
  function isValidCode(code) {
    if (!code) return false;
    return !!_codeMap[code.trim().toUpperCase()];
  }

  function isAuthenticated() {
    return isValidCode(getSavedCode());
  }

  // ── Gate screen ─────────────────────────────────────────────────
  function showGate() {
    var app  = document.getElementById("appShell");
    var gate = document.getElementById("gateScreen");
    if (app)  app.style.display  = "none";
    if (gate) gate.style.display = "flex";

    var input = document.getElementById("gateInput");
    var btn   = document.getElementById("gateSubmit");
    var error = document.getElementById("gateError");
    if (input) input.focus();

    function tryCode() {
      var code = input ? input.value.trim() : "";
      if (isValidCode(code)) {
        _saveContext(code);
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
        // Refresh stored context in case the map was updated
        var code = getSavedCode();
        if (code && _codeMap[code]) {
          try { localStorage.setItem(CONTEXT_KEY, JSON.stringify(_codeMap[code])); } catch (e) {}
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
    getFilter:       getFilter,
    getLocation:     getLocation,   // backward compat
  };
})();

// Boot
document.addEventListener("DOMContentLoaded", Gate.check);
