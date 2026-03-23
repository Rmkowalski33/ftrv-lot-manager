/* ================================================================
   App — FTRV Lot Manager PWA
   Router, event handling, initialization.
   ================================================================ */

var App = (function () {

  var _currentView = "home";
  var _searchDebounce = null;

  // ── Data source URLs ────────────────────────────────────────────
  var JSON_URL_PROD = "data.json";
  var APPS_SCRIPT_BASE = "https://script.google.com/macros/s/AKfycbwx7RyEKHSdBIU2yn-tU33Z5Q1Hbwhog1OGABalHIZGGhJlFRwnOM9GlZAmyqNDcrk/exec";
  var APPS_SCRIPT_URL = APPS_SCRIPT_BASE;

  function isLocal() {
    return location.hostname === "localhost" || location.hostname === "127.0.0.1";
  }

  // ── Root views (no back button) ────────────────────────────────
  var ROOT_VIEWS = ["home", "notes", "audit", "activity", "coverage"];

  // ── Tab mapping: view → which tab to highlight ─────────────────
  var TAB_MAP = {
    "home": "home", "search": "home", "detail": "home", "unit-dupes": "home", "unit-similar": "home",
    "lots": "home", "lot-map": "home", "area-detail": "home", "zone-detail": "home",
    "status": "home", "status-cat": "home", "status-units": "home",
    "makes": "home", "make-detail": "home", "model-units": "home",
    "shop": "home", "shop-body": "home", "shop-layout": "home",
    "notes": "notes", "note-form": "notes",
    "audit": "audit", "audit-status": "audit", "hierarchy": "audit", "hierarchy-detail": "audit",
    "activity": "activity", "sales-section": "activity", "sales-make": "activity", "sales-units": "activity",
    "incoming": "activity", "incoming-status": "activity", "incoming-make": "activity", "incoming-units": "activity",
    "replace-picker": "activity", "repl-log": "coverage",
    "help": "home", "all-inventory": "home",
    "coverage": "coverage", "coverage-matrix": "coverage", "zone-map": "coverage",
    "overflow-only": "coverage",
  };

  // ── Initialize ─────────────────────────────────────────────────
  function init() {
    DB.open().then(function () {
      var jsonUrl = isLocal() ? "demo_data.json" : JSON_URL_PROD;
      Sync.configure({
        jsonUrl: jsonUrl,
        submitUrl: APPS_SCRIPT_URL,
      });
      Sync.init();

      routeFromHash();
      window.addEventListener("hashchange", routeFromHash);
      document.addEventListener("click", handleClick);

      Sync.fullSync(false).then(function () {
        routeFromHash();
        Sync.startAutoSync();
      });

      Sync.updateQueueBadge();
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("sw.js").catch(function (err) {
        console.warn("SW registration failed:", err);
      });
    }
  }


  // ── Routing ────────────────────────────────────────────────────
  function routeFromHash() {
    var hash = (location.hash || "#home").substring(1);
    var parts = hash.split("/");
    var view = parts[0] || "home";
    var param = decodeURIComponent(parts[1] || "");
    var param2 = decodeURIComponent(parts[2] || "");

    // Backward compat: "search" → "home"
    if (view === "search") view = "home";

    navigate(view, param, param2, true);
  }

  function navigate(view, param, param2, fromHash) {
    _currentView = view;

    // Update tab bar
    var activeTab = TAB_MAP[view] || "home";
    var tabs = document.querySelectorAll(".tab");
    for (var i = 0; i < tabs.length; i++) {
      var tabView = tabs[i].getAttribute("data-view");
      if (tabView === activeTab) {
        tabs[i].classList.add("active");
      } else {
        tabs[i].classList.remove("active");
      }
    }

    // Back button visibility
    var backBtn = document.getElementById("headerBack");
    if (backBtn) {
      backBtn.style.display = ROOT_VIEWS.indexOf(view) === -1 ? "" : "none";
    }

    // Update hash
    var newHash = "#" + view + (param ? "/" + encodeURIComponent(param) : "") + (param2 ? "/" + encodeURIComponent(param2) : "");
    if (!fromHash) {
      history.pushState(null, "", newHash);
    }

    // Render view
    var container = document.getElementById("viewContainer");
    var renderPromise;

    switch (view) {
      case "home":
        renderPromise = Views.homeView();
        break;
      case "all-inventory":
        renderPromise = Views.allInventoryView(param);
        break;
      case "detail":
        renderPromise = Views.unitDetailView(param);
        break;
      case "unit-dupes":
        renderPromise = Views.unitDupesView(param);
        break;
      case "unit-similar":
        renderPromise = Views.unitSimilarView(param);
        break;
      case "lots":
        renderPromise = Views.lotsView();
        break;
      case "lot-map":
        renderPromise = Views.lotMapView();
        break;
      case "area-detail":
        renderPromise = Views.areaDetailView(param);
        break;
      case "zone-detail":
        renderPromise = Views.zoneDetailView(param);
        break;
      case "status":
        renderPromise = Views.statusView();
        break;
      case "status-cat":
        renderPromise = Views.statusCategoryView(param);
        break;
      case "status-units":
        renderPromise = Views.statusUnitsView(param);
        break;
      case "makes":
        renderPromise = Views.makesView();
        break;
      case "make-detail":
        renderPromise = Views.makeDetailView(param);
        break;
      case "model-units":
        renderPromise = Views.modelUnitsView(param, param2);
        break;
      case "shop":
        renderPromise = Views.shopView();
        break;
      case "shop-body":
        renderPromise = Views.shopBodyView(param);
        break;
      case "shop-layout":
        renderPromise = Views.shopLayoutView(param, param2);
        break;
      case "coverage":
        renderPromise = Views.coverageTabView();
        break;
      case "coverage-matrix":
        renderPromise = Views.coverageView();
        break;
      case "zone-map":
        renderPromise = Views.zoneMapView();
        break;
      case "overflow-only":
        renderPromise = Views.overflowOnlyView();
        break;
      case "hierarchy":
        renderPromise = Views.hierarchyView();
        break;
      case "hierarchy-detail":
        renderPromise = Views.hierarchyDetailView(param);
        break;
      case "notes":
        renderPromise = Views.notesView();
        break;
      case "note-form":
        renderPromise = Views.noteFormView(param, param2);
        break;
      case "audit":
        renderPromise = Views.auditTabView();
        break;
      case "audit-status":
        renderPromise = Views.auditStatusView();
        break;
      case "activity":
        renderPromise = Views.activityView();
        break;
      case "sales-section":
        renderPromise = Views.salesSectionView(param, param2);
        break;
      case "sales-make":
        renderPromise = Views.salesMakeView(param, param2);
        break;
      case "sales-units":
        renderPromise = Views.salesUnitsView(param, param2);
        break;
      case "replace-picker":
        renderPromise = Views.replacePickerView(param);
        break;
      case "repl-log":
        renderPromise = Views.replLogView();
        break;
      case "help":
        renderPromise = Views.helpView();
        break;
      case "incoming":
        renderPromise = Views.incomingView();
        break;
      case "incoming-status":
        renderPromise = Views.incomingStatusView(param);
        break;
      case "incoming-make":
        renderPromise = Views.incomingMakeView(param);
        break;
      case "incoming-units":
        renderPromise = Views.incomingUnitsView(param, param2);
        break;
      default:
        renderPromise = Views.homeView();
    }

    // Skeleton while loading
    container.innerHTML = '<div style="padding:20px;">'
      + '<div class="skeleton" style="height:60px;margin-bottom:12px;"></div>'
      + '<div class="skeleton" style="height:120px;margin-bottom:12px;"></div>'
      + '<div class="skeleton" style="height:80px;"></div></div>';

    renderPromise.then(function (html) {
      // Inject "Data as of" timestamp at top of every view (skip home — has its own)
      DB.getMeta("exported_at").then(function (exportedAt) {
        if (exportedAt && view !== "home") {
          var ts = '<div style="text-align:right;font-size:11px;color:#8899aa;padding:2px 8px 0;opacity:0.7;">Updated ' + exportedAt + '</div>';
          container.innerHTML = ts + html;
        } else {
          container.innerHTML = html;
        }
        container.scrollTop = 0;
        // Post-render hooks
        if (view === "home") initSearch();
        if (view === "detail") loadDupes(param);
        if (view === "note-form") initNoteForm();
        if (view === "audit-status") initAuditFilters();
      }).catch(function () {
        container.innerHTML = html;
        container.scrollTop = 0;
        if (view === "home") initSearch();
        if (view === "detail") loadDupes(param);
        if (view === "note-form") initNoteForm();
        if (view === "audit-status") initAuditFilters();
      });
    });
  }

  // ── Event Delegation ───────────────────────────────────────────
  function handleClick(e) {
    var el = e.target;

    // Action cards
    var card = el.closest("[data-action]");
    if (card) {
      e.preventDefault();
      var action = card.getAttribute("data-action");

      if (action === "detail") {
        navigate("detail", card.getAttribute("data-stock"));
      } else if (action === "zone-detail") {
        navigate("zone-detail", card.getAttribute("data-zone"));
      } else if (action === "area-detail") {
        navigate("area-detail", card.getAttribute("data-area"));
      } else if (action === "status-cat") {
        navigate("status-cat", card.getAttribute("data-category"));
      } else if (action === "status-units") {
        navigate("status-units", card.getAttribute("data-status"));
      } else if (action === "make-detail") {
        navigate("make-detail", card.getAttribute("data-manufacturer"));
      } else if (action === "model-units") {
        navigate("model-units", card.getAttribute("data-make"), card.getAttribute("data-manufacturer") || "");
      } else if (action === "shop-body") {
        navigate("shop-body", card.getAttribute("data-type"));
      } else if (action === "shop-layout") {
        navigate("shop-layout", card.getAttribute("data-type"), card.getAttribute("data-body"));
      } else if (action === "note-form") {
        navigate("note-form", card.getAttribute("data-type"), card.getAttribute("data-stock") || "");
      } else if (action === "verify-note") {
        navigate("note-form", "verify", card.getAttribute("data-stock"));
      } else if (action === "reorg-note") {
        navigate("note-form", "reorg", card.getAttribute("data-stock"));
      } else if (action === "confirm-replace") {
        var spStock = card.getAttribute("data-sp-stock");
        var replStock = card.getAttribute("data-repl-stock");
        // Block duplicate assignments
        DB.isReplacementAssigned(replStock).then(function (isDupe) {
          if (isDupe) {
            alert("This unit (" + replStock + ") is already assigned as a replacement.\n\nCheck the Replacement Log on the Coverage tab.");
            return;
          }
          if (!confirm("Replace " + spStock + " with " + replStock + "?\n\nThis will submit a move instruction to the lot management sheet.")) return;
          // Gather unit details for the submission
          Promise.all([DB.getUnit(spStock), DB.getUnit(replStock)]).then(function (res) {
          var sp = res[0], repl = res[1];
          if (!sp || !repl) { alert("Unit data not found"); return; }
          var payload = {
            key: localStorage.getItem("ftrv_access_code") || "",
            action: "submit_field_note",
            entry_type: "replacement",
            stock: repl.stock_num,
            vin: repl.vin || "",
            year: repl.year || "",
            make: repl.make || "",
            model: repl.model || "",
            unit_status: repl.status || "",
            status_days: repl.status_days || "",
            lot_code_system: repl.lot_location || "",
            lot_area: repl.lot_area || "",
            zone: sp.lot_location || "",
            description: "REPLACEMENT: Move " + repl.stock_num + " (" + (repl.year||"") + " " + (repl.make||"") + " " + (repl.model||"") + ") from " + (repl.lot_location||"") + " to " + (sp.lot_location||"") + " to replace sale pending unit " + sp.stock_num + " (" + (sp.year||"") + " " + (sp.make||"") + " " + (sp.model||"") + ")",
            suggested_action: "[Replacement]",
            notes: "Replacing SP unit " + sp.stock_num + " | Salesman: " + (sp.hold_salesman || "N/A"),
            user: localStorage.getItem("ftrv_user") || "App User",
          };
          // Save to local replacement log
          var logEntry = {
            sp_stock: sp.stock_num,
            sp_desc: (sp.year||"") + " " + (sp.make||"") + " " + (sp.model||""),
            sp_location: sp.lot_location || "",
            sp_area: sp.lot_area || "",
            sp_salesman: sp.hold_salesman || "",
            repl_stock: repl.stock_num,
            repl_desc: (repl.year||"") + " " + (repl.make||"") + " " + (repl.model||""),
            repl_location: repl.lot_location || "",
            repl_area: repl.lot_area || "",
            repl_status: repl.status || "",
          };
          DB.addReplacement(logEntry);

          Sync.submitNote(payload).then(function (ok) {
            if (ok) {
              alert("Replacement submitted!\n\nMove " + repl.stock_num + " from " + (repl.lot_location||"OVR") + " to " + (sp.lot_location||"display"));
              navigate("activity");
            } else {
              alert("Submission queued — will sync when online.");
              navigate("activity");
            }
          });
        });
        }); // close isDupe check
      } else if (action === "clear-notes-history") {
        if (confirm("Clear all recent notes from local history?\n\nThis only clears the display — submitted notes remain on the Google Sheet.")) {
          DB.clearNotesHistory().then(function() { navigate("notes"); }).catch(function(e) { alert("Error: " + e); navigate("notes"); });
        }
      }
      return;
    }

    // Replacement log actions
    var replAction = el.closest("[data-repl-action]");
    if (replAction) {
      e.preventDefault();
      var ra = replAction.getAttribute("data-repl-action");
      var rid = parseInt(replAction.getAttribute("data-repl-id"));
      if (ra === "complete") {
        DB.updateReplacement(rid, "completed").then(function () { navigate("repl-log"); });
      } else if (ra === "cancel") {
        DB.updateReplacement(rid, "cancelled").then(function () { navigate("repl-log"); });
      } else if (ra === "clear-completed") {
        if (confirm("Clear all completed and cancelled entries?")) {
          DB.clearReplacements("completed").then(function () {
            return DB.clearReplacements("cancelled");
          }).then(function () { navigate("repl-log"); });
        }
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

  // ── Coverage type filter ─────────────────────────────────────────
  window._covFilter = function (btn, vt) {
    var btns = btn.parentNode.querySelectorAll(".cov-type-btn");
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove("cov-type-active");
    btn.classList.add("cov-type-active");
    var rows = btn.closest(".view").querySelectorAll("tr[data-vt]");
    for (var i = 0; i < rows.length; i++) {
      if (vt === "ALL" || rows[i].getAttribute("data-vt") === vt) {
        rows[i].style.display = "";
      } else {
        rows[i].style.display = "none";
      }
    }
  };

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
          + '<span class="status-badge ' + (function(s){ var stock=["READY FOR SALE","RVASAP","SHOWROOM","RESTOCK","RV SHOW UNIT","RV SHOW BACKUP","AS IS","STORM DAMAGE"]; return stock.indexOf((s||"").toUpperCase())!==-1?"status-stock":"status-dead"; })(d.status) + '">' + Views.esc(d.status) + '</span>'
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

      // For reorg: combine from/to zones into the zone field
      if (data.zone_from || data.zone_to) {
        var parts = [];
        if (data.zone_from) parts.push("From: CLE-" + data.zone_from);
        if (data.zone_to) parts.push("To: CLE-" + data.zone_to);
        data.zone = parts.join(" → ");
        delete data.zone_from;
        delete data.zone_to;
      }

      DB.queueNote(data).then(function () {
        // Show queued feedback immediately
        btn.textContent = "Sending...";
        btn.style.background = "var(--copper)";

        // Try to push right away
        return Sync.pushPendingNotes().then(function () {
          Sync.updateQueueBadge();
          // Check if note was actually sent (no longer pending)
          return DB.getPendingNotes();
        }).then(function (pending) {
          var stillPending = pending.some(function (n) {
            return n.stock === data.stock && n.entry_type === data.entry_type;
          });
          if (stillPending) {
            btn.textContent = "Queued — will retry";
            btn.style.background = "var(--warning, #f59e0b)";
          } else {
            btn.textContent = "Submitted!";
            btn.style.background = "var(--green)";
          }
          setTimeout(function () {
            navigate("notes");
          }, 1500);
        });
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

    var val = el.querySelector("input").value;
    var wrap = document.getElementById("actualLocWrap");
    if (wrap) {
      wrap.style.display = (val === "No" || val === "Not Found") ? "block" : "none";
    }
  }

  // ── Audit filter chips ─────────────────────────────────────────
  function initAuditFilters() {
    // Handled via event delegation in handleClick
  }

  // ── Sale Pending list filters ──────────────────────────────────
  function filterSPList(el, filterKind) {
    // For type filters (chips), toggle active chip
    if (filterKind === "type") {
      var bar = el.parentElement;
      var chips = bar.querySelectorAll(".chip");
      for (var i = 0; i < chips.length; i++) chips[i].classList.remove("chip-active");
      el.classList.add("chip-active");
    }

    // Get active filters
    var activeType = "ALL", activeDeal = "ALL", activeMfr = "ALL", activeCond = "ALL";
    var typeBar = document.getElementById("spTypeFilters");
    var dealSelect = document.getElementById("spDealFilter");
    var mfrSelect = document.getElementById("spMfrFilter");
    var condSelect = document.getElementById("spCondFilter");
    if (typeBar) {
      var tc = typeBar.querySelector(".chip-active");
      if (tc) activeType = tc.getAttribute("data-sp-type") || "ALL";
    }
    if (dealSelect) activeDeal = dealSelect.value || "ALL";
    if (mfrSelect) activeMfr = mfrSelect.value || "ALL";
    if (condSelect) activeCond = condSelect.value || "ALL";

    // Filter cards
    var cards = document.querySelectorAll(".sp-unit-card");
    var shown = 0;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var cardType = card.getAttribute("data-unit-type") || "";
      var cardDeal = card.getAttribute("data-unit-deal") || "";
      var cardMfr = card.getAttribute("data-unit-mfr") || "";
      var cardCond = card.getAttribute("data-unit-cond") || "";
      var showType = (activeType === "ALL" || cardType === activeType);
      var showDeal = (activeDeal === "ALL" || cardDeal === activeDeal);
      var showMfr = (activeMfr === "ALL" || cardMfr === activeMfr);
      var showCond = (activeCond === "ALL" || cardCond === activeCond);
      var vis = showType && showDeal && showMfr && showCond;
      card.style.display = vis ? "" : "none";
      if (vis) shown++;
    }
  }

  // ── Lot cell type filter (lots view) ─────────────────────────
  function filterLotCells(vt) {
    var cells = document.querySelectorAll(".lot-cell-filterable");
    for (var i = 0; i < cells.length; i++) {
      var cell = cells[i];
      if (vt === "ALL") {
        cell.style.display = "";
      } else {
        var vtList = (cell.getAttribute("data-vt-list") || "").split(",");
        cell.style.display = vtList.indexOf(vt) !== -1 ? "" : "none";
      }
    }
  }

  // ── Manufacturer card type filter (makes view) ──────────────
  function filterMakeCards(vt) {
    var cards = document.querySelectorAll("[data-action='make-detail'][data-vt]");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (vt === "ALL") {
        card.style.display = "";
      } else {
        card.style.display = card.getAttribute("data-vt") === vt ? "" : "none";
      }
    }
  }

  // ── Generic condition filter (for drill-through pages) ──
  function filterByCondition(val) {
    var cards = document.querySelectorAll(".result-card[data-condition]");
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      if (val === "ALL") {
        card.style.display = "";
      } else {
        card.style.display = card.getAttribute("data-condition") === val ? "" : "none";
      }
    }
  }

  // ── All Inventory filter ──
  function filterAllInventory() {
    var getSelected = function(id) {
      var sel = document.getElementById(id);
      if (!sel) return [];
      var vals = [];
      for (var i = 0; i < sel.options.length; i++) {
        if (sel.options[i].selected) vals.push(sel.options[i].value);
      }
      return vals;
    };

    var locFilter = getSelected("aiFilterLocation");
    var typeFilter = getSelected("aiFilterType");
    var statusFilter = getSelected("aiFilterStatus");
    var mfrFilter = getSelected("aiFilterMfr");

    DB.getAllUnits().then(function(units) {
      var filtered = units.filter(function(u) {
        if (locFilter.length > 0 && locFilter.indexOf(u.lot_area || "Unassigned") === -1) return false;
        if (typeFilter.length > 0 && typeFilter.indexOf(u.veh_type || "Other") === -1) return false;
        if (statusFilter.length > 0 && statusFilter.indexOf(u.status || "Unknown") === -1) return false;
        if (mfrFilter.length > 0 && mfrFilter.indexOf(u.manufacturer || "Unknown") === -1) return false;
        return true;
      });

      filtered.sort(function(a, b) {
        var cmp = (a.make || "").localeCompare(b.make || "");
        return cmp !== 0 ? cmp : (a.model || "").localeCompare(b.model || "");
      });

      var container = document.getElementById("aiResults");
      if (!container) return;
      var h = '<div style="margin-bottom:8px;font-size:13px;color:var(--text-3);">' + filtered.length + ' units shown</div>';
      var maxShow = Math.min(filtered.length, 100);
      for (var i = 0; i < maxShow; i++) {
        h += Views.renderUnitCard(filtered[i]);
      }
      if (filtered.length > 100) {
        h += '<div style="text-align:center;padding:12px;font-size:14px;color:var(--text-3);">Showing 100 of ' + filtered.length + ' — use filters to narrow</div>';
      }
      container.innerHTML = h;
    });
  }

  // ── Public API ─────────────────────────────────────────────────
  return {
    init: init,
    navigate: navigate,
    selectRadio: selectRadio,
    filterSPList: filterSPList,
    filterLotCells: filterLotCells,
    filterMakeCards: filterMakeCards,
    filterByCondition: filterByCondition,
    filterAllInventory: filterAllInventory,
  };
})();

// Boot is handled by gate.js — Gate.check() calls App.init() after auth
