/* ================================================================
   App — FTRV Lot Manager PWA
   Router, event handling, initialization.
   ================================================================ */

var App = (function () {

  var _currentView = "search";
  var _viewHistory = [];
  var _searchDebounce = null;

  // ── Data source URLs ────────────────────────────────────────────
  // Google Drive direct download — file is shared "anyone with link"
  var DRIVE_FILE_ID = "1p9x_nXbAQo0XthjsTrGnhKS-21okkTQp";
  var JSON_URL_PROD = "https://drive.google.com/uc?id=" + DRIVE_FILE_ID + "&export=download";

  // Apps Script endpoint for field note submission
  var APPS_SCRIPT_URL = "";  // Set after deployment

  function isLocal() {
    return location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  // ── Initialize ─────────────────────────────────────────────────
  function init() {
    DB.open().then(function () {
      // Use local demo data on localhost, Google Drive in production
      var jsonUrl = isLocal() ? "demo_data.json" : JSON_URL_PROD;
      Sync.configure({
        jsonUrl: jsonUrl,
        submitUrl: APPS_SCRIPT_URL,
      });
      Sync.init();

      // Route from hash
      routeFromHash();

      // Listen for hash changes
      window.addEventListener("hashchange", routeFromHash);

      // Delegate all clicks
      document.addEventListener("click", handleClick);

      // Initial sync
      Sync.fullSync(false).then(function () {
        // Re-render current view after sync
        routeFromHash();
        Sync.startAutoSync();
      });

      // Update queue badge
      Sync.updateQueueBadge();
    });

    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function (err) {
        console.warn("SW registration failed:", err);
      });
    }
  }


  // ── Routing ────────────────────────────────────────────────────
  function routeFromHash() {
    var hash = (location.hash || "#search").substring(1);
    var parts = hash.split("/");
    var view = parts[0] || "search";
    var param = parts[1] || "";
    var param2 = parts[2] || "";

    navigate(view, param, param2, true);
  }

  function navigate(view, param, param2, fromHash) {
    _currentView = view;

    // Update tab bar
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
      var tabView = tabs[i].getAttribute("data-view");
      if (tabView === view || (view === "detail" && tabView === "search")
          || (view === "zone-detail" && tabView === "lots")
          || (view === "area-detail" && tabView === "lots")
          || (view === "note-form" && tabView === "notes")) {
        tabs[i].classList.add("active");
      } else {
        tabs[i].classList.remove("active");
      }
    }

    // Update hash without triggering re-route
    var newHash = "#" + view + (param ? "/" + param : "") + (param2 ? "/" + param2 : "");
    if (!fromHash) {
      history.pushState(null, "", newHash);
    }

    // Render view
    var container = document.getElementById("viewContainer");
    var renderPromise;

    switch (view) {
      case "search":
        renderPromise = Views.searchView();
        break;
      case "detail":
        renderPromise = Views.unitDetailView(param);
        break;
      case "lots":
        renderPromise = Views.lotsView();
        break;
      case "zone-detail":
        renderPromise = Views.zoneDetailView(param);
        break;
      case "notes":
        renderPromise = Views.notesView();
        break;
      case "note-form":
        renderPromise = Views.noteFormView(param, param2);
        break;
      case "audit":
        renderPromise = Views.auditView();
        break;
      default:
        renderPromise = Views.searchView();
    }

    // Show skeleton while loading
    container.innerHTML = '<div style="padding:20px;">'
      + '<div class="skeleton" style="height:60px;margin-bottom:12px;"></div>'
      + '<div class="skeleton" style="height:120px;margin-bottom:12px;"></div>'
      + '<div class="skeleton" style="height:80px;"></div></div>';

    renderPromise.then(function (html) {
      container.innerHTML = html;
      container.scrollTop = 0;

      // Post-render hooks
      if (view === "search") initSearch();
      if (view === "detail") loadDupes(param);
      if (view === "note-form") initNoteForm();
      if (view === "audit") initAuditFilters();
    });
  }

  // ── Event Delegation ───────────────────────────────────────────
  function handleClick(e) {
    var el = e.target;

    // Result card / interactive card → detail
    var card = el.closest("[data-action]");
    if (card) {
      e.preventDefault();
      var action = card.getAttribute("data-action");

      if (action === "detail") {
        navigate("detail", card.getAttribute("data-stock"));
      } else if (action === "zone-detail") {
        navigate("zone-detail", card.getAttribute("data-zone"));
      } else if (action === "area-detail") {
        navigate("lots");  // For now, stay on lots
      } else if (action === "note-form") {
        navigate("note-form", card.getAttribute("data-type"), card.getAttribute("data-stock") || "");
      } else if (action === "verify-note") {
        navigate("note-form", "verify", card.getAttribute("data-stock"));
      } else if (action === "reorg-note") {
        navigate("note-form", "reorg", card.getAttribute("data-stock"));
      }
      return;
    }

    // Audit filter chips
    var chip = el.closest(".chip[data-filter]");
    if (chip) {
      e.preventDefault();
      var filter = chip.getAttribute("data-filter");
      var chips = document.querySelectorAll(".chip[data-filter]");
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove("active");
      chip.classList.add("active");

      DB.getAllUnits().then(function (units) {
        var flags = Views.computeAuditFlags(units);
        document.getElementById("auditList").innerHTML = Views.renderAuditFlags(flags, filter);
      });
      return;
    }
  }

  // ── Search ─────────────────────────────────────────────────────
  function initSearch() {
    var input = document.getElementById("searchInput");
    var clearBtn = document.getElementById("searchClear");
    var results = document.getElementById("searchResults");
    var dashboard = document.getElementById("searchDashboard");
    if (!input) return;

    input.focus();

    input.addEventListener("input", function () {
      clearTimeout(_searchDebounce);
      var q = input.value.trim();

      clearBtn.classList.toggle("show", q.length > 0);

      if (q.length < 2) {
        results.innerHTML = "";
        dashboard.style.display = "";
        return;
      }

      _searchDebounce = setTimeout(function () {
        DB.searchUnits(q).then(function (matches) {
          dashboard.style.display = matches.length > 0 ? "none" : "";

          // Exact match → go to detail
          if (matches.length === 1 && (
            matches[0].stock_num.toUpperCase() === q.toUpperCase()
            || (matches[0].vin && matches[0].vin.toUpperCase() === q.toUpperCase())
          )) {
            navigate("detail", matches[0].stock_num);
            return;
          }

          results.innerHTML = Views.renderSearchResults(matches);
        });
      }, 200);
    });

    clearBtn.addEventListener("click", function () {
      input.value = "";
      clearBtn.classList.remove("show");
      results.innerHTML = "";
      dashboard.style.display = "";
      input.focus();
    });

    // Enter key
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        var q = input.value.trim();
        if (q) {
          DB.searchUnits(q).then(function (matches) {
            if (matches.length === 1) {
              navigate("detail", matches[0].stock_num);
            } else {
              dashboard.style.display = matches.length > 0 ? "none" : "";
              results.innerHTML = Views.renderSearchResults(matches);
            }
          });
        }
      }
    });
  }

  // ── Duplicate units on detail page ─────────────────────────────
  function loadDupes(stockNum) {
    var section = document.getElementById("dupeSection");
    if (!section) return;
    var make = section.getAttribute("data-make");
    var model = section.getAttribute("data-model");
    var thisStock = section.getAttribute("data-stock");

    DB.getAllUnits().then(function (units) {
      var dupes = units.filter(function (u) {
        return u.make === make && u.model === model && u.stock_num !== thisStock;
      });
      if (dupes.length === 0) return;

      var h = '<div class="card mt-16"><div class="card-title">Same Model (' + dupes.length + ' others)</div>';
      for (var i = 0; i < dupes.length; i++) {
        var d = dupes[i];
        h += '<div class="result-card" style="margin-bottom:8px;padding:12px 16px;" data-action="detail" data-stock="' + Views.esc(d.stock_num) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<span style="font-size:20px;font-weight:700;">Stk# ' + Views.esc(d.stock_num) + '</span>'
          + '<span class="status-badge ' + (function(s){ var c=["READY FOR SALE","RVASAP","SHOWROOM","RESTOCK","RV SHOW UNIT","RV SHOW BACKUP","AS IS","STORM DAMAGE"]; return c.indexOf((s||"").toUpperCase())!==-1?"status-stock":"status-dead"; })(d.status) + '">' + Views.esc(d.status) + '</span>'
          + '</div>'
          + '<div style="font-size:18px;color:var(--text-2);margin-top:4px;">'
          + Views.esc(d.lot_location || "No lot") + ' &middot; ' + Views.esc(d.age || "?") + ' days'
          + '</div></div>';
      }
      h += '</div>';
      section.innerHTML = h;
    });
  }

  // ── Note Form ──────────────────────────────────────────────────
  function initNoteForm() {
    var form = document.getElementById("noteForm");
    if (!form) return;

    // Stock# auto-lookup
    var stockInput = document.getElementById("noteStock");
    if (stockInput && !stockInput.value) {
      stockInput.addEventListener("blur", function () {
        var val = stockInput.value.trim();
        if (!val) return;
        DB.getUnit(val.toUpperCase()).then(function (unit) {
          if (!unit) {
            DB.searchUnits(val).then(function (matches) {
              if (matches.length === 1) showUnitPreview(matches[0]);
            });
          } else {
            showUnitPreview(unit);
          }
        });
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = form.querySelector(".btn");
      var origText = btn.textContent;
      btn.textContent = "Saving...";
      btn.disabled = true;

      var data = {};
      var inputs = form.elements;
      for (var i = 0; i < inputs.length; i++) {
        if (inputs[i].name) {
          if (inputs[i].type === "radio") {
            if (inputs[i].checked) data[inputs[i].name] = inputs[i].value;
          } else {
            data[inputs[i].name] = inputs[i].value;
          }
        }
      }
      data.entry_type = form.getAttribute("data-type") === "verify" ? "Verify"
        : form.getAttribute("data-type") === "hole" ? "Hole" : "Reorg";

      // Queue locally
      DB.queueNote(data).then(function () {
        // Also add to local history
        return DB.addToHistory({
          timestamp: new Date().toISOString(),
          user: data.user,
          entry_type: data.entry_type,
          stock: data.stock || "",
          description: data.description || data.notes || "",
          zone: data.zone || "",
          verified: data.verified || "",
          status: "Queued",
        });
      }).then(function () {
        // Try to push immediately if online
        Sync.pushPendingNotes().then(function () {
          Sync.updateQueueBadge();
        });
        navigate("notes");
      }).catch(function (err) {
        btn.textContent = "Error: " + err.message;
        btn.disabled = false;
      });
    });
  }

  function showUnitPreview(unit) {
    var existing = document.getElementById("unitPreview");
    if (existing) existing.remove();

    var stockInput = document.getElementById("noteStock");
    if (!stockInput) return;

    var preview = document.createElement("div");
    preview.id = "unitPreview";
    preview.className = "card";
    preview.style.cssText = "background:var(--surface-1);border-color:var(--border-lt);margin-bottom:16px;padding:14px;";
    preview.innerHTML = '<div style="font-size:22px;font-weight:700;">' + Views.esc(unit.year) + ' ' + Views.esc(unit.make) + ' ' + Views.esc(unit.model) + '</div>'
      + '<div style="font-size:18px;color:var(--text-2);margin-top:4px;">VIN: ' + Views.esc(unit.vin) + '</div>'
      + '<div style="font-size:20px;margin-top:6px;">System Lot: <span class="text-blue fw-800">' + Views.esc(unit.lot_location || "NONE") + '</span></div>'
      + '<div style="font-size:18px;color:var(--text-3);margin-top:4px;">Status: ' + Views.esc(unit.status) + '</div>';
    stockInput.parentNode.insertBefore(preview, stockInput.nextSibling);
  }

  // ── Radio buttons ──────────────────────────────────────────────
  function selectRadio(el) {
    var group = el.parentElement;
    var labels = group.querySelectorAll(".form-radio");
    for (var i = 0; i < labels.length; i++) labels[i].classList.remove("selected");
    el.classList.add("selected");
    el.querySelector("input").checked = true;

    // Show/hide actual location field
    var val = el.querySelector("input").value;
    var wrap = document.getElementById("actualLocWrap");
    if (wrap) {
      wrap.style.display = (val === "No" || val === "Not Found") ? "block" : "none";
    }
  }

  // ── Audit filter chips ─────────────────────────────────────────
  function initAuditFilters() {
    // Already handled via event delegation in handleClick
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    init: init,
    navigate: navigate,
    selectRadio: selectRadio,
  };
})();

// Boot is handled by gate.js — Gate.check() calls App.init() after auth
