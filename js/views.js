/* ================================================================
   Views — FTRV Lot Manager PWA
   All view renderers. Each returns HTML string.
   ================================================================ */

var Views = (function () {

  // ── Helpers ────────────────────────────────────────────────────
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function statusClass(status) {
    var s = (status || "").toUpperCase();
    if (["READY FOR SALE", "RVASAP", "SHOWROOM", "RESTOCK",
         "RV SHOW UNIT", "RV SHOW BACKUP", "AS IS", "STORM DAMAGE"].indexOf(s) !== -1)
      return "status-stock";
    if (["SALE PENDING", "FLEET PENDING"].indexOf(s) !== -1) return "status-pending";
    if (["SHIPPED", "DISPATCHED", "TRANSFER", "STORE-TO-STORE TRANSFER",
         "DRIVER NEEDED", "IN TRANSIT"].indexOf(s) !== -1) return "status-transit";
    if (["ORDERED", "PO ISSUED", "RETAIL ORDERED"].indexOf(s) !== -1) return "status-ordered";
    return "status-dead";
  }

  function fmtPrice(v) {
    if (!v) return null;
    var cleaned = String(v).replace(/[$,]/g, "");
    var n = parseFloat(cleaned);
    if (isNaN(n) || n === 0) return null;
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function fieldRow(label, value) {
    return '<div class="field-row"><span class="field-label">' + esc(label)
      + '</span><span class="field-value">' + esc(value || "\u2014") + '</span></div>';
  }

  function backBtn(view, label) {
    return '<a class="back-btn" href="#' + view + '">'
      + '<svg viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
      + (label || "Back") + '</a>';
  }

  var ZONE_INFO = {
    "DISP01": "Zone 1 — Main Display",
    "DISP02": "Zone 2 — Main Display",
    "DISP03": "Zone 3 — Main Display",
    "DISP04": "Zone 4 — FW Display",
    "DISP05": "Zone 5 — FW Display",
    "DISP06": "Zone 6 — FW Display",
    "DISP07": "Zone 7 — Extended",
    "DISP08": "Zone 8 — Extended",
    "SHR01":  "Showroom 1 (TTs)",
    "SHR02":  "Showroom 2 (Mid-size)",
    "SHR03":  "Showroom 3 (FW/Large)",
  };

  var ZONE_CODES = [
    { code: "SHR01", label: "Showroom 1 (TTs)" },
    { code: "SHR02", label: "Showroom 2 (Mid-size)" },
    { code: "SHR03", label: "Showroom 3 (FW/Large)" },
    { code: "DISP01", label: "Zone 1 — Main Display" },
    { code: "DISP02", label: "Zone 2 — Main Display" },
    { code: "DISP03", label: "Zone 3 — Main Display" },
    { code: "DISP04", label: "Zone 4 — FW Display" },
    { code: "DISP05", label: "Zone 5 — FW Display" },
    { code: "DISP06", label: "Zone 6 — FW Display" },
    { code: "DISP07", label: "Zone 7 — Extended" },
    { code: "DISP08", label: "Zone 8 — Extended" },
    { code: "OVR",    label: "Overflow" },
  ];


  // ══════════════════════════════════════════════════════════════
  // SEARCH VIEW
  // ══════════════════════════════════════════════════════════════
  function searchView() {
    return DB.getInventoryStats().then(function (stats) {
      return DB.getMeta("exported_at").then(function (exportedAt) {
        var h = '<div class="view">';

        // Search box
        h += '<div class="search-box">'
          + '<svg class="search-icon" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
          + '<input class="search-input" type="text" id="searchInput" placeholder="Stock#, VIN, Make, Model..." autocomplete="off" autocapitalize="characters">'
          + '<button class="search-clear" id="searchClear">&times;</button>'
          + '</div>';

        // Results container
        h += '<div id="searchResults"></div>';

        // Stats dashboard
        h += '<div id="searchDashboard">';

        // KPI row
        h += '<div class="stats-row">'
          + '<div class="stat-pill"><div class="stat-val text-blue">' + stats.total + '</div><div class="stat-label">CLE Units</div></div>'
          + '<div class="stat-pill"><div class="stat-val text-green">' + (stats.by_status["READY FOR SALE"] || 0) + '</div><div class="stat-label">Ready</div></div>'
          + '<div class="stat-pill"><div class="stat-val text-orange">' + (stats.by_status["SALE PENDING"] || 0) + '</div><div class="stat-label">Pending</div></div>'
          + '</div>';

        // Status breakdown
        h += '<div class="card"><div class="card-title">By Status</div>';
        var statuses = Object.keys(stats.by_status).sort(function (a, b) {
          return stats.by_status[b] - stats.by_status[a];
        });
        for (var i = 0; i < statuses.length; i++) {
          var s = statuses[i];
          var cnt = stats.by_status[s];
          var pct = Math.round(cnt / stats.total * 100);
          h += '<div class="field-row">'
            + '<span class="field-label"><span class="status-badge ' + statusClass(s) + '" style="font-size:12px;margin-right:6px;">&bull;</span>' + esc(s) + '</span>'
            + '<span class="field-value">' + cnt + ' <span class="text-muted" style="font-size:16px;">(' + pct + '%)</span></span></div>';
        }
        h += '</div>';

        // Data freshness
        if (exportedAt) {
          h += '<div class="text-center text-muted" style="font-size:18px;padding:12px;">Data as of ' + esc(exportedAt) + '</div>';
        }

        h += '</div></div>';
        return h;
      });
    });
  }

  function renderSearchResults(matches) {
    if (matches.length === 0) {
      return '<div class="empty-state"><div class="empty-icon">&#128269;</div>'
        + '<div class="empty-title">No Results</div>'
        + '<div class="empty-desc">Try a different stock#, VIN, or keyword</div></div>';
    }

    var h = '<div class="section-header">' + matches.length + ' result' + (matches.length > 1 ? "s" : "") + '</div>';
    var shown = Math.min(matches.length, 25);
    for (var i = 0; i < shown; i++) {
      var u = matches[i];
      h += '<div class="result-card" data-action="detail" data-stock="' + esc(u.stock_num) + '">'
        + '<div class="result-ymm">' + esc(u.year) + ' ' + esc(u.make) + ' ' + esc(u.model) + '</div>'
        + '<div class="result-meta">'
        + '<span>Stk# ' + esc(u.stock_num) + '</span>'
        + '<span class="sep">&middot;</span>'
        + '<span>' + esc(u.lot_location || "No Lot") + '</span>'
        + '<span class="sep">&middot;</span>'
        + '<span class="status-badge ' + statusClass(u.status) + '">' + esc(u.status) + '</span>'
        + '</div></div>';
    }
    if (matches.length > 25) {
      h += '<div class="text-center text-muted" style="padding:12px;font-size:18px;">Showing 25 of ' + matches.length + '</div>';
    }
    return h;
  }


  // ══════════════════════════════════════════════════════════════
  // UNIT DETAIL VIEW
  // ══════════════════════════════════════════════════════════════
  function unitDetailView(stockNum) {
    return DB.getUnit(stockNum).then(function (u) {
      if (!u) {
        // Try VIN suffix match
        return DB.getAllUnits().then(function (all) {
          var q = stockNum.toUpperCase();
          for (var i = 0; i < all.length; i++) {
            if (all[i].vin && all[i].vin.toUpperCase().endsWith(q)) return renderUnitDetail(all[i]);
          }
          return '<div class="view">' + backBtn("search", "Search")
            + '<div class="empty-state"><div class="empty-icon">&#128269;</div>'
            + '<div class="empty-title">Unit Not Found</div></div></div>';
        });
      }
      return renderUnitDetail(u);
    });
  }

  function renderUnitDetail(u) {
    var h = '<div class="view">';
    h += backBtn("search", "Search");

    // Header card
    h += '<div class="unit-header">'
      + '<div class="unit-ymm">' + esc(u.year) + ' ' + esc(u.make) + ' ' + esc(u.model) + '</div>'
      + '<div class="unit-sub">' + esc(u.floor_layout || "") + '</div>'
      + '</div>';

    // Quick stats
    h += '<div class="stats-row">'
      + '<div class="stat-pill"><div class="stat-val text-blue">' + esc(u.age || "\u2014") + '</div><div class="stat-label">Days Old</div></div>'
      + '<div class="stat-pill"><div class="stat-val text-orange">' + esc(u.status_days || "\u2014") + '</div><div class="stat-label">In Status</div></div>'
      + '<div class="stat-pill"><div class="stat-val" style="font-size:20px;"><span class="status-badge ' + statusClass(u.status) + '">' + esc(u.status) + '</span></div><div class="stat-label">Status</div></div>'
      + '</div>';

    // Identity
    h += '<div class="card"><div class="card-title">Identity</div>'
      + fieldRow("Stock #", u.stock_num)
      + fieldRow("VIN", u.vin)
      + fieldRow("Manufacturer", u.manufacturer)
      + fieldRow("Make", u.make)
      + fieldRow("Model", u.model)
      + fieldRow("Year", u.year)
      + '</div>';

    // Location
    h += '<div class="card"><div class="card-title">Location</div>'
      + fieldRow("PC", u.pc)
      + fieldRow("Current Loc", u.current_location)
      + fieldRow("Lot Location", u.lot_location)
      + fieldRow("Lot Area", u.lot_area)
      + '</div>';

    // Product
    h += '<div class="card"><div class="card-title">Product</div>'
      + fieldRow("Type", u.veh_type)
      + fieldRow("Body Style", u.body_style)
      + fieldRow("Floor Layout", u.floor_layout)
      + fieldRow("Length", u.length)
      + '</div>';

    // Pricing
    if (fmtPrice(u.retail_price) || fmtPrice(u.msrp)) {
      h += '<div class="card"><div class="card-title">Pricing</div>'
        + fieldRow("Retail Price", fmtPrice(u.retail_price))
        + fieldRow("MSRP", fmtPrice(u.msrp))
        + '</div>';
    }

    // Actions
    h += '<div style="margin-top:8px;">'
      + '<a class="btn btn-blue mb-8" data-action="verify-note" data-stock="' + esc(u.stock_num) + '">Verify Location</a>'
      + '<a class="btn btn-ghost" data-action="reorg-note" data-stock="' + esc(u.stock_num) + '">Suggest Move</a>'
      + '</div>';

    // Duplicates
    h += '<div id="dupeSection" data-make="' + esc(u.make) + '" data-model="' + esc(u.model) + '" data-stock="' + esc(u.stock_num) + '"></div>';

    h += '</div>';
    return h;
  }


  // ══════════════════════════════════════════════════════════════
  // LOTS VIEW
  // ══════════════════════════════════════════════════════════════
  function lotsView() {
    return DB.getAllUnits().then(function (units) {
      // Group by lot area
      var areas = {};
      var AREA_ORDER = ["SHOWROOM", "DISPLAY", "OVERFLOW", "PDI BAY", "QAC BAY",
        "SERVICE PARKING", "WALK THRU", "RECEIVING LINE", "WASH",
        "SOLD/SALE PENDING", "TRANSFER", "OTHER / OFF-SITE"];

      for (var i = 0; i < units.length; i++) {
        var a = units[i].lot_area || "UNASSIGNED";
        if (!areas[a]) areas[a] = [];
        areas[a].push(units[i]);
      }

      var h = '<div class="view">';

      // Zone grid for display areas
      h += '<div class="section-header">Display Zones</div>';
      h += '<div class="lot-grid">';

      var displayCodes = ["SHR01", "SHR02", "SHR03",
        "DISP01", "DISP02", "DISP03", "DISP04", "DISP05", "DISP06", "DISP07", "DISP08"];
      for (var di = 0; di < displayCodes.length; di++) {
        var code = displayCodes[di];
        var count = 0;
        for (var j = 0; j < units.length; j++) {
          var lot = (units[j].lot_location || "").toUpperCase().replace("CLE-", "");
          if (lot.indexOf(code) === 0) count++;
        }
        var shortCode = code.replace("DISP", "Z").replace("SHR", "SR");
        h += '<div class="lot-cell" data-action="zone-detail" data-zone="' + code + '">'
          + '<div class="lot-cell-code">' + shortCode + '</div>'
          + '<div class="lot-cell-count">' + count + '</div>'
          + '<div class="lot-cell-desc">' + esc((ZONE_INFO[code] || "").split(" — ")[1] || "") + '</div>'
          + '</div>';
      }
      h += '</div>';

      // Area summary
      h += '<div class="section-header">All Areas</div>';
      var sortedAreas = Object.keys(areas).sort(function (a, b) {
        var ai = AREA_ORDER.indexOf(a), bi = AREA_ORDER.indexOf(b);
        if (ai === -1) ai = 99;
        if (bi === -1) bi = 99;
        return ai - bi;
      });

      for (var ai = 0; ai < sortedAreas.length; ai++) {
        var area = sortedAreas[ai];
        var areaUnits = areas[area];
        h += '<div class="card card-interactive" data-action="area-detail" data-area="' + esc(area) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<span style="font-size:20px;font-weight:600;">' + esc(area) + '</span>'
          + '<span class="stat-val text-blue" style="font-size:28px;">' + areaUnits.length + '</span>'
          + '</div></div>';
      }

      h += '</div>';
      return h;
    });
  }

  function zoneDetailView(zoneCode) {
    return DB.getAllUnits().then(function (units) {
      var zoneUnits = units.filter(function (u) {
        var lot = (u.lot_location || "").toUpperCase().replace("CLE-", "");
        return lot.indexOf(zoneCode) === 0;
      });

      var h = '<div class="view">';
      h += backBtn("lots", "Lots");
      var shortCode = zoneCode.replace("DISP", "Zone ").replace("SHR", "Showroom ");
      h += '<div class="zone-banner">'
        + '<div class="zone-banner-name">' + shortCode + '</div>'
        + '<div class="zone-banner-desc">' + esc(ZONE_INFO[zoneCode] || "") + '</div>'
        + '<div class="zone-banner-count">' + zoneUnits.length + '</div>'
        + '</div>';

      // Group by make
      var byMake = {};
      for (var i = 0; i < zoneUnits.length; i++) {
        var make = zoneUnits[i].make || "Unknown";
        if (!byMake[make]) byMake[make] = [];
        byMake[make].push(zoneUnits[i]);
      }

      var makes = Object.keys(byMake).sort();
      for (var mi = 0; mi < makes.length; mi++) {
        var make = makes[mi];
        var mu = byMake[make];
        h += '<div class="card"><div class="card-title">' + esc(make) + ' (' + mu.length + ')</div>';
        for (var j = 0; j < mu.length; j++) {
          var u = mu[j];
          h += '<div class="result-card" style="margin-bottom:8px;" data-action="detail" data-stock="' + esc(u.stock_num) + '">'
            + '<div class="result-ymm" style="font-size:20px;">' + esc(u.model) + ' ' + esc(u.floor_layout || "") + '</div>'
            + '<div class="result-meta" style="font-size:18px;">'
            + '<span>Stk# ' + esc(u.stock_num) + '</span>'
            + '<span class="sep">&middot;</span>'
            + '<span class="status-badge ' + statusClass(u.status) + '">' + esc(u.status) + '</span>'
            + '</div></div>';
        }
        h += '</div>';
      }

      if (zoneUnits.length === 0) {
        h += '<div class="empty-state"><div class="empty-icon">&#128230;</div>'
          + '<div class="empty-title">Empty Zone</div></div>';
      }

      h += '</div>';
      return h;
    });
  }


  // ══════════════════════════════════════════════════════════════
  // FIELD NOTES VIEW
  // ══════════════════════════════════════════════════════════════
  function notesView() {
    return DB.getPendingNotes().then(function (pending) {
      return DB.getNotesHistory(20).then(function (history) {
        var h = '<div class="view">';

        // Pending queue warning
        if (pending.length > 0) {
          h += '<div class="card" style="border-color:var(--orange);background:var(--orange-dim);">'
            + '<div style="font-size:20px;font-weight:700;color:var(--orange);">'
            + pending.length + ' note' + (pending.length > 1 ? "s" : "") + ' waiting to sync</div>'
            + '<div style="font-size:18px;color:var(--text-2);margin-top:4px;">Will submit automatically when online</div>'
            + '</div>';
        }

        // New note type cards
        h += '<div class="section-header">New Field Note</div>';

        h += '<div class="note-type-card" data-action="note-form" data-type="verify">'
          + '<div class="note-type-icon" style="background:var(--green-dim);color:var(--green);">&#128205;</div>'
          + '<div><div class="note-type-label">Verify Location</div>'
          + '<div class="note-type-desc">Confirm or correct a unit\'s lot location</div></div></div>';

        h += '<div class="note-type-card" data-action="note-form" data-type="hole">'
          + '<div class="note-type-icon" style="background:var(--orange-dim);color:var(--orange);">&#128308;</div>'
          + '<div><div class="note-type-label">Coverage Hole</div>'
          + '<div class="note-type-desc">Flag an empty display spot</div></div></div>';

        h += '<div class="note-type-card" data-action="note-form" data-type="reorg">'
          + '<div class="note-type-icon" style="background:var(--blue-dim);color:var(--blue);">&#128260;</div>'
          + '<div><div class="note-type-label">Reorganization</div>'
          + '<div class="note-type-desc">Suggest units to move or regroup</div></div></div>';

        // History
        if (history.length > 0) {
          h += '<div class="section-header">Recent Notes</div>';
          for (var i = 0; i < history.length; i++) {
            var n = history[i];
            var typeClass = n.entry_type === "Verify" ? "flag-info"
              : n.entry_type === "Hole" ? "flag-warning" : "flag-critical";
            h += '<div class="card">'
              + '<div class="gap-row mb-8"><span class="flag-badge ' + typeClass + '">' + esc(n.entry_type) + '</span>'
              + '<span class="flag-badge flag-info">' + esc(n.status || "Submitted") + '</span></div>'
              + (n.stock ? '<div style="font-size:20px;font-weight:700;">Stk# ' + esc(n.stock) + '</div>' : '')
              + (n.description ? '<div style="font-size:18px;color:var(--text-2);margin-top:4px;">' + esc(n.description) + '</div>' : '')
              + '<div style="font-size:18px;color:var(--text-3);margin-top:6px;">'
              + esc(n.timestamp) + (n.user ? ' &middot; ' + esc(n.user) : '') + '</div>'
              + '</div>';
          }
        }

        h += '</div>';
        return h;
      });
    });
  }


  // ══════════════════════════════════════════════════════════════
  // NOTE FORM VIEW
  // ══════════════════════════════════════════════════════════════
  function noteFormView(type, stockNum) {
    var lookupPromise = stockNum
      ? DB.getUnit(stockNum)
      : Promise.resolve(null);

    return lookupPromise.then(function (unit) {
      var h = '<div class="view">';
      h += backBtn("notes", "Notes");

      if (type === "verify") {
        h += renderVerifyForm(unit, stockNum);
      } else if (type === "hole") {
        h += renderHoleForm();
      } else {
        h += renderReorgForm(unit, stockNum);
      }

      h += '</div>';
      return h;
    });
  }

  function renderVerifyForm(unit, stockNum) {
    var h = '<div class="card"><div class="card-title">Verify Unit Location</div>'
      + '<form id="noteForm" data-type="verify">';

    h += '<label class="form-label">Your Name</label>'
      + '<input class="form-input" type="text" name="user" placeholder="e.g. John" required>';

    h += '<label class="form-label">Stock #</label>'
      + '<input class="form-input" type="text" name="stock" value="' + esc(stockNum || "") + '" placeholder="Enter stock number" required id="noteStock">';

    if (unit) {
      h += '<div class="card" style="background:var(--surface-1);border-color:var(--border-lt);margin-bottom:16px;padding:14px;" id="unitPreview">'
        + '<div style="font-size:22px;font-weight:700;">' + esc(unit.year) + ' ' + esc(unit.make) + ' ' + esc(unit.model) + '</div>'
        + '<div style="font-size:18px;color:var(--text-2);margin-top:4px;">VIN: ' + esc(unit.vin) + '</div>'
        + '<div style="font-size:20px;margin-top:6px;">System Lot: <span class="text-blue fw-800">' + esc(unit.lot_location || "NONE") + '</span></div>'
        + '<div style="font-size:18px;color:var(--text-3);margin-top:4px;">Status: ' + esc(unit.status) + '</div>'
        + '</div>';
    }

    h += '<label class="form-label">Is the unit where the system says?</label>'
      + '<div class="form-radio-group">'
      + '<label class="form-radio" onclick="App.selectRadio(this)"><input type="radio" name="verified" value="Yes" required>Yes</label>'
      + '<label class="form-radio" onclick="App.selectRadio(this)"><input type="radio" name="verified" value="No">No</label>'
      + '<label class="form-radio" onclick="App.selectRadio(this)"><input type="radio" name="verified" value="Not Found">Not Found</label>'
      + '</div>';

    h += '<div id="actualLocWrap" style="display:none;">'
      + '<label class="form-label">Actual Location</label>'
      + '<select class="form-select" name="actual_lot"><option value="">Select location...</option>';
    for (var i = 0; i < ZONE_CODES.length; i++) {
      h += '<option value="' + ZONE_CODES[i].code + '">' + ZONE_CODES[i].code + ' — ' + ZONE_CODES[i].label + '</option>';
    }
    h += '<option value="OTHER">Other (specify in notes)</option></select></div>';

    h += '<label class="form-label">Notes (optional)</label>'
      + '<textarea class="form-textarea" name="notes" placeholder="Any additional details..."></textarea>';

    h += '<button class="btn btn-green mt-8" type="submit">Submit Verification</button>';
    h += '</form></div>';
    return h;
  }

  function renderHoleForm() {
    var h = '<div class="card"><div class="card-title">Report Coverage Hole</div>'
      + '<form id="noteForm" data-type="hole">';

    h += '<label class="form-label">Your Name</label>'
      + '<input class="form-input" type="text" name="user" placeholder="e.g. John" required>';

    h += '<label class="form-label">Zone / Area</label>'
      + '<select class="form-select" name="zone" required><option value="">Select zone...</option>';
    for (var i = 0; i < ZONE_CODES.length; i++) {
      h += '<option value="' + ZONE_CODES[i].code + '">' + ZONE_CODES[i].code + ' — ' + ZONE_CODES[i].label + '</option>';
    }
    h += '</select>';

    h += '<label class="form-label">What type/brand is missing?</label>'
      + '<input class="form-input" type="text" name="missing_type" placeholder="e.g. TT, Forest River Cherokee">';

    h += '<label class="form-label">Nearby Stock #s (helps locate the hole)</label>'
      + '<input class="form-input" type="text" name="nearby_units" placeholder="e.g. 219464, 220115">';

    h += '<label class="form-label">Where exactly is the hole?</label>'
      + '<textarea class="form-textarea" name="description" required placeholder="Describe the location:\n- Row/spot number\n- Between which units\n- How many empty spots"></textarea>';

    h += '<label class="form-label">Notes (optional)</label>'
      + '<textarea class="form-textarea" name="notes" placeholder="Additional context..."></textarea>';

    h += '<button class="btn btn-orange mt-8" type="submit">Submit Hole Report</button>';
    h += '</form></div>';
    return h;
  }

  function renderReorgForm(unit, stockNum) {
    var h = '<div class="card"><div class="card-title">Suggest Reorganization</div>'
      + '<form id="noteForm" data-type="reorg">';

    h += '<label class="form-label">Your Name</label>'
      + '<input class="form-input" type="text" name="user" placeholder="e.g. John" required>';

    h += '<label class="form-label">Zone / Area Affected</label>'
      + '<select class="form-select" name="zone" required><option value="">Select zone...</option>';
    for (var i = 0; i < ZONE_CODES.length; i++) {
      h += '<option value="' + ZONE_CODES[i].code + '">' + ZONE_CODES[i].code + ' — ' + ZONE_CODES[i].label + '</option>';
    }
    h += '</select>';

    h += '<label class="form-label">Stock #(s) to Move</label>'
      + '<input class="form-input" type="text" name="stock" value="' + esc(stockNum || "") + '" placeholder="e.g. 219464 or 219464, 220115">';

    h += '<label class="form-label">Reason</label>'
      + '<select class="form-select" name="reason" required>'
      + '<option value="">Select reason...</option>'
      + '<option value="Brand Grouping">Brand Grouping — same brand not together</option>'
      + '<option value="Price Grouping">Price Grouping — similar price points</option>'
      + '<option value="Size Grouping">Size Grouping — similar sizes together</option>'
      + '<option value="Body Style">Body Style — same body style together</option>'
      + '<option value="Visibility">Visibility — needs more/less prominent spot</option>'
      + '<option value="Duplicate">Duplicate on Display — same model shown twice</option>'
      + '<option value="Fill Gap">Fill Empty Spot — move to fill a gap</option>'
      + '<option value="Other">Other</option>'
      + '</select>';

    h += '<label class="form-label">Current Arrangement</label>'
      + '<textarea class="form-textarea" name="description" required placeholder="What you see:\n- Which units are out of place\n- What brands/models are mixed"></textarea>';

    h += '<label class="form-label">Suggested Change</label>'
      + '<textarea class="form-textarea" name="suggested_action" required placeholder="What should be done:\n- Move unit X next to Y\n- Group all [brand] together"></textarea>';

    h += '<label class="form-label">Notes (optional)</label>'
      + '<textarea class="form-textarea" name="notes" placeholder="Additional context..."></textarea>';

    h += '<button class="btn btn-blue mt-8" type="submit">Submit Suggestion</button>';
    h += '</form></div>';
    return h;
  }


  // ══════════════════════════════════════════════════════════════
  // AUDIT VIEW
  // ══════════════════════════════════════════════════════════════
  function auditView() {
    return DB.getAllUnits().then(function (units) {
      var flags = computeAuditFlags(units);

      var h = '<div class="view">';

      // Summary
      var critical = flags.filter(function (f) { return f.severity === "CRITICAL"; }).length;
      var warning = flags.filter(function (f) { return f.severity === "WARNING"; }).length;
      var info = flags.filter(function (f) { return f.severity === "INFO"; }).length;

      h += '<div class="stats-row">'
        + '<div class="stat-pill"><div class="stat-val text-red">' + critical + '</div><div class="stat-label">Critical</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-orange">' + warning + '</div><div class="stat-label">Warning</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-blue">' + info + '</div><div class="stat-label">Info</div></div>'
        + '</div>';

      // Filter chips
      h += '<div class="chip-row">'
        + '<div class="chip active" data-filter="all">All (' + flags.length + ')</div>'
        + '<div class="chip" data-filter="CRITICAL">Critical (' + critical + ')</div>'
        + '<div class="chip" data-filter="WARNING">Warning (' + warning + ')</div>'
        + '<div class="chip" data-filter="INFO">Info (' + info + ')</div>'
        + '</div>';

      // Flags list
      h += '<div id="auditList">';
      h += renderAuditFlags(flags, "all");
      h += '</div>';

      h += '</div>';
      return h;
    });
  }

  function renderAuditFlags(flags, filter) {
    var filtered = filter === "all" ? flags
      : flags.filter(function (f) { return f.severity === filter; });

    if (filtered.length === 0) {
      return '<div class="empty-state"><div class="empty-icon">&#9989;</div>'
        + '<div class="empty-title">All Clear</div></div>';
    }

    var h = '';
    for (var i = 0; i < filtered.length; i++) {
      var f = filtered[i];
      var sevClass = f.severity === "CRITICAL" ? "flag-critical"
        : f.severity === "WARNING" ? "flag-warning" : "flag-info";

      h += '<div class="card card-interactive" data-action="detail" data-stock="' + esc(f.stock_num) + '">'
        + '<div class="gap-row mb-8">'
        + '<span class="flag-badge ' + sevClass + '">' + esc(f.severity) + '</span>'
        + '<span class="flag-badge" style="background:var(--surface-3);color:var(--text-2);">' + esc(f.flag.replace(/_/g, " ")) + '</span>'
        + '</div>'
        + '<div style="font-size:20px;font-weight:700;">' + esc(f.stock_num) + ' — ' + esc(f.make) + ' ' + esc(f.model) + '</div>'
        + '<div style="font-size:18px;color:var(--text-2);margin-top:4px;">' + esc(f.description) + '</div>'
        + '</div>';
    }
    return h;
  }

  function computeAuditFlags(units) {
    var STOCK = ["READY FOR SALE", "RVASAP", "SHOWROOM", "RESTOCK",
      "RV SHOW UNIT", "RV SHOW BACKUP", "AS IS", "STORM DAMAGE"];
    var DEAD = ["PRE PDI", "IN SERVICE", "AWAITING PARTS", "DRIVER DAMAGE",
      "LOT DAMAGE", "INSURANCE CLAIM", "FACTORY REVIEW",
      "SALE PENDING", "FLEET PENDING", "AWAITING TITLE",
      "SOLD", "WHOLESALE", "WHOLESALE - USED", "TEMPLATE", "BUYBACK", "DELETED", "TRADE IN"];
    var TERMINAL = ["SOLD", "WHOLESALE", "WHOLESALE - USED", "TEMPLATE", "BUYBACK", "DELETED", "TRADE IN"];
    var TRANSIT = ["SHIPPED", "DISPATCHED", "TRANSFER", "STORE-TO-STORE TRANSFER", "DRIVER NEEDED", "IN TRANSIT"];
    var ORDERED = ["ORDERED", "PO ISSUED", "RETAIL ORDERED"];
    var DISPLAY_AREAS = ["DISPLAY", "SHOWROOM", "OVERFLOW"];
    var PENDING_OK = ["SALE PENDING", "FLEET PENDING"];

    var flags = [];
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var st = (u.status || "").toUpperCase();
      var area = (u.lot_area || "").toUpperCase();
      var sd = parseInt(u.status_days) || 0;
      var age = parseInt(u.age) || 0;
      var lot = u.lot_location || "";

      // DEAD_ON_DISPLAY
      if (DEAD.indexOf(st) !== -1 && PENDING_OK.indexOf(st) === -1 && DISPLAY_AREAS.indexOf(area) !== -1) {
        flags.push({ severity: "CRITICAL", flag: "DEAD_ON_DISPLAY", stock_num: u.stock_num,
          make: u.make, model: u.model, description: st + " on " + area + " (" + lot + ")" });
      }

      // SALE_PENDING_AGED
      if (st === "SALE PENDING" && sd >= 3 && DISPLAY_AREAS.indexOf(area) !== -1) {
        flags.push({ severity: "WARNING", flag: "SALE_PENDING_AGED", stock_num: u.stock_num,
          make: u.make, model: u.model, description: "Sale pending " + sd + " days on display" });
      }

      // IN_SERVICE_AGED
      if ((st === "IN SERVICE" || st === "AWAITING PARTS") && sd > 9) {
        flags.push({ severity: "WARNING", flag: "IN_SERVICE_AGED", stock_num: u.stock_num,
          make: u.make, model: u.model, description: "In service " + sd + " days ($" + (sd * 20) + " interest)" });
      }

      // TRANSIT_ON_DISPLAY
      if (TRANSIT.indexOf(st) !== -1 && DISPLAY_AREAS.indexOf(area) !== -1) {
        flags.push({ severity: "WARNING", flag: "TRANSIT_ON_DISPLAY", stock_num: u.stock_num,
          make: u.make, model: u.model, description: st + " but on " + area });
      }

      // NO_LOT_ASSIGNED
      var needsLot = STOCK.indexOf(st) !== -1 || (DEAD.indexOf(st) !== -1 && TERMINAL.indexOf(st) === -1);
      if (!lot && needsLot) {
        flags.push({ severity: "INFO", flag: "NO_LOT_ASSIGNED", stock_num: u.stock_num,
          make: u.make, model: u.model, description: st + " with no lot location" });
      }
    }

    // Sort: critical → warning → info
    var SEV = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    flags.sort(function (a, b) { return (SEV[a.severity] || 9) - (SEV[b.severity] || 9); });
    return flags;
  }


  // ══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════
  return {
    searchView: searchView,
    renderSearchResults: renderSearchResults,
    unitDetailView: unitDetailView,
    lotsView: lotsView,
    zoneDetailView: zoneDetailView,
    notesView: notesView,
    noteFormView: noteFormView,
    auditView: auditView,
    renderAuditFlags: renderAuditFlags,
    computeAuditFlags: computeAuditFlags,
    esc: esc,
  };
})();
