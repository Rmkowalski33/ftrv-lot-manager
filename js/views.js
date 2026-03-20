/* ================================================================
   Views — FTRV Lot Manager PWA
   All view renderers. Each returns a Promise<HTML string>.
   ================================================================ */

var Views = (function () {

  // ── Helpers ────────────────────────────────────────────────────
  function esc(s) {
    if (s === null || s === undefined) return "";
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ── Status Categories ────────────────────────────────────────
  // From Lot Management Meeting — 4 categories (matches build_cle_lot_report.py)
  var STATUS_CATS = [
    { name: "Stock",   color: "green",  label: "Sellable",
      statuses: ["READY FOR SALE","RVASAP","SHOWROOM","RESTOCK","RV SHOW UNIT","RV SHOW BACKUP","AS IS","STORM DAMAGE"] },
    { name: "Dead",    color: "red",    label: "Not Sellable",
      statuses: ["PRE PDI","IN SERVICE","AWAITING PARTS","DRIVER DAMAGE","LOT DAMAGE","INSURANCE CLAIM","FACTORY REVIEW",
                 "SALE PENDING","FLEET PENDING","AWAITING TITLE",
                 "SOLD","WHOLESALE","WHOLESALE - USED","TEMPLATE","BUYBACK","DELETED","TRADE IN"] },
    { name: "Transit", color: "blue",   label: "In Motion",
      statuses: ["SHIPPED","DISPATCHED","TRANSFER","STORE-TO-STORE TRANSFER","DRIVER NEEDED","IN TRANSIT"] },
    { name: "Ordered", color: "purple", label: "Pipeline",
      statuses: ["ORDERED","PO ISSUED","RETAIL ORDERED"] },
  ];
  // Terminal: subset of Dead — units that have fully exited active inventory
  var TERMINAL_STATUSES = ["SOLD","WHOLESALE","WHOLESALE - USED","TEMPLATE","BUYBACK","DELETED","TRADE IN"];

  // Reverse lookup: status → category name
  var _statusToCat = {};
  var _statusToCatObj = {};
  for (var ci = 0; ci < STATUS_CATS.length; ci++) {
    for (var si = 0; si < STATUS_CATS[ci].statuses.length; si++) {
      _statusToCat[STATUS_CATS[ci].statuses[si]] = STATUS_CATS[ci].name;
      _statusToCatObj[STATUS_CATS[ci].statuses[si]] = STATUS_CATS[ci];
    }
  }

  function statusCat(status) {
    return _statusToCat[(status || "").toUpperCase()] || "Other";
  }

  function statusCatColor(status) {
    var obj = _statusToCatObj[(status || "").toUpperCase()];
    return obj ? obj.color : "muted";
  }

  function statusClass(status) {
    var cat = statusCat(status);
    if (cat === "Stock") return "status-stock";
    if (cat === "Dead") return "status-dead";
    if (cat === "Transit") return "status-transit";
    if (cat === "Ordered") return "status-ordered";
    return "status-dead";
  }

  function fmtPrice(v) {
    if (!v) return null;
    var cleaned = String(v).replace(/[$,]/g, "");
    var n = parseFloat(cleaned);
    if (isNaN(n) || n === 0) return null;
    return "$" + n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  function priceNum(v) {
    if (!v) return 0;
    var cleaned = String(v).replace(/[$,]/g, "");
    var n = parseFloat(cleaned);
    return isNaN(n) ? 0 : n;
  }

  function priceGroup(v) {
    var n = priceNum(v);
    if (n === 0) return "No Price";
    if (n < 20000) return "Under $20K";
    if (n < 40000) return "$20K–$40K";
    if (n < 60000) return "$40K–$60K";
    if (n < 80000) return "$60K–$80K";
    if (n < 100000) return "$80K–$100K";
    return "$100K+";
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

  function renderUnitCard(u) {
    return '<div class="result-card" data-action="detail" data-stock="' + esc(u.stock_num) + '">'
      + '<div class="result-ymm">' + esc(u.year) + ' ' + esc(u.make) + ' ' + esc(u.model) + '</div>'
      + '<div class="result-meta">'
      + '<span>Stk# ' + esc(u.stock_num) + '</span>'
      + '<span class="sep">&middot;</span>'
      + '<span>' + esc(u.lot_location || "No Lot") + '</span>'
      + '<span class="sep">&middot;</span>'
      + '<span class="status-badge ' + statusClass(u.status) + '">' + esc(u.status) + '</span>'
      + '</div></div>';
  }

  function renderAccordion(title, content) {
    return '<div class="accordion" onclick="this.classList.toggle(\'open\')">'
      + '<div class="accordion-header">'
      + '<span>' + title + '</span>'
      + '<svg class="accordion-arrow" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
      + '</div>'
      + '<div class="accordion-body">' + content + '</div>'
      + '</div>';
  }

  function renderBreakdown(items) {
    // items: [{label, count, pct, colorClass}]
    var h = '';
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      h += '<div class="breakdown-row">'
        + '<span class="breakdown-label">' + esc(it.label) + '</span>'
        + '<div class="breakdown-bar-wrap"><div class="breakdown-bar" style="width:' + (it.pct || 0) + '%;background:var(--' + (it.color || 'blue') + ');"></div></div>'
        + '<span class="breakdown-count">' + it.count + '</span>'
        + '</div>';
    }
    return h;
  }

  // Cross-filter sections: show breakdowns by the other two dimensions
  function renderCrossFilters(units, exclude) {
    var h = '';
    if (exclude !== "status") {
      var byCat = {};
      for (var i = 0; i < units.length; i++) {
        var cat = statusCat(units[i].status);
        byCat[cat] = (byCat[cat] || 0) + 1;
      }
      var items = [];
      for (var ci = 0; ci < STATUS_CATS.length; ci++) {
        var c = STATUS_CATS[ci];
        if (byCat[c.name]) items.push({ label: c.name, count: byCat[c.name], pct: Math.round(byCat[c.name] / units.length * 100), color: c.color });
      }
      if (Object.keys(byCat).length > 0) h += renderAccordion("By Status (" + units.length + ")", renderBreakdown(items));
    }
    if (exclude !== "makes") {
      var byMfr = {};
      for (var i = 0; i < units.length; i++) {
        var m = units[i].manufacturer || units[i].make || "Unknown";
        byMfr[m] = (byMfr[m] || 0) + 1;
      }
      var sorted = Object.keys(byMfr).sort(function (a, b) { return byMfr[b] - byMfr[a]; });
      var items = [];
      for (var i = 0; i < Math.min(sorted.length, 10); i++) {
        items.push({ label: sorted[i], count: byMfr[sorted[i]], pct: Math.round(byMfr[sorted[i]] / units.length * 100), color: "blue" });
      }
      if (sorted.length > 0) h += renderAccordion("By Manufacturer (" + sorted.length + ")", renderBreakdown(items));
    }
    if (exclude !== "lots") {
      var byArea = {};
      for (var i = 0; i < units.length; i++) {
        var a = units[i].lot_area || "UNASSIGNED";
        byArea[a] = (byArea[a] || 0) + 1;
      }
      var sorted = Object.keys(byArea).sort(function (a, b) { return byArea[b] - byArea[a]; });
      var items = [];
      for (var i = 0; i < sorted.length; i++) {
        items.push({ label: sorted[i], count: byArea[sorted[i]], pct: Math.round(byArea[sorted[i]] / units.length * 100), color: "blue" });
      }
      if (sorted.length > 0) h += renderAccordion("By Location (" + sorted.length + ")", renderBreakdown(items));
    }
    return h;
  }


  // ── Zone Data ────────────────────────────────────────────────
  var ZONE_INFO = {
    "DISP01": "Zone 1 — Main Display", "DISP02": "Zone 2 — Main Display", "DISP03": "Zone 3 — Main Display",
    "DISP04": "Zone 4 — FW Display", "DISP05": "Zone 5 — FW Display", "DISP06": "Zone 6 — FW Display",
    "DISP07": "Zone 7 — Extended", "DISP08": "Zone 8 — Extended",
    "SHR01": "Showroom 1 (TTs)", "SHR02": "Showroom 2 (Mid-size)", "SHR03": "Showroom 3 (FW/Large)",
  };

  var ZONE_GROUPS = [
    { type: "SHR",  label: "Showroom", codes: ["SHR01","SHR02","SHR03","SHR04","SHR05"] },
    { type: "DSP",  label: "Display",  codes: ["DSP01","DSP02","DSP03","DSP04","DSP05","DSP06","DSP07","DSP08","DSP10","DSP11"] },
    { type: "OVR",  label: "Overflow", codes: ["OVR01","OVR02","OVR03","OVR20","OVR21"] },
    { type: "PDI",  label: "PDI Bay",  codes: ["PDI01","PDI02","PDI03","PDI04","PDI05","PDI06","PDI07","PDI08","PDI09","PDI10","PDI11","PDI12","PDI13","PDI14","PDI15","PDI16","PDI17","PDI18","PDI19","PDI20"] },
    { type: "QAC",  label: "QAC Bay",  codes: ["QAC01","QAC02","QAC03","QAC04","QAC05","QAC06","QAC07","QAC08","QAC09","QAC10"] },
    { type: "SVC",  label: "Service",  codes: ["SVC01"] },
    { type: "WLK",  label: "Walk Thru", codes: ["WLK01","WLK02","WLK03","WLK04","WLK05","WLK06","WLK07","WLK08","WLK09","WLK10","WLK11","WLK12","WLK13","WLK14","WLK15","WLK16","WLK17","WLK20","WLK21","WLK22","WLK23"] },
    { type: "RCL",  label: "Receiving", codes: ["RCL01","RCL02"] },
    { type: "XFR",  label: "Transfer", codes: ["XFR01","XFR20"] },
    { type: "SLP",  label: "Sold/Pending", codes: ["SLP01","SLP20"] },
    { type: "TCI",  label: "Trade Check-In", codes: ["TCI01","TCI02","TCI20"] },
    { type: "HIT",  label: "Hitch Bay", codes: ["HIT01","HIT02"] },
    { type: "MGR",  label: "Manager Special", codes: ["MGR20"] },
    { type: "OFF",  label: "Off Lot",  codes: ["OFF"] },
  ];

  // Flat zone codes for dropdowns
  var ZONE_CODES_FLAT = [];
  for (var gi = 0; gi < ZONE_GROUPS.length; gi++) {
    for (var zi = 0; zi < ZONE_GROUPS[gi].codes.length; zi++) {
      ZONE_CODES_FLAT.push({ code: ZONE_GROUPS[gi].codes[zi], group: ZONE_GROUPS[gi].label });
    }
  }

  function renderZoneSelect(name, required) {
    var h = '<select class="form-select" name="' + name + '"' + (required ? ' required' : '') + '>'
      + '<option value="">Select zone...</option>';
    for (var gi = 0; gi < ZONE_GROUPS.length; gi++) {
      var g = ZONE_GROUPS[gi];
      h += '<optgroup label="' + esc(g.label) + '">';
      for (var zi = 0; zi < g.codes.length; zi++) {
        var code = g.codes[zi];
        var info = ZONE_INFO[code] || g.label + " " + code.replace(g.type, "#");
        h += '<option value="' + code + '">CLE-' + code + ' — ' + esc(info) + '</option>';
      }
      h += '</optgroup>';
    }
    h += '</select>';
    return h;
  }


  // ══════════════════════════════════════════════════════════════
  // HOME VIEW (Summary + Search)
  // ══════════════════════════════════════════════════════════════
  function homeView() {
    return DB.getAllUnits().then(function (units) {
      return DB.getMeta("exported_at").then(function (exportedAt) {
        var h = '<div class="view">';

        // Search box
        h += '<div class="search-box">'
          + '<svg class="search-icon" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
          + '<input class="search-input" type="text" id="searchInput" placeholder="Stock#, VIN, Make, Model..." autocomplete="off" autocapitalize="characters">'
          + '<button class="search-clear" id="searchClear">&times;</button>'
          + '</div>';
        h += '<div id="searchResults"></div>';

        // Dashboard
        h += '<div id="searchDashboard">';

        // KPI row
        var stockCount = 0, deadCount = 0, transitCount = 0;
        for (var i = 0; i < units.length; i++) {
          var cat = statusCat(units[i].status);
          if (cat === "Stock") stockCount++;
          else if (cat === "Dead") deadCount++;
          else if (cat === "Transit") transitCount++;
        }
        h += '<div class="stats-row">'
          + '<div class="stat-pill"><div class="stat-val text-blue">' + units.length + '</div><div class="stat-label">CLE Units</div></div>'
          + '<div class="stat-pill"><div class="stat-val text-green">' + stockCount + '</div><div class="stat-label">Sellable</div></div>'
          + '<div class="stat-pill"><div class="stat-val text-red">' + deadCount + '</div><div class="stat-label">Dead</div></div>'
          + '</div>';

        // Quick-nav tiles
        h += '<div class="section-header">Explore Inventory</div>';
        h += '<div class="quick-nav-grid">';
        h += '<a class="quick-nav-tile" href="#lots"><div class="quick-nav-icon" style="background:var(--blue-dim);color:var(--blue);">&#127960;</div><div class="quick-nav-label">Lots</div><div class="quick-nav-sub">By location</div></a>';
        h += '<a class="quick-nav-tile" href="#status"><div class="quick-nav-icon" style="background:var(--green-dim);color:var(--green);">&#128202;</div><div class="quick-nav-label">Status</div><div class="quick-nav-sub">By category</div></a>';
        h += '<a class="quick-nav-tile" href="#makes"><div class="quick-nav-icon" style="background:var(--orange-dim);color:var(--orange);">&#127967;</div><div class="quick-nav-label">Makes</div><div class="quick-nav-sub">By brand</div></a>';
        h += '<a class="quick-nav-tile" href="#shop"><div class="quick-nav-icon" style="background:var(--purple-dim);color:var(--purple);">&#128722;</div><div class="quick-nav-label">Shop</div><div class="quick-nav-sub">By layout</div></a>';
        h += '</div>';

        // Status category breakdown
        h += '<div class="section-header">Status Overview</div>';
        for (var ci = 0; ci < STATUS_CATS.length; ci++) {
          var cat = STATUS_CATS[ci];
          var count = 0;
          for (var i = 0; i < units.length; i++) {
            if (statusCat(units[i].status) === cat.name) count++;
          }
          if (count === 0) continue;
          var pct = Math.round(count / units.length * 100);
          h += '<div class="card card-interactive" data-action="status-cat" data-category="' + cat.name + '">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;">'
            + '<div><span style="font-size:20px;font-weight:700;">' + esc(cat.name) + '</span>'
            + '<span style="font-size:18px;color:var(--text-3);margin-left:8px;">' + esc(cat.label) + '</span></div>'
            + '<span class="stat-val text-' + cat.color + '" style="font-size:28px;">' + count + '</span>'
            + '</div>'
            + '<div class="util-bar mt-8"><div class="util-fill util-fill-' + cat.color + '" style="width:' + pct + '%;"></div></div>'
            + '</div>';
        }

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
    for (var i = 0; i < shown; i++) h += renderUnitCard(matches[i]);
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
        return DB.getAllUnits().then(function (all) {
          var q = stockNum.toUpperCase();
          for (var i = 0; i < all.length; i++) {
            if (all[i].vin && all[i].vin.toUpperCase().endsWith(q)) return renderUnitDetail(all[i], all);
          }
          return '<div class="view">' + backBtn("home", "Home")
            + '<div class="empty-state"><div class="empty-icon">&#128269;</div>'
            + '<div class="empty-title">Unit Not Found</div></div></div>';
        });
      }
      return DB.getAllUnits().then(function (all) { return renderUnitDetail(u, all); });
    });
  }

  function renderUnitDetail(u, allUnits) {
    var h = '<div class="view">';
    h += backBtn("home", "Search");

    // Header card
    h += '<div class="unit-header">'
      + '<div class="unit-ymm">' + esc(u.year) + ' ' + esc(u.make) + ' ' + esc(u.model) + '</div>'
      + '<div class="unit-sub">' + esc(u.floor_layout || "") + (u.body_style ? ' &middot; ' + esc(u.body_style) : '') + '</div>'
      + '</div>';

    // Quick stats
    h += '<div class="stats-row">'
      + '<div class="stat-pill"><div class="stat-val text-blue">' + esc(u.age || "\u2014") + '</div><div class="stat-label">Days Old</div></div>'
      + '<div class="stat-pill"><div class="stat-val text-orange">' + esc(u.status_days || "\u2014") + '</div><div class="stat-label">In Status</div></div>'
      + '<div class="stat-pill"><div class="stat-val" style="font-size:20px;"><span class="status-badge ' + statusClass(u.status) + '">' + esc(u.status) + '</span></div><div class="stat-label">Status</div></div>'
      + '</div>';

    // Identity
    h += '<div class="card"><div class="card-title">Identity</div>'
      + fieldRow("Stock #", u.stock_num) + fieldRow("VIN", u.vin)
      + fieldRow("Manufacturer", u.manufacturer) + fieldRow("Make", u.make)
      + fieldRow("Model", u.model) + fieldRow("Year", u.year)
      + '</div>';

    // Location
    h += '<div class="card"><div class="card-title">Location</div>'
      + fieldRow("PC", u.pc) + fieldRow("Current Loc", u.current_loc)
      + fieldRow("Lot Location", u.lot_location) + fieldRow("Lot Area", u.lot_area)
      + '</div>';

    // Product
    h += '<div class="card"><div class="card-title">Product</div>'
      + fieldRow("Type", u.veh_type) + fieldRow("Body Style", u.body_style)
      + fieldRow("Floor Layout", u.floor_layout) + fieldRow("Condition", u.condition)
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

    // ── Compare Similar Models ──
    if (allUnits && u.veh_type && u.body_style) {
      var similar = allUnits.filter(function (o) {
        return o.stock_num !== u.stock_num
          && o.veh_type === u.veh_type
          && o.body_style === u.body_style;
      });
      // Prefer same floor layout
      var exactLayout = similar.filter(function (o) { return o.floor_layout === u.floor_layout; });

      if (similar.length > 0) {
        h += '<div class="card mt-16"><div class="card-title">Compare Similar Models</div>';

        // Group by price group
        var byPG = {};
        var targets = exactLayout.length > 0 ? exactLayout : similar;
        for (var i = 0; i < targets.length; i++) {
          var pg = priceGroup(targets[i].retail_price);
          if (!byPG[pg]) byPG[pg] = [];
          byPG[pg].push(targets[i]);
        }

        var pgOrder = ["Under $20K","$20K–$40K","$40K–$60K","$60K–$80K","$80K–$100K","$100K+","No Price"];
        for (var pi = 0; pi < pgOrder.length; pi++) {
          var pgUnits = byPG[pgOrder[pi]];
          if (!pgUnits) continue;
          // Sort by make then price
          pgUnits.sort(function (a, b) {
            var cmp = (a.make || "").localeCompare(b.make || "");
            return cmp !== 0 ? cmp : priceNum(a.retail_price) - priceNum(b.retail_price);
          });
          h += '<div class="section-header" style="margin-top:12px;">' + pgOrder[pi] + ' (' + pgUnits.length + ')</div>';
          for (var j = 0; j < Math.min(pgUnits.length, 10); j++) {
            var s = pgUnits[j];
            h += '<div class="result-card" style="margin-bottom:6px;padding:12px 16px;" data-action="detail" data-stock="' + esc(s.stock_num) + '">'
              + '<div style="display:flex;justify-content:space-between;align-items:center;">'
              + '<span style="font-size:20px;font-weight:700;">' + esc(s.year) + ' ' + esc(s.make) + ' ' + esc(s.model) + '</span>'
              + (fmtPrice(s.retail_price) ? '<span style="font-size:18px;font-weight:700;color:var(--green);">' + fmtPrice(s.retail_price) + '</span>' : '')
              + '</div>'
              + '<div style="font-size:18px;color:var(--text-2);margin-top:2px;">'
              + esc(s.floor_layout || "") + ' &middot; Stk# ' + esc(s.stock_num) + ' &middot; ' + esc(s.lot_location || "No Lot")
              + '</div></div>';
          }
        }

        if (exactLayout.length > 0 && similar.length > exactLayout.length) {
          h += '<div class="text-center text-muted" style="padding:8px;font-size:18px;">'
            + 'Showing ' + exactLayout.length + ' with same layout. '
            + (similar.length - exactLayout.length) + ' more with same type &amp; body style.</div>';
        }
        h += '</div>';
      }
    }

    // Duplicates (same make + model)
    h += '<div id="dupeSection" data-make="' + esc(u.make) + '" data-model="' + esc(u.model) + '" data-stock="' + esc(u.stock_num) + '"></div>';
    h += '</div>';
    return h;
  }


  // ══════════════════════════════════════════════════════════════
  // LOTS VIEW — Area → Zone → Units
  // ══════════════════════════════════════════════════════════════
  var AREA_ORDER = ["SHOWROOM","DISPLAY","OVERFLOW","PDI BAY","QAC BAY",
    "SERVICE PARKING","WALK THRU","RECEIVING LINE","WASH","HITCH BAY",
    "SOLD/SALE PENDING","TRANSFER","TRADE CHECK-IN","MANAGER'S SPECIAL","OFF LOT","OTHER / OFF-SITE"];

  function lotsView() {
    return DB.getAllUnits().then(function (units) {
      var areas = {};
      for (var i = 0; i < units.length; i++) {
        var a = units[i].lot_area || "UNASSIGNED";
        if (!areas[a]) areas[a] = [];
        areas[a].push(units[i]);
      }

      var h = '<div class="view">';

      // Display zone grid
      h += '<div class="section-header">Display Zones</div>';
      h += '<div class="lot-grid">';
      var displayCodes = ["SHR01","SHR02","SHR03","DSP01","DSP02","DSP03","DSP04","DSP05","DSP06","DSP07","DSP08"];
      for (var di = 0; di < displayCodes.length; di++) {
        var code = displayCodes[di];
        var count = 0;
        for (var j = 0; j < units.length; j++) {
          var lot = (units[j].lot_location || "").toUpperCase().replace("CLE-", "");
          if (lot.indexOf(code) === 0) count++;
        }
        var shortCode = code.replace("DSP", "Z").replace("SHR", "SR");
        h += '<div class="lot-cell" data-action="zone-detail" data-zone="' + code + '">'
          + '<div class="lot-cell-code">' + shortCode + '</div>'
          + '<div class="lot-cell-count">' + count + '</div>'
          + '<div class="lot-cell-desc">' + esc((ZONE_INFO[code] || "").split(" — ")[1] || "") + '</div>'
          + '</div>';
      }
      h += '</div>';

      // Cross-filters
      h += renderCrossFilters(units, "lots");

      // All Areas
      h += '<div class="section-header">All Areas</div>';
      var sortedAreas = Object.keys(areas).sort(function (a, b) {
        var ai = AREA_ORDER.indexOf(a), bi = AREA_ORDER.indexOf(b);
        if (ai === -1) ai = 99;
        if (bi === -1) bi = 99;
        return ai - bi;
      });
      for (var ai = 0; ai < sortedAreas.length; ai++) {
        var area = sortedAreas[ai];
        var au = areas[area];
        h += '<div class="card card-interactive" data-action="area-detail" data-area="' + esc(area) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<span style="font-size:20px;font-weight:600;">' + esc(area) + '</span>'
          + '<span class="stat-val text-blue" style="font-size:28px;">' + au.length + '</span>'
          + '</div></div>';
      }
      h += '</div>';
      return h;
    });
  }

  function areaDetailView(areaName) {
    return DB.getAllUnits().then(function (units) {
      var areaUnits = units.filter(function (u) {
        return (u.lot_area || "UNASSIGNED") === areaName;
      });

      var h = '<div class="view">';
      h += backBtn("lots", "Lots");
      h += '<div class="zone-banner"><div class="zone-banner-name">' + esc(areaName) + '</div>'
        + '<div class="zone-banner-count">' + areaUnits.length + ' units</div></div>';

      // Cross-filters
      h += renderCrossFilters(areaUnits, "lots");

      // Group by lot code
      var byLot = {};
      for (var i = 0; i < areaUnits.length; i++) {
        var lot = areaUnits[i].lot_location || "(No Lot)";
        if (!byLot[lot]) byLot[lot] = [];
        byLot[lot].push(areaUnits[i]);
      }
      var lots = Object.keys(byLot).sort();
      for (var li = 0; li < lots.length; li++) {
        var lot = lots[li];
        var lu = byLot[lot];
        h += '<div class="card"><div class="card-title">' + esc(lot) + ' (' + lu.length + ')</div>';
        for (var j = 0; j < lu.length; j++) h += renderUnitCard(lu[j]);
        h += '</div>';
      }

      if (areaUnits.length === 0) {
        h += '<div class="empty-state"><div class="empty-icon">&#128230;</div>'
          + '<div class="empty-title">No Units</div></div>';
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
      var shortCode = zoneCode.replace("DSP", "Zone ").replace("SHR", "Showroom ");
      h += '<div class="zone-banner">'
        + '<div class="zone-banner-name">' + shortCode + '</div>'
        + '<div class="zone-banner-desc">' + esc(ZONE_INFO[zoneCode] || "") + '</div>'
        + '<div class="zone-banner-count">' + zoneUnits.length + '</div>'
        + '</div>';

      // Cross-filters
      h += renderCrossFilters(zoneUnits, "lots");

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
            + '<span>Stk# ' + esc(u.stock_num) + '</span><span class="sep">&middot;</span>'
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
  // STATUS VIEW — Category → Status → Units
  // ══════════════════════════════════════════════════════════════
  function statusView() {
    return DB.getAllUnits().then(function (units) {
      var h = '<div class="view">';

      // Count by category
      var catCounts = {};
      for (var i = 0; i < units.length; i++) {
        var cat = statusCat(units[i].status);
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      }

      // KPI row
      h += '<div class="stats-row">'
        + '<div class="stat-pill"><div class="stat-val text-green">' + (catCounts["Stock"] || 0) + '</div><div class="stat-label">Stock</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-red">' + (catCounts["Dead"] || 0) + '</div><div class="stat-label">Dead</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-blue">' + (catCounts["Transit"] || 0) + '</div><div class="stat-label">Transit</div></div>'
        + '</div>';

      // Category tiles
      h += '<div class="section-header">Status Categories</div>';
      for (var ci = 0; ci < STATUS_CATS.length; ci++) {
        var cat = STATUS_CATS[ci];
        var count = catCounts[cat.name] || 0;
        if (count === 0) continue;
        var pct = Math.round(count / units.length * 100);
        h += '<div class="card card-interactive" data-action="status-cat" data-category="' + cat.name + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<div><span style="font-size:22px;font-weight:700;">' + esc(cat.name) + '</span>'
          + '<span style="font-size:18px;color:var(--text-3);margin-left:8px;">' + esc(cat.label) + '</span></div>'
          + '<span class="stat-val text-' + cat.color + '" style="font-size:32px;">' + count + '</span>'
          + '</div>'
          + '<div class="util-bar mt-8"><div class="util-fill util-fill-' + cat.color + '" style="width:' + pct + '%;"></div></div>'
          + '<div style="font-size:18px;color:var(--text-3);margin-top:6px;">' + pct + '% of inventory</div>'
          + '</div>';
      }

      // Cross-filters
      h += renderCrossFilters(units, "status");

      h += '</div>';
      return h;
    });
  }

  function statusCategoryView(catName) {
    return DB.getAllUnits().then(function (units) {
      var catObj = null;
      for (var ci = 0; ci < STATUS_CATS.length; ci++) {
        if (STATUS_CATS[ci].name === catName) { catObj = STATUS_CATS[ci]; break; }
      }
      if (!catObj) catObj = { name: catName, color: "muted", label: "", statuses: [] };

      var catUnits = units.filter(function (u) { return statusCat(u.status) === catName; });

      var h = '<div class="view">';
      h += backBtn("status", "Status");
      h += '<div class="zone-banner" style="background:linear-gradient(135deg, var(--' + catObj.color + '-dim), var(--surface-2));">'
        + '<div class="zone-banner-name" style="color:var(--' + catObj.color + ');">' + esc(catName) + '</div>'
        + '<div class="zone-banner-desc">' + esc(catObj.label) + '</div>'
        + '<div class="zone-banner-count">' + catUnits.length + '</div></div>';

      // Status breakdown
      var byStatus = {};
      for (var i = 0; i < catUnits.length; i++) {
        var s = catUnits[i].status || "UNKNOWN";
        byStatus[s] = (byStatus[s] || 0) + 1;
      }
      var statuses = Object.keys(byStatus).sort(function (a, b) { return byStatus[b] - byStatus[a]; });

      h += '<div class="section-header">Statuses</div>';
      for (var si = 0; si < statuses.length; si++) {
        var s = statuses[si];
        var cnt = byStatus[s];
        var pct = Math.round(cnt / catUnits.length * 100);
        h += '<div class="card card-interactive" data-action="status-units" data-status="' + esc(s) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<span style="font-size:20px;font-weight:600;">' + esc(s) + '</span>'
          + '<span style="font-size:24px;font-weight:800;color:var(--' + catObj.color + ');">' + cnt + '</span>'
          + '</div>'
          + '<div class="util-bar mt-8"><div class="util-fill util-fill-' + catObj.color + '" style="width:' + pct + '%;"></div></div>'
          + '</div>';
      }

      // Cross-filters
      h += renderCrossFilters(catUnits, "status");

      h += '</div>';
      return h;
    });
  }

  function statusUnitsView(statusName) {
    return DB.getAllUnits().then(function (units) {
      var filtered = units.filter(function (u) { return u.status === statusName; });

      var h = '<div class="view">';
      var cat = statusCat(statusName);
      h += backBtn("status-cat/" + encodeURIComponent(cat), cat);
      h += '<div class="zone-banner"><div class="zone-banner-name">' + esc(statusName) + '</div>'
        + '<div class="zone-banner-count">' + filtered.length + '</div></div>';

      // Cross-filters
      h += renderCrossFilters(filtered, "status");

      // Units
      h += '<div class="section-header">Units</div>';
      for (var i = 0; i < filtered.length; i++) h += renderUnitCard(filtered[i]);

      if (filtered.length === 0) {
        h += '<div class="empty-state"><div class="empty-icon">&#128230;</div>'
          + '<div class="empty-title">No Units</div></div>';
      }
      h += '</div>';
      return h;
    });
  }


  // ══════════════════════════════════════════════════════════════
  // MAKES VIEW — Manufacturer → Make → Model → Units
  // ══════════════════════════════════════════════════════════════
  function makesView() {
    return DB.getAllUnits().then(function (units) {
      var byMfr = {};
      for (var i = 0; i < units.length; i++) {
        var mfr = units[i].manufacturer || units[i].make || "Unknown";
        if (!byMfr[mfr]) byMfr[mfr] = [];
        byMfr[mfr].push(units[i]);
      }

      var h = '<div class="view">';

      // KPI
      var mfrKeys = Object.keys(byMfr);
      var makeSet = {};
      for (var i = 0; i < units.length; i++) makeSet[units[i].make || ""] = true;
      h += '<div class="stats-row">'
        + '<div class="stat-pill"><div class="stat-val text-blue">' + mfrKeys.length + '</div><div class="stat-label">Manufacturers</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-orange">' + Object.keys(makeSet).length + '</div><div class="stat-label">Makes</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-green">' + units.length + '</div><div class="stat-label">Units</div></div>'
        + '</div>';

      // Manufacturer tiles
      h += '<div class="section-header">Manufacturers</div>';
      var sorted = mfrKeys.sort(function (a, b) { return byMfr[b].length - byMfr[a].length; });
      for (var mi = 0; mi < sorted.length; mi++) {
        var mfr = sorted[mi];
        var mu = byMfr[mfr];
        var pct = Math.round(mu.length / units.length * 100);
        // Count unique makes
        var makesInMfr = {};
        for (var i = 0; i < mu.length; i++) makesInMfr[mu[i].make || ""] = true;
        h += '<div class="card card-interactive" data-action="make-detail" data-manufacturer="' + esc(mfr) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<div><div style="font-size:20px;font-weight:700;">' + esc(mfr) + '</div>'
          + '<div style="font-size:18px;color:var(--text-3);">' + Object.keys(makesInMfr).length + ' make' + (Object.keys(makesInMfr).length > 1 ? 's' : '') + '</div></div>'
          + '<span class="stat-val text-blue" style="font-size:28px;">' + mu.length + '</span>'
          + '</div>'
          + '<div class="util-bar mt-8"><div class="util-fill" style="width:' + pct + '%;"></div></div>'
          + '</div>';
      }

      // Cross-filters
      h += renderCrossFilters(units, "makes");

      h += '</div>';
      return h;
    });
  }

  function makeDetailView(manufacturer) {
    return DB.getAllUnits().then(function (units) {
      var mfrUnits = units.filter(function (u) {
        return (u.manufacturer || u.make || "Unknown") === manufacturer;
      });

      var h = '<div class="view">';
      h += backBtn("makes", "Makes");
      h += '<div class="zone-banner"><div class="zone-banner-name">' + esc(manufacturer) + '</div>'
        + '<div class="zone-banner-count">' + mfrUnits.length + ' units</div></div>';

      // Group by make
      var byMake = {};
      for (var i = 0; i < mfrUnits.length; i++) {
        var make = mfrUnits[i].make || "Unknown";
        if (!byMake[make]) byMake[make] = [];
        byMake[make].push(mfrUnits[i]);
      }

      var makeKeys = Object.keys(byMake).sort(function (a, b) { return byMake[b].length - byMake[a].length; });
      h += '<div class="section-header">Makes</div>';
      for (var mi = 0; mi < makeKeys.length; mi++) {
        var make = makeKeys[mi];
        var mu = byMake[make];
        // Count models
        var models = {};
        for (var i = 0; i < mu.length; i++) models[mu[i].model || ""] = true;
        h += '<div class="card card-interactive" data-action="model-units" data-make="' + esc(make) + '" data-manufacturer="' + esc(manufacturer) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<div><div style="font-size:20px;font-weight:700;">' + esc(make) + '</div>'
          + '<div style="font-size:18px;color:var(--text-3);">' + Object.keys(models).length + ' model' + (Object.keys(models).length > 1 ? 's' : '') + '</div></div>'
          + '<span class="stat-val text-blue" style="font-size:28px;">' + mu.length + '</span>'
          + '</div></div>';
      }

      // Cross-filters
      h += renderCrossFilters(mfrUnits, "makes");

      h += '</div>';
      return h;
    });
  }

  function modelUnitsView(make, manufacturer) {
    return DB.getAllUnits().then(function (units) {
      var makeUnits = units.filter(function (u) { return u.make === make; });

      var h = '<div class="view">';
      h += backBtn("make-detail/" + encodeURIComponent(manufacturer || make), manufacturer || make);
      h += '<div class="zone-banner"><div class="zone-banner-name">' + esc(make) + '</div>'
        + '<div class="zone-banner-count">' + makeUnits.length + ' units</div></div>';

      // Cross-filters
      h += renderCrossFilters(makeUnits, "makes");

      // Group by model
      var byModel = {};
      for (var i = 0; i < makeUnits.length; i++) {
        var model = makeUnits[i].model || "Unknown";
        if (!byModel[model]) byModel[model] = [];
        byModel[model].push(makeUnits[i]);
      }
      var modelKeys = Object.keys(byModel).sort();
      for (var mi = 0; mi < modelKeys.length; mi++) {
        var model = modelKeys[mi];
        var mu = byModel[model];
        h += '<div class="card"><div class="card-title">' + esc(model) + ' (' + mu.length + ')</div>';
        mu.sort(function (a, b) { return priceNum(a.retail_price) - priceNum(b.retail_price); });
        for (var j = 0; j < mu.length; j++) {
          var u = mu[j];
          h += '<div class="result-card" style="margin-bottom:6px;padding:12px 16px;" data-action="detail" data-stock="' + esc(u.stock_num) + '">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;">'
            + '<span style="font-size:20px;font-weight:700;">' + esc(u.year) + ' ' + esc(u.floor_layout || "") + '</span>'
            + (fmtPrice(u.retail_price) ? '<span style="font-size:18px;font-weight:700;color:var(--green);">' + fmtPrice(u.retail_price) + '</span>' : '')
            + '</div>'
            + '<div style="font-size:18px;color:var(--text-2);margin-top:2px;">'
            + 'Stk# ' + esc(u.stock_num) + ' &middot; ' + esc(u.lot_location || "No Lot")
            + ' &middot; <span class="status-badge ' + statusClass(u.status) + '">' + esc(u.status) + '</span>'
            + '</div></div>';
        }
        h += '</div>';
      }

      h += '</div>';
      return h;
    });
  }


  // ══════════════════════════════════════════════════════════════
  // SHOP BY LAYOUT — Type → Body Style → Floor Layout → Units
  // ══════════════════════════════════════════════════════════════
  function shopView() {
    return DB.getAllUnits().then(function (units) {
      // Only show sellable inventory for shopping
      var shopUnits = units.filter(function (u) {
        return statusCat(u.status) === "Stock";
      });

      var byType = {};
      for (var i = 0; i < shopUnits.length; i++) {
        var t = shopUnits[i].veh_type || "Other";
        if (!byType[t]) byType[t] = [];
        byType[t].push(shopUnits[i]);
      }

      var h = '<div class="view">';
      h += '<div class="section-header" style="margin-top:0;">Shop by Layout</div>';
      h += '<div style="font-size:18px;color:var(--text-3);margin-bottom:16px;">Browse sellable inventory by type, body style, and floor plan</div>';

      var types = Object.keys(byType).sort(function (a, b) { return byType[b].length - byType[a].length; });
      for (var ti = 0; ti < types.length; ti++) {
        var t = types[ti];
        var tu = byType[t];
        // Count body styles
        var bsSet = {};
        for (var i = 0; i < tu.length; i++) bsSet[tu[i].body_style || "Other"] = true;
        h += '<div class="card card-interactive" data-action="shop-body" data-type="' + esc(t) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<div><div style="font-size:22px;font-weight:700;">' + esc(t) + '</div>'
          + '<div style="font-size:18px;color:var(--text-3);">' + Object.keys(bsSet).length + ' body style' + (Object.keys(bsSet).length > 1 ? 's' : '') + '</div></div>'
          + '<span class="stat-val text-purple" style="font-size:32px;">' + tu.length + '</span>'
          + '</div></div>';
      }

      h += '</div>';
      return h;
    });
  }

  function shopBodyView(vehType) {
    return DB.getAllUnits().then(function (units) {
      var filtered = units.filter(function (u) {
        return u.veh_type === vehType && statusCat(u.status) === "Stock";
      });

      var h = '<div class="view">';
      h += backBtn("shop", "Shop");
      h += '<div class="zone-banner" style="background:linear-gradient(135deg, var(--purple-dim), var(--surface-2));">'
        + '<div class="zone-banner-name" style="color:var(--purple);">' + esc(vehType) + '</div>'
        + '<div class="zone-banner-count">' + filtered.length + '</div></div>';

      // Group by body style
      var byBS = {};
      for (var i = 0; i < filtered.length; i++) {
        var bs = filtered[i].body_style || "Other";
        if (!byBS[bs]) byBS[bs] = [];
        byBS[bs].push(filtered[i]);
      }
      var bsKeys = Object.keys(byBS).sort(function (a, b) { return byBS[b].length - byBS[a].length; });

      h += '<div class="section-header">Body Styles</div>';
      for (var bi = 0; bi < bsKeys.length; bi++) {
        var bs = bsKeys[bi];
        var bu = byBS[bs];
        // Count layouts
        var layoutSet = {};
        for (var i = 0; i < bu.length; i++) layoutSet[bu[i].floor_layout || "Unknown"] = true;
        h += '<div class="card card-interactive" data-action="shop-layout" data-type="' + esc(vehType) + '" data-body="' + esc(bs) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<div><div style="font-size:20px;font-weight:700;">' + esc(bs) + '</div>'
          + '<div style="font-size:18px;color:var(--text-3);">' + Object.keys(layoutSet).length + ' floor plan' + (Object.keys(layoutSet).length > 1 ? 's' : '') + '</div></div>'
          + '<span class="stat-val text-purple" style="font-size:28px;">' + bu.length + '</span>'
          + '</div></div>';
      }

      h += '</div>';
      return h;
    });
  }

  function shopLayoutView(vehType, bodyStyle) {
    return DB.getAllUnits().then(function (units) {
      var filtered = units.filter(function (u) {
        return u.veh_type === vehType && u.body_style === bodyStyle && statusCat(u.status) === "Stock";
      });

      var h = '<div class="view">';
      h += backBtn("shop-body/" + encodeURIComponent(vehType), vehType);
      h += '<div class="zone-banner" style="background:linear-gradient(135deg, var(--purple-dim), var(--surface-2));">'
        + '<div class="zone-banner-name" style="color:var(--purple);">' + esc(bodyStyle) + '</div>'
        + '<div class="zone-banner-desc">' + esc(vehType) + '</div>'
        + '<div class="zone-banner-count">' + filtered.length + '</div></div>';

      // Group by floor layout, then sort by make/price within each
      var byLayout = {};
      for (var i = 0; i < filtered.length; i++) {
        var fl = filtered[i].floor_layout || "Unknown";
        if (!byLayout[fl]) byLayout[fl] = [];
        byLayout[fl].push(filtered[i]);
      }
      var layoutKeys = Object.keys(byLayout).sort();

      for (var li = 0; li < layoutKeys.length; li++) {
        var layout = layoutKeys[li];
        var lu = byLayout[layout];
        lu.sort(function (a, b) {
          var cmp = (a.make || "").localeCompare(b.make || "");
          return cmp !== 0 ? cmp : priceNum(a.retail_price) - priceNum(b.retail_price);
        });

        h += '<div class="card"><div class="card-title">' + esc(layout) + ' (' + lu.length + ')</div>';
        for (var j = 0; j < lu.length; j++) {
          var u = lu[j];
          h += '<div class="result-card" style="margin-bottom:6px;padding:12px 16px;" data-action="detail" data-stock="' + esc(u.stock_num) + '">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;">'
            + '<span style="font-size:20px;font-weight:700;">' + esc(u.year) + ' ' + esc(u.make) + ' ' + esc(u.model) + '</span>'
            + (fmtPrice(u.retail_price) ? '<span style="font-size:18px;font-weight:700;color:var(--green);">' + fmtPrice(u.retail_price) + '</span>' : '')
            + '</div>'
            + '<div style="font-size:18px;color:var(--text-2);margin-top:2px;">'
            + 'Stk# ' + esc(u.stock_num) + ' &middot; ' + esc(u.lot_location || "No Lot")
            + ' &middot; ' + esc(priceGroup(u.retail_price))
            + '</div></div>';
        }
        h += '</div>';
      }

      if (filtered.length === 0) {
        h += '<div class="empty-state"><div class="empty-icon">&#128722;</div>'
          + '<div class="empty-title">None Available</div>'
          + '<div class="empty-desc">No sellable units with this layout</div></div>';
      }
      h += '</div>';
      return h;
    });
  }


  // ══════════════════════════════════════════════════════════════
  // MORE VIEW — Links to Notes, Audit, Coverage, Shop
  // ══════════════════════════════════════════════════════════════
  function moreView() {
    return DB.getPendingNotes().then(function (pending) {
      var h = '<div class="view">';
      h += '<div class="section-header" style="margin-top:0;">Tools</div>';

      h += '<a class="note-type-card" href="#notes">'
        + '<div class="note-type-icon" style="background:var(--green-dim);color:var(--green);">&#128221;</div>'
        + '<div><div class="note-type-label">Field Notes</div>'
        + '<div class="note-type-desc">Submit verifications, holes, reorgs'
        + (pending.length > 0 ? ' <span style="color:var(--orange);font-weight:700;">(' + pending.length + ' pending)</span>' : '')
        + '</div></div></a>';

      h += '<a class="note-type-card" href="#audit">'
        + '<div class="note-type-icon" style="background:var(--red-dim);color:var(--red);">&#128737;</div>'
        + '<div><div class="note-type-label">Audit</div>'
        + '<div class="note-type-desc">Data quality flags and alerts</div></div></a>';

      h += '<a class="note-type-card" href="#coverage">'
        + '<div class="note-type-icon" style="background:var(--blue-dim);color:var(--blue);">&#128200;</div>'
        + '<div><div class="note-type-label">Coverage Matrix</div>'
        + '<div class="note-type-desc">Display zone coverage and gaps</div></div></a>';

      h += '<a class="note-type-card" href="#shop">'
        + '<div class="note-type-icon" style="background:var(--purple-dim);color:var(--purple);">&#128722;</div>'
        + '<div><div class="note-type-label">Shop by Layout</div>'
        + '<div class="note-type-desc">Browse by type, body style, floor plan</div></div></a>';

      h += '</div>';
      return h;
    });
  }


  // ══════════════════════════════════════════════════════════════
  // COVERAGE MATRIX — Display zone coverage analysis
  // ══════════════════════════════════════════════════════════════
  function coverageView() {
    return DB.getAllUnits().then(function (units) {
      var h = '<div class="view">';
      h += backBtn("more", "More");
      h += '<div class="section-header" style="margin-top:0;">Display Zone Coverage</div>';

      // Only display/showroom zones
      var displayZones = ["SHR01","SHR02","SHR03","DSP01","DSP02","DSP03","DSP04","DSP05","DSP06","DSP07","DSP08"];

      for (var di = 0; di < displayZones.length; di++) {
        var zoneCode = displayZones[di];
        var zoneUnits = units.filter(function (u) {
          var lot = (u.lot_location || "").toUpperCase().replace("CLE-", "");
          return lot.indexOf(zoneCode) === 0;
        });

        var shortCode = zoneCode.replace("DSP", "Zone ").replace("SHR", "Showroom ");
        var zoneName = ZONE_INFO[zoneCode] || shortCode;

        h += '<div class="card">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<div><div style="font-size:20px;font-weight:700;">' + shortCode + '</div>'
          + '<div style="font-size:18px;color:var(--text-3);">' + esc(zoneName) + '</div></div>'
          + '<span class="stat-val text-blue" style="font-size:28px;">' + zoneUnits.length + '</span>'
          + '</div>';

        if (zoneUnits.length > 0) {
          // Types present
          var byType = {}, byMake = {}, models = {};
          for (var i = 0; i < zoneUnits.length; i++) {
            var u = zoneUnits[i];
            byType[u.veh_type || "Other"] = (byType[u.veh_type || "Other"] || 0) + 1;
            byMake[u.make || "Unknown"] = (byMake[u.make || "Unknown"] || 0) + 1;
            var mk = (u.make || "") + " " + (u.model || "");
            models[mk] = (models[mk] || 0) + 1;
          }

          // Type pills
          h += '<div class="cov-pills" style="margin-top:10px;">';
          var typeKeys = Object.keys(byType).sort();
          for (var ti = 0; ti < typeKeys.length; ti++) {
            h += '<span class="cov-pill cov-pill-info">' + esc(typeKeys[ti]) + ' (' + byType[typeKeys[ti]] + ')</span>';
          }
          h += '</div>';

          // Make pills
          h += '<div class="cov-pills">';
          var makeKeys = Object.keys(byMake).sort(function (a, b) { return byMake[b] - byMake[a]; });
          for (var mi = 0; mi < Math.min(makeKeys.length, 8); mi++) {
            h += '<span class="cov-pill cov-pill-yes">' + esc(makeKeys[mi]) + ' (' + byMake[makeKeys[mi]] + ')</span>';
          }
          if (makeKeys.length > 8) h += '<span class="cov-pill" style="background:var(--surface-3);color:var(--text-3);">+' + (makeKeys.length - 8) + ' more</span>';
          h += '</div>';

          // Duplicate models (same model shown more than once)
          var dupeModels = Object.keys(models).filter(function (m) { return models[m] > 1; });
          if (dupeModels.length > 0) {
            h += '<div style="margin-top:8px;font-size:18px;color:var(--orange);">Duplicates: ';
            for (var di2 = 0; di2 < dupeModels.length; di2++) {
              if (di2 > 0) h += ', ';
              h += esc(dupeModels[di2].trim()) + ' (' + models[dupeModels[di2]] + ')';
            }
            h += '</div>';
          }
        } else {
          h += '<div style="font-size:18px;color:var(--text-3);margin-top:8px;">Empty zone</div>';
        }
        h += '</div>';
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
        h += backBtn("more", "More");

        // Pending queue
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
              + '<span class="flag-badge" style="background:' + (n.status === "Submitted" ? 'var(--green-dim);color:var(--green)' : 'var(--surface-3);color:var(--text-2)') + ';">' + esc(n.status || "Submitted") + '</span></div>'
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
    var lookupPromise = stockNum ? DB.getUnit(stockNum) : Promise.resolve(null);
    return lookupPromise.then(function (unit) {
      var h = '<div class="view">';
      h += backBtn("notes", "Notes");
      if (type === "verify") h += renderVerifyForm(unit, stockNum);
      else if (type === "hole") h += renderHoleForm();
      else h += renderReorgForm(unit, stockNum);
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
      + renderZoneSelect("actual_lot", false)
      + '</div>';

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
      + renderZoneSelect("zone", true);

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

    h += '<label class="form-label">From Zone</label>'
      + renderZoneSelect("zone_from", false);

    h += '<label class="form-label">To Zone</label>'
      + renderZoneSelect("zone_to", false);

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

    h += '<label class="form-label">What needs to change?</label>'
      + '<textarea class="form-textarea" name="description" required placeholder="Describe the situation:\n- Which units are out of place\n- What should be moved where"></textarea>';

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
      h += backBtn("more", "More");

      var critical = flags.filter(function (f) { return f.severity === "CRITICAL"; }).length;
      var warning = flags.filter(function (f) { return f.severity === "WARNING"; }).length;
      var info = flags.filter(function (f) { return f.severity === "INFO"; }).length;

      h += '<div class="stats-row">'
        + '<div class="stat-pill"><div class="stat-val text-red">' + critical + '</div><div class="stat-label">Critical</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-orange">' + warning + '</div><div class="stat-label">Warning</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-blue">' + info + '</div><div class="stat-label">Info</div></div>'
        + '</div>';

      h += '<div class="chip-row">'
        + '<div class="chip active" data-filter="all">All (' + flags.length + ')</div>'
        + '<div class="chip" data-filter="CRITICAL">Critical (' + critical + ')</div>'
        + '<div class="chip" data-filter="WARNING">Warning (' + warning + ')</div>'
        + '<div class="chip" data-filter="INFO">Info (' + info + ')</div>'
        + '</div>';

      h += '<div id="auditList">' + renderAuditFlags(flags, "all") + '</div>';
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
    var STOCK = ["READY FOR SALE","RVASAP","SHOWROOM","RESTOCK","RV SHOW UNIT","RV SHOW BACKUP","AS IS","STORM DAMAGE"];
    var DEAD = ["PRE PDI","IN SERVICE","AWAITING PARTS","DRIVER DAMAGE","LOT DAMAGE","INSURANCE CLAIM","FACTORY REVIEW",
      "SALE PENDING","FLEET PENDING","AWAITING TITLE","SOLD","WHOLESALE","WHOLESALE - USED","TEMPLATE","BUYBACK","DELETED","TRADE IN"];
    var TERMINAL = ["SOLD","WHOLESALE","WHOLESALE - USED","TEMPLATE","BUYBACK","DELETED","TRADE IN"];
    var TRANSIT = ["SHIPPED","DISPATCHED","TRANSFER","STORE-TO-STORE TRANSFER","DRIVER NEEDED","IN TRANSIT"];
    var DISPLAY_AREAS = ["DISPLAY","SHOWROOM","OVERFLOW"];
    var PENDING_OK = ["SALE PENDING","FLEET PENDING"];

    var flags = [];
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var st = (u.status || "").toUpperCase();
      var area = (u.lot_area || "").toUpperCase();
      var sd = parseInt(u.status_days) || 0;
      var lot = u.lot_location || "";

      if (DEAD.indexOf(st) !== -1 && PENDING_OK.indexOf(st) === -1 && DISPLAY_AREAS.indexOf(area) !== -1)
        flags.push({ severity: "CRITICAL", flag: "DEAD_ON_DISPLAY", stock_num: u.stock_num, make: u.make, model: u.model, description: st + " on " + area + " (" + lot + ")" });

      if (st === "SALE PENDING" && sd >= 3 && DISPLAY_AREAS.indexOf(area) !== -1)
        flags.push({ severity: "WARNING", flag: "SALE_PENDING_AGED", stock_num: u.stock_num, make: u.make, model: u.model, description: "Sale pending " + sd + " days on display" });

      if ((st === "IN SERVICE" || st === "AWAITING PARTS") && sd > 9)
        flags.push({ severity: "WARNING", flag: "IN_SERVICE_AGED", stock_num: u.stock_num, make: u.make, model: u.model, description: "In service " + sd + " days ($" + (sd * 20) + " interest)" });

      if (TRANSIT.indexOf(st) !== -1 && DISPLAY_AREAS.indexOf(area) !== -1)
        flags.push({ severity: "WARNING", flag: "TRANSIT_ON_DISPLAY", stock_num: u.stock_num, make: u.make, model: u.model, description: st + " but on " + area });

      var needsLot = STOCK.indexOf(st) !== -1 || (DEAD.indexOf(st) !== -1 && TERMINAL.indexOf(st) === -1);
      if (!lot && needsLot)
        flags.push({ severity: "INFO", flag: "NO_LOT_ASSIGNED", stock_num: u.stock_num, make: u.make, model: u.model, description: st + " with no lot location" });
    }

    var SEV = { CRITICAL: 0, WARNING: 1, INFO: 2 };
    flags.sort(function (a, b) { return (SEV[a.severity] || 9) - (SEV[b.severity] || 9); });
    return flags;
  }


  // ══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════
  return {
    homeView: homeView,
    renderSearchResults: renderSearchResults,
    unitDetailView: unitDetailView,
    lotsView: lotsView,
    areaDetailView: areaDetailView,
    zoneDetailView: zoneDetailView,
    statusView: statusView,
    statusCategoryView: statusCategoryView,
    statusUnitsView: statusUnitsView,
    makesView: makesView,
    makeDetailView: makeDetailView,
    modelUnitsView: modelUnitsView,
    shopView: shopView,
    shopBodyView: shopBodyView,
    shopLayoutView: shopLayoutView,
    moreView: moreView,
    coverageView: coverageView,
    notesView: notesView,
    noteFormView: noteFormView,
    auditView: auditView,
    renderAuditFlags: renderAuditFlags,
    computeAuditFlags: computeAuditFlags,
    esc: esc,
  };
})();
