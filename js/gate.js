/* ================================================================
   Access Gate — FTRV Lot Manager PWA
   Simple access code check. Valid codes stored on Google Drive
   so they can be rotated without redeploying the app.
   ================================================================ */

var Gate = (function () {

  var STORAGE_KEY = "ftrv_access_code";

  // Access codes are loaded from access_codes.json at startup.
  // To rotate codes: edit access_codes.json and push to GitHub Pages.
  // No app redeployment needed — users with old codes get re-gated immediately.
  //
  // Fallback codes (used if fetch fails, e.g., offline first visit):
  var FALLBACK_CODES = ["FTRV-CLE-2026"];
  var _validCodes = FALLBACK_CODES;

  function _loadCodes() {
    return fetch("access_codes.json?_=" + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data && data.codes && data.codes.length > 0) {
          _validCodes = data.codes.map(function (c) { return c.toUpperCase(); });
        }
      })
      .catch(function () {
        // Offline or file missing — use fallback
      });
  }

  function getSavedCode() {
    try { return localStorage.getItem(STORAGE_KEY); } catch (e) { return null; }
  }

  function saveCode(code) {
    try { localStorage.setItem(STORAGE_KEY, code); } catch (e) { /* ignore */ }
  }

  function clearCode() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function isValidCode(code) {
    if (!code) return false;
    var upper = code.trim().toUpperCase();
    for (var i = 0; i < _validCodes.length; i++) {
      if (_validCodes[i] === upper) return true;
    }
    return false;
  }

  // Check if user is already authenticated
  function isAuthenticated() {
    return isValidCode(getSavedCode());
  }

  // Show the gate screen
  function showGate() {
    var app = document.getElementById("appShell");
    var gate = document.getElementById("gateScreen");
    if (app) app.style.display = "none";
    if (gate) gate.style.display = "flex";

    var input = document.getElementById("gateInput");
    var btn = document.getElementById("gateSubmit");
    var error = document.getElementById("gateError");

    if (input) input.focus();

    function tryCode() {
      var code = input.value.trim();
      if (isValidCode(code)) {
        saveCode(code.toUpperCase());
        if (error) error.style.display = "none";
        if (gate) gate.style.display = "none";
        if (app) app.style.display = "";
        App.init();
      } else {
        if (error) error.style.display = "block";
        input.value = "";
        input.focus();
      }
    }

    if (btn) btn.addEventListener("click", tryCode);
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); tryCode(); }
    });
  }

  // Main entry: load codes from JSON, then check
  function check() {
    _loadCodes().then(function () {
      if (isAuthenticated()) {
        var gate = document.getElementById("gateScreen");
        if (gate) gate.style.display = "none";
        App.init();
      } else {
        // Old code no longer valid — clear it so they see the gate
        clearCode();
        showGate();
      }
    });
  }

  return {
    check: check,
    isAuthenticated: isAuthenticated,
    clearCode: clearCode,
  };
})();

// Boot — gate check instead of direct App.init()
document.addEventListener("DOMContentLoaded", Gate.check);
