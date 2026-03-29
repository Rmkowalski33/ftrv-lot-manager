/* ================================================================
   Access Gate — FTRV Lot Manager PWA

   Each access code maps to a filter rule that scopes what data
   the user sees. One master data.json is fetched; the filter is
   applied at sync time so only the user's units are stored locally.

   access_codes.json format:
   {
     "FTRV-CLE-2026": {
       "type":     "internal",          // "internal" | "admin"
       "name":     "Cleburne",          // human-readable label
       "location": "CLE",              // PC code
       "state":    "TX",
       "zone":     "TX-NCENTRAL",
       "filter":   { "field": "pc", "values": ["CLE", "BCLE"] }
     },
     "FTRV-CORP-2026": {
       "type":     "admin",             // sees location picker
       "name":     "Corporate",
       "location": "CORP"
     }
   }

   To add a location: add an entry to access_codes.json and push.
   To rotate a code:  change the key and push. No redeployment needed.
   ================================================================ */

var Gate = (function () {

  var STORAGE_KEY  = "ftrv_access_code";
  var CONTEXT_KEY  = "ftrv_context";
  var ADMIN_LOC_KEY = "ftrv_admin_loc";   // admin's selected location PC

  // Fallback — used if fetch fails (e.g. offline on first visit)
  var FALLBACK_MAP = {
    "FTRV-CLE-2026": {
      type: "internal", name: "Cleburne", location: "CLE",
      state: "TX", zone: "TX-NCENTRAL",
      filter: { field: "pc", values: ["CLE", "BCLE"] }
    },
    "FTRV-CORP-2026": {
      type: "admin", name: "Corporate", location: "CORP",
      state: "TX", zone: "OTHER"
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
      localStorage.removeItem(ADMIN_LOC_KEY);
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

  // ── Admin helpers ───────────────────────────────────────────────

  /** Returns true if the authenticated user has admin (corp) access */
  function isAdmin() {
    var code = getSavedCode();
    return !!(code && _codeMap[code] && _codeMap[code].type === "admin");
  }

  /** Returns the PC code the admin has selected, or null if none */
  function getAdminSelection() {
    try { return localStorage.getItem(ADMIN_LOC_KEY) || null; } catch (e) { return null; }
  }

  /** Stores admin's selected location PC so subsequent syncs apply the right filter */
  function setAdminLocation(pc) {
    try { localStorage.setItem(ADMIN_LOC_KEY, pc.trim().toUpperCase()); } catch (e) { /* ignore */ }
  }

  /** Returns admin to the location picker */
  function clearAdminLocation() {
    try { localStorage.removeItem(ADMIN_LOC_KEY); } catch (e) { /* ignore */ }
  }

  /**
   * Returns the filter rule for a given location PC code.
   * Searches the code map for an entry whose .location matches the PC.
   * Falls back to a simple single-value filter if not found.
   */
  function getFilterForLocation(pc) {
    var upper = (pc || "").trim().toUpperCase();
    var keys = Object.keys(_codeMap);
    for (var i = 0; i < keys.length; i++) {
      var ctx = _codeMap[keys[i]];
      if (ctx.location && ctx.location.toUpperCase() === upper) {
        return ctx.filter || { field: "pc", values: [upper] };
      }
    }
    // Fallback: simple filter on the PC itself
    return { field: "pc", values: [upper] };
  }

  /**
   * Returns the full code map — used by location picker to build the UI.
   * Do NOT mutate the returned object.
   */
  function getCodeMap() {
    return _codeMap;
  }

  // ── Public filter / location accessors ─────────────────────────

  /**
   * Returns the active filter rule: { field, values }.
   * Admin: returns the selected location's filter (or null if no location picked yet).
   * Regular user: returns their access-code filter.
   */
  function getFilter() {
    if (isAdmin()) {
      var sel = getAdminSelection();
      if (sel) return getFilterForLocation(sel);
      return null;   // no selection — caller should show picker, not sync
    }
    return _getContext().filter || null;
  }

  /**
   * Returns location info: { location, name, type, state, zone }.
   * Admin: reflects the currently selected location (or CORP if none).
   */
  function getLocation() {
    if (isAdmin()) {
      var sel = getAdminSelection();
      if (sel) {
        var upper = sel.toUpperCase();
        var keys = Object.keys(_codeMap);
        for (var i = 0; i < keys.length; i++) {
          var ctx = _codeMap[keys[i]];
          if (ctx.location && ctx.location.toUpperCase() === upper) {
            return {
              location: ctx.location,
              name:     ctx.name     || sel,
              type:     "admin-view",
              state:    ctx.state    || "",
              zone:     ctx.zone     || "",
            };
          }
        }
      }
      return { location: "CORP", name: "Corporate", type: "admin", state: "TX", zone: "OTHER" };
    }
    var ctx2 = _getContext();
    return {
      location: ctx2.location || "CLE",
      name:     ctx2.name     || "Cleburne",
      type:     ctx2.type     || "internal",
      state:    ctx2.state    || "",
      zone:     ctx2.zone     || "",
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
    check:                check,
    isAuthenticated:      isAuthenticated,
    isAdmin:              isAdmin,
    clearCode:            clearCode,
    getFilter:            getFilter,
    getLocation:          getLocation,       // backward compat
    getAdminSelection:    getAdminSelection,
    setAdminLocation:     setAdminLocation,
    clearAdminLocation:   clearAdminLocation,
    getFilterForLocation: getFilterForLocation,
    getCodeMap:           getCodeMap,
  };
})();

// Boot
document.addEventListener("DOMContentLoaded", Gate.check);
