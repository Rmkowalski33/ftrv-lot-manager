/* ================================================================
   Access Gate — FTRV Lot Manager PWA
   Simple access code check. Valid codes stored on Google Drive
   so they can be rotated without redeploying the app.
   ================================================================ */

var Gate = (function () {

  var STORAGE_KEY = "ftrv_access_code";

  // Valid access codes — rotated by updating this list.
  // When you want to rotate: change the code here, redeploy,
  // and text the new code to the team.
  var VALID_CODES = ["FTRV-0326"];

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
    for (var i = 0; i < VALID_CODES.length; i++) {
      if (VALID_CODES[i].toUpperCase() === upper) return true;
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

  // Main entry: check code and either show app or gate
  function check() {
    if (isAuthenticated()) {
      var gate = document.getElementById("gateScreen");
      if (gate) gate.style.display = "none";
      App.init();
    } else {
      showGate();
    }
  }

  return {
    check: check,
    isAuthenticated: isAuthenticated,
    clearCode: clearCode,
  };
})();

// Boot — gate check instead of direct App.init()
document.addEventListener("DOMContentLoaded", Gate.check);
