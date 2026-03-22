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
    { type: "DISP", label: "Display",  codes: ["DISP01","DISP02","DISP03","DISP04","DISP05","DISP06","DISP07","DISP08","DISP10","DISP11"] },
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
          + '<input class="search-input" type="text" id="searchInput" placeholder="Stock# or VIN (last 8)..." autocomplete="off" autocapitalize="characters">'
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
          h += '<div class="text-center text-muted" style="font-size:12px;padding:8px 0;">Data as of ' + esc(exportedAt) + '</div>';
        }

        // Help link
        h += '<div style="text-align:center;padding:4px 0;">'
          + '<a href="#help" style="font-size:13px;color:var(--text-3);text-decoration:none;">How to Use This App</a>'
          + '</div>';

        // Powered by RAY.i footer — seamless blend into app background
        h += '<div style="padding:0;display:flex;justify-content:center;align-items:center;margin:4px -16px 0;">'
          + '<img src="img/powered-by-rayi.png" alt="Powered by RAY.i" style="width:100%;max-width:375px;" />'
          + '</div>';

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

    var stUp = (u.status || "").toUpperCase();
    var isSP = stUp === "SALE PENDING";
    var isRetailPending = isSP || stUp === "FLEET PENDING" || stUp === "RETAIL ORDERED";
    var TRANSIT_CATS = ["SHIPPED","DISPATCHED","TRANSFER","STORE-TO-STORE TRANSFER","DRIVER NEEDED","IN TRANSIT","OPS TRANSFER"];
    var isTransit = false;
    for (var ti = 0; ti < TRANSIT_CATS.length; ti++) { if (stUp === TRANSIT_CATS[ti]) { isTransit = true; break; } }
    var inDisplay = (u.lot_area || "").toUpperCase() === "DISPLAY" || (u.lot_area || "").toUpperCase() === "SHOWROOM";

    // ── Header ──
    h += '<div class="unit-header">'
      + '<div class="unit-ymm">' + esc(u.year) + ' ' + esc(u.make) + ' ' + esc(u.model) + '</div>'
      + '<div class="unit-sub">' + esc(u.floor_layout || "") + (u.body_style ? ' &middot; ' + esc(u.body_style) : '') + '</div>'
      + '</div>';

    // ── Quick Stats ──
    h += '<div class="stats-row">'
      + '<div class="stat-pill"><div class="stat-val text-blue">' + esc(u.age || "\u2014") + '</div><div class="stat-label">Days Old</div></div>'
      + '<div class="stat-pill"><div class="stat-val text-orange">' + esc(u.status_days || "\u2014") + '</div><div class="stat-label">In Status</div></div>'
      + '<div class="stat-pill"><div class="stat-val" style="font-size:20px;"><span class="status-badge ' + statusClass(u.status) + '">' + esc(u.status) + '</span></div><div class="stat-label">Status</div></div>'
      + '</div>';

    // ── Card 1: Unit Info (Identity + Product merged) ──
    h += '<div class="card"><div class="card-title">Unit Info</div>'
      + fieldRow("Stock #", u.stock_num)
      + fieldRow("VIN", u.vin)
      + fieldRow("Make", u.make)
      + fieldRow("Model", u.model)
      + fieldRow("Type", u.veh_type)
      + fieldRow("Body Style", u.body_style)
      + fieldRow("Floor Layout", u.floor_layout)
      + fieldRow("Condition", u.condition)
      + '</div>';

    // ── Card 2: Location (with action buttons + transfer notes) ──
    h += '<div class="card"><div class="card-title">Location</div>'
      + fieldRow("PC", u.pc)
      + fieldRow("Lot Location", u.lot_location)
      + fieldRow("Lot Area", u.lot_area);

    // Transfer notes inline for transit units
    if (isTransit && u.transfer_notes) {
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">'
        + fieldRow("Transfer Notes", u.transfer_notes) + '</div>';
    }

    h += '<div style="margin-top:12px;display:flex;gap:8px;">'
      + '<a class="btn btn-blue" style="flex:1;text-align:center;" data-action="verify-note" data-stock="' + esc(u.stock_num) + '">Verify</a>'
      + '<a class="btn btn-ghost" style="flex:1;text-align:center;" data-action="reorg-note" data-stock="' + esc(u.stock_num) + '">Suggest Move</a>'
      + '</div></div>';

    // ── Card 3: Retail Deal (only for SP/pending units with deal data) ──
    if (isRetailPending && (u.deal_status || u.deal_number || u.hold_salesman
        || u.deal_type || u.deal_delivery_date || u.exp_delivery_date
        || u.funding_status || u.funded_date)) {
      h += '<div class="card"><div class="card-title">Retail Deal</div>';
      if (u.hold_salesman) h += fieldRow("Salesman", u.hold_salesman);
      if (u.deal_number) h += fieldRow("Deal #", u.deal_number);
      if (u.deal_status) h += fieldRow("Deal Status", u.deal_status);
      if (u.deal_type) h += fieldRow("Deal Type", u.deal_type);
      if (u.deal_delivery_date) h += fieldRow("Deal Delivery", u.deal_delivery_date);
      if (u.exp_delivery_date) h += fieldRow("Exp. Delivery", u.exp_delivery_date);
      if (u.funding_status) h += fieldRow("Funding Status", u.funding_status);
      if (u.funded_date) h += fieldRow("Funded Date", u.funded_date);
      h += '</div>';
    }

    // ── Card 4: Pricing (compact) ──
    if (fmtPrice(u.retail_price) || fmtPrice(u.msrp) || fmtPrice(u.special_price)) {
      h += '<div class="card"><div class="card-title">Pricing</div>'
        + fieldRow("Retail", fmtPrice(u.retail_price))
        + fieldRow("MSRP", fmtPrice(u.msrp));
      if (u.special_price) {
        h += fieldRow("Special", '<span style="color:var(--green);font-weight:700;">' + fmtPrice(u.special_price) + '</span>');
      }
      h += '</div>';
    }

    // ── Action Buttons ──
    var dupeCount = 0;
    if (allUnits && u.make && u.model) {
      for (var di = 0; di < allUnits.length; di++) {
        if (allUnits[di].stock_num !== u.stock_num
            && (allUnits[di].make || "").toUpperCase() === (u.make || "").toUpperCase()
            && (allUnits[di].model || "").toUpperCase() === (u.model || "").toUpperCase()) dupeCount++;
      }
    }
    var similarCount = 0;
    if (allUnits && u.veh_type && u.body_style) {
      for (var si = 0; si < allUnits.length; si++) {
        if (allUnits[si].stock_num !== u.stock_num
            && allUnits[si].veh_type === u.veh_type
            && allUnits[si].body_style === u.body_style) similarCount++;
      }
    }

    // Replacement button for SP in display (most prominent)
    if (isSP && inDisplay) {
      h += '<a class="btn" href="#replace-picker/' + encodeURIComponent(u.stock_num) + '" style="display:block;margin-top:12px;background:var(--orange);color:#fff;text-align:center;font-weight:700;text-decoration:none;padding:14px;">Select Replacement from Overflow</a>';
    }

    // Dupe & similar navigation
    if (dupeCount > 0 || similarCount > 0) {
      h += '<div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">';
      if (dupeCount > 0) {
        h += '<a class="card card-interactive" href="#unit-dupes/' + encodeURIComponent(u.stock_num) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">'
          + '<div><div style="font-size:16px;font-weight:600;">Duplicate Make &amp; Models</div>'
          + '<div style="font-size:13px;color:var(--text-3);">Same ' + esc(u.make) + ' ' + esc(u.model) + '</div></div>'
          + '<span class="stat-val" style="font-size:24px;color:var(--orange);">' + dupeCount + '</span></a>';
      }
      if (similarCount > 0) {
        h += '<a class="card card-interactive" href="#unit-similar/' + encodeURIComponent(u.stock_num) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">'
          + '<div><div style="font-size:16px;font-weight:600;">Compare Similar Models</div>'
          + '<div style="font-size:13px;color:var(--text-3);">Same ' + esc(u.veh_type) + ' / ' + esc(u.body_style) + '</div></div>'
          + '<span class="stat-val" style="font-size:24px;color:var(--blue);">' + similarCount + '</span></a>';
      }
      h += '</div>';
    }

    h += '</div>';
    return h;
  }


  // ══════════════════════════════════════════════════════════════
  // UNIT DUPLICATES VIEW — same make + model
  // ══════════════════════════════════════════════════════════════
  function unitDupesView(stockNum) {
    return DB.getUnit(stockNum).then(function (u) {
      if (!u) return '<div class="view">' + backBtn("home", "Home") + '<div class="empty-state">Unit not found</div></div>';
      return DB.getAllUnits().then(function (allUnits) {
        var dupes = allUnits.filter(function (o) {
          return o.stock_num !== u.stock_num
            && (o.make || "").toUpperCase() === (u.make || "").toUpperCase()
            && (o.model || "").toUpperCase() === (u.model || "").toUpperCase();
        });
        dupes.sort(function (a, b) {
          return (parseInt(b.status_days) || 0) - (parseInt(a.status_days) || 0);
        });

        var h = '<div class="view">';
        h += backBtn("detail/" + encodeURIComponent(u.stock_num), "Unit Detail");
        h += '<div class="section-title">DUPLICATE MAKE &amp; MODELS <span style="color:var(--orange);">(' + dupes.length + ')</span></div>';
        h += '<p style="color:var(--text-3);font-size:13px;margin:0 0 12px;">Same ' + esc(u.make) + ' ' + esc(u.model) + ' across the lot</p>';

        for (var i = 0; i < dupes.length; i++) {
          var d = dupes[i];
          var st = (d.status || "").toUpperCase();
          var stColor = 'var(--text-2)';
          if (st === 'READY FOR SALE' || st === 'RVASAP' || st === 'SHOWROOM') stColor = 'var(--green)';
          else if (st === 'SALE PENDING') stColor = 'var(--orange)';
          else if (st === 'IN SERVICE' || st === 'AWAITING PARTS' || st === 'DAMAGED') stColor = 'var(--red)';
          else if (st === 'SHIPPED' || st === 'DISPATCHED' || st === 'ORDERED' || st === 'PO ISSUED') stColor = 'var(--blue)';
          var sDays = d.status_days != null ? d.status_days + 'd in status' : '';

          h += '<div class="result-card" style="margin-bottom:6px;padding:12px 16px;" data-action="detail" data-stock="' + esc(d.stock_num) + '">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;">'
            + '<span style="font-size:18px;font-weight:700;">' + esc(d.year) + ' ' + esc(d.make) + ' ' + esc(d.model) + '</span>'
            + '<span style="font-size:14px;font-weight:700;color:' + stColor + ';">' + esc(d.status || '') + '</span>'
            + '</div>'
            + '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px;">'
            + '<span style="font-size:14px;color:var(--text-2);">Stk# ' + esc(d.stock_num) + ' &middot; ' + esc(d.lot_location || 'No Lot') + '</span>'
            + '<span style="font-size:13px;color:var(--text-3);">' + sDays + '</span>'
            + '</div></div>';
        }
        if (dupes.length === 0) h += '<div style="color:var(--text-3);padding:12px;">No duplicates found</div>';
        h += '</div>';
        return h;
      });
    });
  }

  // ══════════════════════════════════════════════════════════════
  // UNIT SIMILAR VIEW — same type + body style
  // ══════════════════════════════════════════════════════════════
  function unitSimilarView(stockNum) {
    return DB.getUnit(stockNum).then(function (u) {
      if (!u) return '<div class="view">' + backBtn("home", "Home") + '<div class="empty-state">Unit not found</div></div>';
      return DB.getAllUnits().then(function (allUnits) {
        var similar = allUnits.filter(function (o) {
          return o.stock_num !== u.stock_num
            && o.veh_type === u.veh_type
            && o.body_style === u.body_style;
        });
        similar.sort(function (a, b) {
          var cmp = (a.make || "").localeCompare(b.make || "");
          return cmp !== 0 ? cmp : priceNum(a.retail_price) - priceNum(b.retail_price);
        });

        var h = '<div class="view">';
        h += backBtn("detail/" + encodeURIComponent(u.stock_num), "Unit Detail");
        h += '<div class="section-title">COMPARE SIMILAR MODELS <span style="color:var(--blue);">(' + similar.length + ')</span></div>';
        h += '<p style="color:var(--text-3);font-size:13px;margin:0 0 12px;">Same ' + esc(u.veh_type) + ' / ' + esc(u.body_style) + '</p>';

        // Group by price group
        var byPG = {};
        for (var i = 0; i < similar.length; i++) {
          var pg = priceGroup(similar[i].retail_price);
          if (!byPG[pg]) byPG[pg] = [];
          byPG[pg].push(similar[i]);
        }
        var pgOrder = ["Under $20K","$20K\u2013$40K","$40K\u2013$60K","$60K\u2013$80K","$80K\u2013$100K","$100K+","No Price"];
        for (var pi = 0; pi < pgOrder.length; pi++) {
          var pgUnits = byPG[pgOrder[pi]];
          if (!pgUnits) continue;
          h += '<div class="section-header" style="margin-top:12px;">' + pgOrder[pi] + ' (' + pgUnits.length + ')</div>';
          for (var j = 0; j < pgUnits.length; j++) {
            var s = pgUnits[j];
            h += '<div class="result-card" style="margin-bottom:6px;padding:12px 16px;" data-action="detail" data-stock="' + esc(s.stock_num) + '">'
              + '<div style="display:flex;justify-content:space-between;align-items:center;">'
              + '<span style="font-size:18px;font-weight:700;">' + esc(s.year) + ' ' + esc(s.make) + ' ' + esc(s.model) + '</span>'
              + (fmtPrice(s.retail_price) ? '<span style="font-size:16px;font-weight:700;color:var(--green);">' + fmtPrice(s.retail_price) + '</span>' : '')
              + '</div>'
              + '<div style="font-size:13px;color:var(--text-2);margin-top:4px;">'
              + esc(s.floor_layout || "") + ' &middot; Stk# ' + esc(s.stock_num) + ' &middot; ' + esc(s.lot_location || "No Lot")
              + '</div></div>';
          }
        }
        if (similar.length === 0) h += '<div style="color:var(--text-3);padding:12px;">No similar models found</div>';
        h += '</div>';
        return h;
      });
    });
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

      // Lot Map quick-access
      h += '<a href="#lot-map" style="display:flex;align-items:center;gap:10px;padding:12px 16px;margin-bottom:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:inherit;">'
        + '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--copper)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>'
        + '<div><div style="font-size:16px;font-weight:600;">CLE Lot Map</div>'
        + '<div style="font-size:12px;color:var(--text-3);">View full lot layout</div></div></a>';

      // Display zone grid
      h += '<div class="section-header">Display Zones</div>';
      h += '<div class="lot-grid">';
      var displayCodes = ["SHR01","SHR02","SHR03","DISP01","DISP02","DISP03","DISP04","DISP05","DISP06","DISP07","DISP08","DISP10","DISP11"];
      for (var di = 0; di < displayCodes.length; di++) {
        var code = displayCodes[di];
        var count = 0;
        for (var j = 0; j < units.length; j++) {
          var lot = (units[j].lot_location || "").toUpperCase().replace("CLE-", "");
          if (lot.indexOf(code) === 0) count++;
        }
        var shortCode = code;
        h += '<div class="lot-cell" data-action="zone-detail" data-zone="' + code + '">'
          + '<div class="lot-cell-code">' + shortCode + '</div>'
          + '<div class="lot-cell-count">' + count + '</div>'
          + '<div class="lot-cell-desc">' + esc((ZONE_INFO[code] || "").split(" — ")[1] || "") + '</div>'
          + '</div>';
      }
      h += '</div>';

      // Overflow zone grid
      h += '<div class="section-header">Overflow</div>';
      h += '<div class="lot-grid">';
      var overflowCodes = ["OVR01","OVR02","OVR03","OVRB"];
      for (var oi = 0; oi < overflowCodes.length; oi++) {
        var ocode = overflowCodes[oi];
        var ocount = 0;
        for (var j = 0; j < units.length; j++) {
          var olot = (units[j].lot_location || "").toUpperCase().replace("CLE-", "");
          if (olot.indexOf(ocode) === 0) ocount++;
        }
        if (ocount > 0) {
          h += '<div class="lot-cell" data-action="zone-detail" data-zone="' + ocode + '">'
            + '<div class="lot-cell-code">' + ocode + '</div>'
            + '<div class="lot-cell-count">' + ocount + '</div>'
            + '</div>';
        }
      }
      h += '</div>';

      // Other areas grid
      var OTHER_AREAS = ["Service Parking","PDI Bay","QAC Bay","Wash","Walk Thru","Receiving Line",
                         "Sold/Sale Pending","RV Park","Trade Check-In","Showroom","OTHER / OFF-SITE","UNASSIGNED"];
      h += '<div class="section-header">Other Areas</div>';
      for (var oa = 0; oa < OTHER_AREAS.length; oa++) {
        var oaName = OTHER_AREAS[oa];
        var oaUnits = areas[oaName];
        if (!oaUnits || oaUnits.length === 0) continue;
        h += '<div class="card card-interactive" data-action="area-detail" data-area="' + esc(oaName) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<span style="font-size:16px;font-weight:600;">' + esc(oaName) + '</span>'
          + '<span class="stat-val text-blue" style="font-size:24px;">' + oaUnits.length + '</span>'
          + '</div></div>';
      }

      // Cross-filters
      h += renderCrossFilters(units, "lots");
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
      h += '<div class="zone-banner">'
        + '<div class="zone-banner-name">' + zoneCode + '</div>'
        + '<div class="zone-banner-desc">' + esc(ZONE_INFO[zoneCode] || "") + '</div>'
        + '<div class="zone-banner-count">' + zoneUnits.length + '</div>'
        + '</div>';

      // Cross-filters
      h += renderCrossFilters(zoneUnits, "lots");

      // Group units by status category
      for (var ci = 0; ci < STATUS_CATS.length; ci++) {
        var cat = STATUS_CATS[ci];
        var catUnits = zoneUnits.filter(function (u) { return statusCat(u.status) === cat.name; });
        if (catUnits.length === 0) continue;

        h += '<div class="card" style="border-left:3px solid var(--' + cat.color + ');">'
          + '<div class="card-title" style="color:var(--' + cat.color + ');">' + esc(cat.name) + ' — ' + esc(cat.label) + ' (' + catUnits.length + ')</div>';

        // Sort by make → model within each category
        catUnits.sort(function (a, b) {
          var cmp = (a.make || "").localeCompare(b.make || "");
          return cmp !== 0 ? cmp : (a.model || "").localeCompare(b.model || "");
        });

        for (var j = 0; j < catUnits.length; j++) {
          var u = catUnits[j];
          h += '<div class="result-card" style="margin-bottom:8px;" data-action="detail" data-stock="' + esc(u.stock_num) + '">'
            + '<div class="result-ymm" style="font-size:20px;">' + esc(u.make) + ' ' + esc(u.model) + ' ' + esc(u.floor_layout || "") + '</div>'
            + '<div class="result-meta" style="font-size:18px;">'
            + '<span>Stk# ' + esc(u.stock_num) + '</span><span class="sep">&middot;</span>'
            + '<span class="status-badge status-' + cat.color + '" style="font-size:12px;">' + esc(u.status) + '</span>'
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
  // ── Reusable type filter buttons ──
  function renderTypeFilters(units, filterFnName) {
    var vtCounts = {};
    for (var i = 0; i < units.length; i++) {
      var vt = (units[i].veh_type || "Other").toUpperCase();
      vtCounts[vt] = (vtCounts[vt] || 0) + 1;
    }
    var vtKeys = Object.keys(vtCounts).sort();
    if (vtKeys.length <= 1) return ''; // no point filtering one type
    var h = '<div class="cov-type-filters" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
    h += '<button class="cov-type-btn cov-type-active" data-vt="ALL" onclick="window.' + filterFnName + '(this,\'ALL\')">ALL (' + units.length + ')</button>';
    for (var vi = 0; vi < vtKeys.length; vi++) {
      h += '<button class="cov-type-btn" data-vt="' + vtKeys[vi] + '" onclick="window.' + filterFnName + '(this,\'' + vtKeys[vi] + '\')">' + vtKeys[vi] + ' (' + vtCounts[vtKeys[vi]] + ')</button>';
    }
    h += '</div>';
    return h;
  }

  // Generic filter handler — hides/shows cards by data-vt attribute
  window._typeCardFilter = function (btn, vt) {
    var wrap = btn.parentElement.parentElement;
    var btns = btn.parentElement.querySelectorAll('.cov-type-btn');
    for (var i = 0; i < btns.length; i++) btns[i].classList.remove('cov-type-active');
    btn.classList.add('cov-type-active');
    var cards = wrap.querySelectorAll('[data-vt]');
    for (var i = 0; i < cards.length; i++) {
      var el = cards[i];
      if (el.tagName === 'BUTTON') continue; // skip filter buttons themselves
      if (vt === 'ALL' || el.getAttribute('data-vt') === vt) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    }
  };

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

      // Manufacturer tiles with type filters
      h += '<div class="section-header">Manufacturers</div>';
      h += renderTypeFilters(units, '_typeCardFilter');
      var sorted = mfrKeys.sort();
      for (var mi = 0; mi < sorted.length; mi++) {
        var mfr = sorted[mi];
        var mu = byMfr[mfr];
        var pct = Math.round(mu.length / units.length * 100);
        // Count unique makes and determine primary vehicle type
        var makesInMfr = {};
        var vtInMfr = {};
        for (var i = 0; i < mu.length; i++) {
          makesInMfr[mu[i].make || ""] = true;
          var uvt = (mu[i].veh_type || "Other").toUpperCase();
          vtInMfr[uvt] = (vtInMfr[uvt] || 0) + 1;
        }
        // Get all veh types for this manufacturer (for multi-type filtering)
        var mfrVtKeys = Object.keys(vtInMfr);
        // Use first (most common) type as data-vt for filtering
        mfrVtKeys.sort(function(a,b) { return vtInMfr[b] - vtInMfr[a]; });
        var primaryVt = mfrVtKeys[0] || "";
        h += '<div class="card card-interactive" data-action="make-detail" data-manufacturer="' + esc(mfr) + '" data-vt="' + esc(primaryVt) + '">'
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

      var makeKeys = Object.keys(byMake).sort();
      h += '<div class="section-header">Makes</div>';
      h += renderTypeFilters(mfrUnits, '_typeCardFilter');
      for (var mi = 0; mi < makeKeys.length; mi++) {
        var make = makeKeys[mi];
        var mu = byMake[make];
        // Count models and get primary type
        var models = {};
        var vtInMake = {};
        for (var i = 0; i < mu.length; i++) {
          models[mu[i].model || ""] = true;
          var uvt = (mu[i].veh_type || "Other").toUpperCase();
          vtInMake[uvt] = (vtInMake[uvt] || 0) + 1;
        }
        var makeVtKeys = Object.keys(vtInMake).sort(function(a,b) { return vtInMake[b] - vtInMake[a]; });
        var makePrimaryVt = makeVtKeys[0] || "";
        h += '<div class="card card-interactive" data-action="model-units" data-make="' + esc(make) + '" data-manufacturer="' + esc(manufacturer) + '" data-vt="' + esc(makePrimaryVt) + '">'
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
      // Exclude terminal statuses
      var shopUnits = units.filter(function (u) {
        var st = (u.status || "").toUpperCase();
        for (var t = 0; t < TERMINAL_STATUSES.length; t++) {
          if (st === TERMINAL_STATUSES[t]) return false;
        }
        return true;
      });

      var byType = {};
      for (var i = 0; i < shopUnits.length; i++) {
        var t = shopUnits[i].veh_type || "Other";
        if (!byType[t]) byType[t] = [];
        byType[t].push(shopUnits[i]);
      }

      var h = '<div class="view">';
      h += '<div class="section-header" style="margin-top:0;">Shop by Layout</div>';
      h += '<div style="font-size:18px;color:var(--text-3);margin-bottom:16px;">Browse inventory by type and floor layout</div>';

      var types = Object.keys(byType).sort(function (a, b) { return byType[b].length - byType[a].length; });
      for (var ti = 0; ti < types.length; ti++) {
        var t = types[ti];
        var tu = byType[t];
        var layoutSet = {};
        for (var i = 0; i < tu.length; i++) layoutSet[tu[i].floor_layout || "Unknown"] = true;
        h += '<div class="card card-interactive" data-action="shop-body" data-type="' + esc(t) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<div><div style="font-size:22px;font-weight:700;">' + esc(t) + '</div>'
          + '<div style="font-size:18px;color:var(--text-3);">' + Object.keys(layoutSet).length + ' floor layout' + (Object.keys(layoutSet).length > 1 ? 's' : '') + '</div></div>'
          + '<span class="stat-val text-purple" style="font-size:32px;">' + tu.length + '</span>'
          + '</div></div>';
      }

      h += '</div>';
      return h;
    });
  }

  // Type → Floor Layout list (was Body Style)
  function shopBodyView(vehType) {
    return DB.getAllUnits().then(function (units) {
      var filtered = units.filter(function (u) {
        if (u.veh_type !== vehType) return false;
        var st = (u.status || "").toUpperCase();
        for (var t = 0; t < TERMINAL_STATUSES.length; t++) {
          if (st === TERMINAL_STATUSES[t]) return false;
        }
        return true;
      });

      var h = '<div class="view">';
      h += backBtn("shop", "Shop");
      h += '<div class="zone-banner" style="background:linear-gradient(135deg, var(--purple-dim), var(--surface-2));">'
        + '<div class="zone-banner-name" style="color:var(--purple);">' + esc(vehType) + '</div>'
        + '<div class="zone-banner-count">' + filtered.length + '</div></div>';

      // Group by floor layout
      var byFL = {};
      for (var i = 0; i < filtered.length; i++) {
        var fl = filtered[i].floor_layout || "Unknown";
        if (!byFL[fl]) byFL[fl] = [];
        byFL[fl].push(filtered[i]);
      }
      var flKeys = Object.keys(byFL).sort(function (a, b) { return byFL[b].length - byFL[a].length; });

      h += '<div class="section-header">Floor Layouts</div>';
      for (var fi = 0; fi < flKeys.length; fi++) {
        var fl = flKeys[fi];
        var fu = byFL[fl];
        h += '<div class="card card-interactive" data-action="shop-layout" data-type="' + esc(vehType) + '" data-body="' + esc(fl) + '">'
          + '<div style="display:flex;justify-content:space-between;align-items:center;">'
          + '<div><div style="font-size:20px;font-weight:700;">' + esc(fl) + '</div>'
          + '<div style="font-size:18px;color:var(--text-3);">' + fu.length + ' unit' + (fu.length > 1 ? 's' : '') + '</div></div>'
          + '<span class="stat-val text-purple" style="font-size:28px;">' + fu.length + '</span>'
          + '</div></div>';
      }

      h += '</div>';
      return h;
    });
  }

  // Floor Layout → units grouped by sub_floorplan, with status on tiles
  function shopLayoutView(vehType, floorLayout) {
    return DB.getAllUnits().then(function (units) {
      var filtered = units.filter(function (u) {
        if (u.veh_type !== vehType || (u.floor_layout || "Unknown") !== floorLayout) return false;
        var st = (u.status || "").toUpperCase();
        for (var t = 0; t < TERMINAL_STATUSES.length; t++) {
          if (st === TERMINAL_STATUSES[t]) return false;
        }
        return true;
      });

      var h = '<div class="view">';
      h += backBtn("shop-body/" + encodeURIComponent(vehType), vehType);
      h += '<div class="zone-banner" style="background:linear-gradient(135deg, var(--purple-dim), var(--surface-2));">'
        + '<div class="zone-banner-name" style="color:var(--purple);">' + esc(floorLayout) + '</div>'
        + '<div class="zone-banner-desc">' + esc(vehType) + '</div>'
        + '<div class="zone-banner-count">' + filtered.length + '</div></div>';

      // Group by sub_floorplan, then sort units by make → price within each group
      var bySub = {};
      for (var i = 0; i < filtered.length; i++) {
        var sf = filtered[i].sub_floorplan || "(No Sub Layout)";
        if (!bySub[sf]) bySub[sf] = [];
        bySub[sf].push(filtered[i]);
      }
      // Sort groups: named groups alphabetically, "(No Sub Layout)" last
      var subKeys = Object.keys(bySub).sort(function (a, b) {
        if (a === "(No Sub Layout)") return 1;
        if (b === "(No Sub Layout)") return -1;
        return a < b ? -1 : a > b ? 1 : 0;
      });

      for (var si = 0; si < subKeys.length; si++) {
        var sub = subKeys[si];
        var su = bySub[sub];
        su.sort(function (a, b) {
          var cmp = (a.make || "").localeCompare(b.make || "");
          return cmp !== 0 ? cmp : priceNum(a.retail_price) - priceNum(b.retail_price);
        });

        h += '<div class="card"><div class="card-title">' + esc(sub) + ' (' + su.length + ')</div>';
        for (var j = 0; j < su.length; j++) {
          var u = su[j];
          var cat = statusCat(u.status);
          var catColor = statusCatColor(cat);
          h += '<div class="result-card" style="margin-bottom:8px;padding:14px 16px;" data-action="detail" data-stock="' + esc(u.stock_num) + '">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;">'
            + '<span style="font-size:20px;font-weight:700;">' + esc(u.year) + ' ' + esc(u.make) + ' ' + esc(u.model) + '</span>'
            + (fmtPrice(u.retail_price) ? '<span style="font-size:18px;font-weight:700;color:var(--green);">' + fmtPrice(u.retail_price) + '</span>' : '')
            + '</div>'
            + '<div style="font-size:18px;color:var(--text-2);margin-top:4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">'
            + '<span>Stk# ' + esc(u.stock_num) + '</span><span class="sep">&middot;</span>'
            + '<span class="status-badge status-' + catColor + '" style="font-size:12px;">' + esc(u.status) + '</span>'
            + '<span class="sep">&middot;</span>'
            + '<span>' + esc(u.lot_location || "No Lot") + '</span>'
            + '</div></div>';
        }
        h += '</div>';
      }

      if (filtered.length === 0) {
        h += '<div class="empty-state"><div class="empty-icon">&#128722;</div>'
          + '<div class="empty-title">None Available</div>'
          + '<div class="empty-desc">No active units with this layout</div></div>';
      }
      h += '</div>';
      return h;
    });
  }


  // ══════════════════════════════════════════════════════════════
  // COVERAGE TAB — Landing page for coverage tools
  // ══════════════════════════════════════════════════════════════
  function coverageTabView() {
    return DB.getAllUnits().then(function (units) {
      var cov = buildCoverageData(units);
      var totalModels = Object.keys(cov.modelData).length;
      var gapCount = 0;
      var keys = Object.keys(cov.modelData);
      for (var i = 0; i < keys.length; i++) {
        var md = cov.modelData[keys[i]];
        if (md.showroom === 0 || md.display === 0) gapCount++;
      }

      var h = '<div class="view">';

      h += '<div class="stats-row">'
        + '<div class="stat-pill"><div class="stat-val text-blue">' + totalModels + '</div><div class="stat-label">Models</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-orange">' + gapCount + '</div><div class="stat-label">Gaps</div></div>'
        + '</div>';

      h += '<div class="section-header">Coverage Tools</div>';

      // Count overflow-only units
      var mmInShr = {}, mmInDsp = {}, ovrUnits = [];
      var active = [];
      for (var i = 0; i < units.length; i++) {
        var st = (units[i].status || "").toUpperCase();
        var isT = false;
        for (var t = 0; t < TERMINAL_STATUSES.length; t++) { if (st === TERMINAL_STATUSES[t]) { isT = true; break; } }
        if (!isT) active.push(units[i]);
      }
      for (var i = 0; i < active.length; i++) {
        var u = active[i];
        var mk = (u.make || "") + "|" + (u.model || "");
        var b = lotBucket(u.lot_location || "");
        if (b === "SHOWROOM") mmInShr[mk] = true;
        else if (b !== "OVERFLOW" && b !== "OTHER") mmInDsp[mk] = true;
        else if (b === "OVERFLOW") ovrUnits.push(u);
      }
      var ovrOnly = 0;
      for (var i = 0; i < ovrUnits.length; i++) {
        var mk = (ovrUnits[i].make || "") + "|" + (ovrUnits[i].model || "");
        if (!mmInShr[mk] && !mmInDsp[mk]) ovrOnly++;
      }

      h += '<a class="note-type-card" href="#coverage-matrix">'
        + '<div class="note-type-icon" style="background:var(--blue-dim);color:var(--blue);">&#128200;</div>'
        + '<div><div class="note-type-label">Coverage Matrix</div>'
        + '<div class="note-type-desc">Model placement gaps — what needs displayed</div></div></a>';

      h += '<a class="note-type-card" href="#zone-map">'
        + '<div class="note-type-icon" style="background:var(--green-dim);color:var(--green);">&#128506;</div>'
        + '<div><div class="note-type-label">Zone Map</div>'
        + '<div class="note-type-desc">Per-zone model grid — what needs reorganized</div></div></a>';

      h += '<a class="note-type-card" href="#overflow-only">'
        + '<div class="note-type-icon" style="background:var(--orange-dim);color:var(--orange);">&#128230;</div>'
        + '<div><div class="note-type-label">Overflow Only</div>'
        + '<div class="note-type-desc">Units in overflow with no showroom or display presence'
        + (ovrOnly > 0 ? ' <span style="color:var(--orange);font-weight:700;">(' + ovrOnly + ')</span>' : '')
        + '</div></div></a>';

      // Replacement Log tile — show active count
      return DB.getActiveReplacements().then(function (activeRepls) {
        h += '<a class="note-type-card" href="#repl-log">'
          + '<div class="note-type-icon" style="background:#451a03;color:var(--orange);">&#128260;</div>'
          + '<div><div class="note-type-label">Replacement Log</div>'
          + '<div class="note-type-desc">Track replacement picks — complete or cancel'
          + (activeRepls.length > 0 ? ' <span style="color:var(--orange);font-weight:700;">(' + activeRepls.length + ' active)</span>' : '')
          + '</div></div></a>';

        h += '</div>';
        return h;
      });
    });
  }


  // ══════════════════════════════════════════════════════════════
  // COVERAGE MATRIX — Model placement analysis with two modes
  // ══════════════════════════════════════════════════════════════

  // Classify lot_location into a bucket
  var SHR_PREFIXES = ["CLE-SHR"];
  var DISP_ZONES = ["CLE-DISP01","CLE-DISP02","CLE-DISP03","CLE-DISP04","CLE-DISP05",
                     "CLE-DISP06","CLE-DISP07","CLE-DISP08","CLE-DISP10","CLE-DISP11"];
  var DISP_LABELS = ["DISP01","DISP02","DISP03","DISP04","DISP05","DISP06","DISP07","DISP08","DISP10","DISP11"];
  var TRANSIT_STATUSES = ["SHIPPED","DISPATCHED","TRANSFER","STORE-TO-STORE TRANSFER","DRIVER NEEDED","IN TRANSIT",
                          "ORDERED","PO ISSUED","RETAIL ORDERED"];

  function lotBucket(lot) {
    if (!lot) return "OTHER";
    var lc = lot.toUpperCase().trim();
    // Normalize DSP → DISP
    if (lc.indexOf("CLE-DSP") === 0 && lc.indexOf("CLE-DISP") !== 0) {
      lc = lc.replace("CLE-DSP", "CLE-DISP");
    }
    // Showroom
    for (var si = 0; si < SHR_PREFIXES.length; si++) {
      if (lc.indexOf(SHR_PREFIXES[si]) === 0) return "SHOWROOM";
    }
    // Individual display zones
    for (var di = 0; di < DISP_ZONES.length; di++) {
      if (lc.indexOf(DISP_ZONES[di]) === 0) return DISP_ZONES[di];
    }
    // Overflow
    if (lc.indexOf("CLE-OVR") === 0) return "OVERFLOW";
    return "OTHER";
  }

  // Shared: build coverage model data from units
  function buildCoverageData(units) {
    var TYPE_ORDER = { "TT": 0, "FW": 1, "TH": 2, "MH": 3, "FD": 4 };
    var active = [];
    for (var i = 0; i < units.length; i++) {
      var st = (units[i].status || "").toUpperCase();
      var isTerminal = false;
      for (var t = 0; t < TERMINAL_STATUSES.length; t++) {
        if (st === TERMINAL_STATUSES[t]) { isTerminal = true; break; }
      }
      if (!isTerminal) active.push(units[i]);
    }

    var modelData = {};
    var makeGroups = {};

    for (var i = 0; i < active.length; i++) {
      var u = active[i];
      var vt = (u.veh_type || "").toUpperCase();
      var make = u.make || "UNKNOWN";
      var model = u.model || "(No Model)";
      var st = (u.status || "").toUpperCase();
      if (!vt || !make) continue;

      var key = vt + "|" + make + "|" + model;
      if (!modelData[key]) {
        modelData[key] = {
          vt: vt, make: make, model: model,
          total: 0, showroom: 0, display: 0, overflow: 0, incoming: 0, other: 0,
          zones: {}
        };
      }
      var md = modelData[key];
      md.total++;

      var isIncoming = false;
      for (var ti = 0; ti < TRANSIT_STATUSES.length; ti++) {
        if (st === TRANSIT_STATUSES[ti]) { isIncoming = true; break; }
      }
      if (isIncoming) {
        md.incoming++;
      } else {
        var bucket = lotBucket(u.lot_location || "");
        if (bucket === "SHOWROOM") md.showroom++;
        else if (bucket === "OVERFLOW") md.overflow++;
        else if (bucket === "OTHER") md.other++;
        else { md.display++; md.zones[bucket] = (md.zones[bucket] || 0) + 1; }
      }

      var mgKey = vt + "|" + make;
      if (!makeGroups[mgKey]) makeGroups[mgKey] = [];
      if (makeGroups[mgKey].indexOf(key) === -1) makeGroups[mgKey].push(key);
    }

    var sortedMakeKeys = Object.keys(makeGroups).sort(function (a, b) {
      var pa = a.split("|"), pb = b.split("|");
      var ta = TYPE_ORDER[pa[0]] !== undefined ? TYPE_ORDER[pa[0]] : 9;
      var tb = TYPE_ORDER[pb[0]] !== undefined ? TYPE_ORDER[pb[0]] : 9;
      if (ta !== tb) return ta - tb;
      return pa[1] < pb[1] ? -1 : pa[1] > pb[1] ? 1 : 0;
    });
    for (var mk in makeGroups) {
      makeGroups[mk].sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
    }

    return { modelData: modelData, makeGroups: makeGroups, sortedMakeKeys: sortedMakeKeys };
  }

  // ── COVERAGE MATRIX ──
  // Shows all models with # in Showroom, Display, Overflow, Incoming, Other + gap flags
  function coverageView() {
    return DB.getAllUnits().then(function (units) {
      var cov = buildCoverageData(units);
      var modelData = cov.modelData, makeGroups = cov.makeGroups, sortedMakeKeys = cov.sortedMakeKeys;

      // Collect unique veh types
      var vtSet = {};
      for (var gi = 0; gi < sortedMakeKeys.length; gi++) {
        var vt = sortedMakeKeys[gi].split("|")[0];
        vtSet[vt] = (vtSet[vt] || 0) + 1;
      }
      var VT_ORDER = ["TT", "FW", "TH", "MH"];
      var vtList = VT_ORDER.filter(function(v) { return vtSet[v]; });

      var h = '<div class="view">';
      h += backBtn("coverage", "Coverage");
      h += '<div class="section-header" style="margin-top:0;">Coverage Matrix</div>'
        + '<div style="font-size:18px;color:var(--text-3);margin-bottom:8px;">Which models are on display vs. sitting in overflow or missing entirely</div>';

      // Type filter buttons
      h += '<div class="cov-type-filters" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
      h += '<button class="cov-type-btn cov-type-active" data-vt="ALL" onclick="window._covFilter(this,\'ALL\')">ALL</button>';
      for (var vi = 0; vi < vtList.length; vi++) {
        h += '<button class="cov-type-btn" data-vt="' + vtList[vi] + '" onclick="window._covFilter(this,\'' + vtList[vi] + '\')">' + vtList[vi] + '</button>';
      }
      h += '</div>';

      h += '<div class="cov-table-wrap"><table class="cov-table">';
      h += '<thead><tr><th class="cov-th-sticky">Model</th>'
        + '<th>Tot</th><th>SHR</th><th>DSP</th><th>OVR</th><th>INC</th><th>OTH</th><th>Gap</th>'
        + '</tr></thead><tbody>';

      for (var gi = 0; gi < sortedMakeKeys.length; gi++) {
        var mgKey = sortedMakeKeys[gi];
        var parts = mgKey.split("|");
        var gVt = parts[0], gMake = parts[1];
        var gKeys = makeGroups[mgKey];
        var gTotal = 0;
        for (var ki = 0; ki < gKeys.length; ki++) gTotal += modelData[gKeys[ki]].total;

        h += '<tr class="cov-make-row" data-vt="' + esc(gVt) + '"><td colspan="8" class="cov-th-sticky">'
          + '<span class="cov-vt-badge">' + esc(gVt) + '</span> '
          + esc(gMake) + ' <span class="cov-make-count">(' + gTotal + ')</span></td></tr>';

        for (var ki = 0; ki < gKeys.length; ki++) {
          var md = modelData[gKeys[ki]];
          var missing = [];
          if (md.showroom === 0) missing.push("SHR");
          if (md.display === 0) missing.push("DSP");
          var gapClass = "";
          if (md.showroom === 0 && md.display === 0) gapClass = " cov-gap-critical";
          else if (missing.length > 0) gapClass = " cov-gap-warn";

          h += '<tr class="cov-model-row' + gapClass + '" data-vt="' + esc(gVt) + '">'
            + '<td class="cov-th-sticky cov-model-name">' + esc(md.model) + '</td>'
            + '<td class="cov-num">' + md.total + '</td>'
            + '<td class="cov-num' + (md.showroom > 0 ? ' cov-has' : ' cov-empty') + '">' + (md.showroom || '') + '</td>'
            + '<td class="cov-num' + (md.display > 0 ? ' cov-has' : ' cov-empty') + '">' + (md.display || '') + '</td>'
            + '<td class="cov-num' + (md.overflow > 0 ? ' cov-ovr' : '') + '">' + (md.overflow || '') + '</td>'
            + '<td class="cov-num' + (md.incoming > 0 ? ' cov-inc' : '') + '">' + (md.incoming || '') + '</td>'
            + '<td class="cov-num">' + (md.other || '') + '</td>'
            + '<td class="cov-num' + (missing.length > 0 ? ' cov-gap-text' : '') + '">' + (missing.join(", ") || '') + '</td>'
            + '</tr>';
        }
      }
      h += '</tbody></table></div>';

      h += '<div class="cov-legend">'
        + '<span class="cov-legend-item"><span class="cov-legend-dot" style="background:var(--green);"></span>Stocked</span>'
        + '<span class="cov-legend-item"><span class="cov-legend-dot" style="background:var(--yellow);"></span>Empty</span>'
        + '<span class="cov-legend-item"><span class="cov-legend-dot" style="background:var(--orange);"></span>Gap (not displayed)</span>'
        + '<span class="cov-legend-item"><span class="cov-legend-dot" style="background:var(--red);"></span>Not on floor at all</span>'
        + '</div>';

      h += '</div>';
      return h;
    });
  }

  // ── ZONE MAP ──
  // Shows all models with per-zone columns: Showroom | DISP01-11 | Overflow | Other
  function zoneMapView() {
    return DB.getAllUnits().then(function (units) {
      var cov = buildCoverageData(units);
      var modelData = cov.modelData, makeGroups = cov.makeGroups, sortedMakeKeys = cov.sortedMakeKeys;

      // Collect unique veh types
      var vtSet2 = {};
      for (var gi = 0; gi < sortedMakeKeys.length; gi++) {
        var vt2 = sortedMakeKeys[gi].split("|")[0];
        vtSet2[vt2] = (vtSet2[vt2] || 0) + 1;
      }
      var VT_ORDER2 = ["TT", "FW", "TH", "MH"];
      var vtList2 = VT_ORDER2.filter(function(v) { return vtSet2[v]; });

      var h = '<div class="view">';
      h += backBtn("coverage", "Coverage");
      h += '<div class="section-header" style="margin-top:0;">Zone Map</div>'
        + '<div style="font-size:18px;color:var(--text-3);margin-bottom:8px;">Where each model sits across display zones — find what needs reorganized</div>';

      // Type filter buttons
      h += '<div class="cov-type-filters" style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">';
      h += '<button class="cov-type-btn cov-type-active" data-vt="ALL" onclick="window._covFilter(this,\'ALL\')">ALL</button>';
      for (var vi = 0; vi < vtList2.length; vi++) {
        h += '<button class="cov-type-btn" data-vt="' + vtList2[vi] + '" onclick="window._covFilter(this,\'' + vtList2[vi] + '\')">' + vtList2[vi] + '</button>';
      }
      h += '</div>';

      h += '<div class="cov-table-wrap"><table class="cov-table cov-table-zone">';
      h += '<thead><tr><th class="cov-th-sticky">Model</th>'
        + '<th>SHR</th>';
      for (var di = 0; di < DISP_LABELS.length; di++) {
        h += '<th>' + DISP_LABELS[di].replace("DISP", "D") + '</th>';
      }
      h += '<th>OVR</th><th>OTH</th>'
        + '</tr></thead><tbody>';

      for (var gi = 0; gi < sortedMakeKeys.length; gi++) {
        var mgKey = sortedMakeKeys[gi];
        var parts = mgKey.split("|");
        var gVt = parts[0], gMake = parts[1];
        var gKeys = makeGroups[mgKey];
        var gTotal = 0;
        for (var ki = 0; ki < gKeys.length; ki++) gTotal += modelData[gKeys[ki]].total;

        var nCols = 3 + DISP_LABELS.length;
        h += '<tr class="cov-make-row" data-vt="' + esc(gVt) + '"><td colspan="' + nCols + '" class="cov-th-sticky">'
          + '<span class="cov-vt-badge">' + esc(gVt) + '</span> '
          + esc(gMake) + ' <span class="cov-make-count">(' + gTotal + ')</span></td></tr>';

        for (var ki = 0; ki < gKeys.length; ki++) {
          var md = modelData[gKeys[ki]];
          var onFloor = md.showroom + md.display;
          var rowClass = onFloor === 0 && md.total > 0 ? " cov-gap-critical" : "";

          h += '<tr class="cov-model-row' + rowClass + '" data-vt="' + esc(gVt) + '">'
            + '<td class="cov-th-sticky cov-model-name">' + esc(md.model) + '</td>'
            + '<td class="cov-num' + (md.showroom > 0 ? ' cov-has' : '') + '">' + (md.showroom || '') + '</td>';

          for (var di = 0; di < DISP_ZONES.length; di++) {
            var zoneCount = md.zones[DISP_ZONES[di]] || 0;
            h += '<td class="cov-num' + (zoneCount > 0 ? ' cov-has' : '') + '">' + (zoneCount || '') + '</td>';
          }

          h += '<td class="cov-num' + (md.overflow > 0 ? ' cov-ovr' : '') + '">' + (md.overflow || '') + '</td>'
            + '<td class="cov-num">' + ((md.other + md.incoming) || '') + '</td>'
            + '</tr>';
        }
      }
      h += '</tbody></table></div>';

      h += '<div class="cov-legend">'
        + '<span class="cov-legend-item"><span class="cov-legend-dot" style="background:var(--green);"></span>On display</span>'
        + '<span class="cov-legend-item"><span class="cov-legend-dot" style="background:var(--orange);"></span>Overflow only</span>'
        + '<span class="cov-legend-item"><span class="cov-legend-dot" style="background:var(--red);"></span>Not on floor</span>'
        + '</div>';

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

    h += '<label class="form-label">Reason for Move</label>'
      + '<select class="form-select" name="reason" required>'
      + '<option value="">Select reason...</option>'
      + '<optgroup label="Grouping">'
      + '<option value="Brand Grouping">Same brand not grouped together</option>'
      + '<option value="Type Grouping">Wrong type in this zone (TT in FW area, etc.)</option>'
      + '<option value="Price Grouping">Similar price points should be together</option>'
      + '<option value="Layout Grouping">Similar floor layouts should be together</option>'
      + '</optgroup>'
      + '<optgroup label="Display Management">'
      + '<option value="Duplicate">Duplicate model on display — free the spot</option>'
      + '<option value="Fill Gap">Fill an empty display spot</option>'
      + '<option value="Backfill SP">Backfill a sale pending unit</option>'
      + '<option value="Move to Overflow">Send to overflow — not display-worthy</option>'
      + '</optgroup>'
      + '<optgroup label="Other">'
      + '<option value="Visibility">Needs more/less prominent placement</option>'
      + '<option value="Customer Request">Customer walkthrough / show prep</option>'
      + '<option value="Other">Other (describe below)</option>'
      + '</optgroup>'
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
  // ── AUDIT TAB LANDING — two tiles: Status & Location, Product Hierarchy
  function auditTabView() {
    return DB.getAllUnits().then(function (units) {
      var flags = computeAuditFlags(units);
      var critical = flags.filter(function (f) { return f.severity === "CRITICAL"; }).length;
      var warning = flags.filter(function (f) { return f.severity === "WARNING"; }).length;
      var totalFlags = flags.length;

      // Product hierarchy count
      var active = [];
      for (var i = 0; i < units.length; i++) {
        var st = (units[i].status || "").toUpperCase();
        var isT = false;
        for (var t = 0; t < TERMINAL_STATUSES.length; t++) { if (st === TERMINAL_STATUSES[t]) { isT = true; break; } }
        if (!isT) active.push(units[i]);
      }
      // Filter to new inventory only for hierarchy count
      var newActive = [];
      for (var i = 0; i < active.length; i++) {
        if ((active[i].condition || "").toUpperCase() !== "USED") newActive.push(active[i]);
      }
      var hierCount = 0;
      for (var i = 0; i < newActive.length; i++) {
        var u = newActive[i];
        if (!u.veh_type || !u.body_style || !u.manufacturer || !u.make || !u.model) hierCount++;
      }
      // Also count consistency issues (Make→Mfr, Make→VehType conflicts)
      var _makeToMfr = {}, _makeToVt = {};
      for (var i = 0; i < newActive.length; i++) {
        var u = newActive[i];
        var mk = (u.make || "").toUpperCase(), mfr = (u.manufacturer || "").toUpperCase(), vt = (u.veh_type || "").toUpperCase();
        if (mk && mfr) { if (!_makeToMfr[mk]) _makeToMfr[mk] = {}; if (!_makeToMfr[mk][mfr]) _makeToMfr[mk][mfr] = []; _makeToMfr[mk][mfr].push(u.stock_num); }
        if (mk && vt) { if (!_makeToVt[mk]) _makeToVt[mk] = {}; if (!_makeToVt[mk][vt]) _makeToVt[mk][vt] = []; _makeToVt[mk][vt].push(u.stock_num); }
      }
      var _consistStocks = {};
      function _countMinority(valMap) {
        var vals = Object.keys(valMap); if (vals.length <= 1) return;
        var majV = vals[0], majC = valMap[vals[0]].length;
        for (var v = 1; v < vals.length; v++) { if (valMap[vals[v]].length > majC) { majV = vals[v]; majC = valMap[vals[v]].length; } }
        for (var v = 0; v < vals.length; v++) { if (vals[v] !== majV) { var s = valMap[vals[v]]; for (var j = 0; j < s.length; j++) _consistStocks[s[j]] = true; } }
      }
      var _mk1 = Object.keys(_makeToMfr); for (var m = 0; m < _mk1.length; m++) _countMinority(_makeToMfr[_mk1[m]]);
      var _mk2 = Object.keys(_makeToVt); for (var m = 0; m < _mk2.length; m++) _countMinority(_makeToVt[_mk2[m]]);
      hierCount += Object.keys(_consistStocks).length;

      var h = '<div class="view">';

      h += '<div class="stats-row">'
        + '<div class="stat-pill"><div class="stat-val text-red">' + critical + '</div><div class="stat-label">Critical</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-orange">' + warning + '</div><div class="stat-label">Warning</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-blue">' + totalFlags + '</div><div class="stat-label">Total Flags</div></div>'
        + '</div>';

      h += '<div class="section-header">Audit Tools</div>';

      h += '<a class="note-type-card" href="#audit-status">'
        + '<div class="note-type-icon" style="background:var(--red-dim);color:var(--red);">&#128680;</div>'
        + '<div><div class="note-type-label">Status &amp; Location</div>'
        + '<div class="note-type-desc">Dead units on display, stale statuses, missing lot codes'
        + (critical > 0 ? ' <span style="color:var(--red);font-weight:700;">(' + critical + ' critical)</span>' : '')
        + '</div></div></a>';

      h += '<a class="note-type-card" href="#hierarchy">'
        + '<div class="note-type-icon" style="background:var(--purple-dim);color:var(--purple);">&#128736;</div>'
        + '<div><div class="note-type-label">Product Hierarchy</div>'
        + '<div class="note-type-desc">Missing or inconsistent product data'
        + (hierCount > 0 ? ' <span style="color:var(--purple);font-weight:700;">(' + hierCount + ')</span>' : '')
        + '</div></div></a>';

      h += '</div>';
      return h;
    });
  }

  // ── STATUS & LOCATION AUDIT — the original detailed audit list
  function auditStatusView() {
    return DB.getAllUnits().then(function (units) {
      var flags = computeAuditFlags(units);

      var h = '<div class="view">';
      h += backBtn("audit", "Audit");

      var critical = flags.filter(function (f) { return f.severity === "CRITICAL"; }).length;
      var warning = flags.filter(function (f) { return f.severity === "WARNING"; }).length;
      var info = flags.filter(function (f) { return f.severity === "INFO"; }).length;

      h += '<div class="section-header" style="margin-top:0;">Status &amp; Location Audit</div>'
        + '<div style="font-size:18px;color:var(--text-3);margin-bottom:12px;">Dead units on display, stale statuses, missing lot codes</div>';

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
  // OVERFLOW ONLY VIEW — Units in overflow with no SHR/DSP presence
  // ══════════════════════════════════════════════════════════════
  function overflowOnlyView() {
    return DB.getAllUnits().then(function (units) {
      var active = [];
      for (var i = 0; i < units.length; i++) {
        var st = (units[i].status || "").toUpperCase();
        var isT = false;
        for (var t = 0; t < TERMINAL_STATUSES.length; t++) { if (st === TERMINAL_STATUSES[t]) { isT = true; break; } }
        if (!isT) active.push(units[i]);
      }

      // Build sets of make|model that have showroom/display presence
      var mmInShr = {}, mmInDsp = {}, ovrUnits = [];
      for (var i = 0; i < active.length; i++) {
        var u = active[i];
        var mk = (u.make || "") + "|" + (u.model || "");
        var b = lotBucket(u.lot_location || "");
        if (b === "SHOWROOM") mmInShr[mk] = true;
        else if (b !== "OVERFLOW" && b !== "OTHER") mmInDsp[mk] = true;
        else if (b === "OVERFLOW") ovrUnits.push(u);
      }

      // Filter to only overflow units whose model has NO showroom/display
      var filtered = [];
      for (var i = 0; i < ovrUnits.length; i++) {
        var mk = (ovrUnits[i].make || "") + "|" + (ovrUnits[i].model || "");
        if (!mmInShr[mk] && !mmInDsp[mk]) filtered.push(ovrUnits[i]);
      }

      // Sort by make → model → age desc
      filtered.sort(function (a, b) {
        var cmp = (a.make || "").localeCompare(b.make || "");
        if (cmp !== 0) return cmp;
        cmp = (a.model || "").localeCompare(b.model || "");
        if (cmp !== 0) return cmp;
        return (parseInt(b.age) || 0) - (parseInt(a.age) || 0);
      });

      var h = '<div class="view">';
      h += backBtn("coverage", "Coverage");
      h += '<div class="section-header" style="margin-top:0;">Overflow Only</div>'
        + '<div style="font-size:18px;color:var(--text-3);margin-bottom:12px;">Units in overflow with no showroom or display presence — candidates to move onto the floor</div>';

      h += '<div class="stats-row">'
        + '<div class="stat-pill"><div class="stat-val text-orange">' + filtered.length + '</div><div class="stat-label">Units</div></div>'
        + '</div>';

      // Group by make
      var byMake = {};
      for (var i = 0; i < filtered.length; i++) {
        var m = filtered[i].make || "UNKNOWN";
        if (!byMake[m]) byMake[m] = [];
        byMake[m].push(filtered[i]);
      }
      var makeKeys = Object.keys(byMake).sort();

      for (var mi = 0; mi < makeKeys.length; mi++) {
        var make = makeKeys[mi];
        var mu = byMake[make];
        h += '<div class="card"><div class="card-title">' + esc(make) + ' (' + mu.length + ')</div>';
        for (var j = 0; j < mu.length; j++) {
          var u = mu[j];
          h += '<div class="result-card" style="margin-bottom:8px;padding:12px 16px;border-left:3px solid var(--orange);" data-action="detail" data-stock="' + esc(u.stock_num) + '">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;">'
            + '<span style="font-size:20px;font-weight:700;">' + esc(u.model) + ' ' + esc(u.floor_layout || "") + '</span>'
            + (fmtPrice(u.retail_price) ? '<span style="font-size:18px;font-weight:700;color:var(--green);">' + fmtPrice(u.retail_price) + '</span>' : '')
            + '</div>'
            + '<div style="font-size:18px;color:var(--text-2);margin-top:4px;">'
            + 'Stk# ' + esc(u.stock_num) + ' &middot; ' + esc(u.lot_location || "") + ' &middot; ' + esc(u.age || "?") + ' days'
            + '</div></div>';
        }
        h += '</div>';
      }

      if (filtered.length === 0) {
        h += '<div class="empty-state"><div class="empty-icon">&#9989;</div>'
          + '<div class="empty-title">All Clear</div>'
          + '<div class="empty-desc">Every model in overflow has showroom or display representation</div></div>';
      }
      h += '</div>';
      return h;
    });
  }


  // ══════════════════════════════════════════════════════════════
  // PRODUCT HIERARCHY — Shared data builder
  // ══════════════════════════════════════════════════════════════
  function buildHierarchyData(units) {
    var active = [];
    for (var i = 0; i < units.length; i++) {
      var st = (units[i].status || "").toUpperCase();
      var cond = (units[i].condition || "").toUpperCase();
      // Skip terminal statuses and used inventory
      if (cond === "USED") continue;
      var isT = false;
      for (var t = 0; t < TERMINAL_STATUSES.length; t++) { if (st === TERMINAL_STATUSES[t]) { isT = true; break; } }
      if (!isT) active.push(units[i]);
    }

    // ── Missing Required Fields ──
    var missingByType = {};  // { "Missing Manufacturer": [unit, ...], ... }
    for (var i = 0; i < active.length; i++) {
      var u = active[i];
      var checks = [
        ["Missing Manufacturer", !u.manufacturer],
        ["Missing Make", !u.make],
        ["Missing Model", !u.model],
        ["Missing Vehicle Type", !u.veh_type],
        ["Missing Body Style", !u.body_style],
      ];
      for (var c = 0; c < checks.length; c++) {
        if (checks[c][1]) {
          var label = checks[c][0];
          if (!missingByType[label]) missingByType[label] = [];
          missingByType[label].push(u);
        }
      }
    }

    // ── Consistency Checks ──
    var makeToMfr = {}, makeToVt = {};
    for (var i = 0; i < active.length; i++) {
      var u = active[i];
      var mk = (u.make || "").toUpperCase();
      var mfr = (u.manufacturer || "").toUpperCase();
      var vt = (u.veh_type || "").toUpperCase();
      if (mk && mfr) {
        if (!makeToMfr[mk]) makeToMfr[mk] = {};
        if (!makeToMfr[mk][mfr]) makeToMfr[mk][mfr] = [];
        makeToMfr[mk][mfr].push(u);
      }
      if (mk && vt) {
        if (!makeToVt[mk]) makeToVt[mk] = {};
        if (!makeToVt[mk][vt]) makeToVt[mk][vt] = [];
        makeToVt[mk][vt].push(u);
      }
    }

    // Group consistency issues by check type: { "WILDWOOD FSX: expected TT, got TH": [unit, ...] }
    var consistByType = {};
    function findMinority(valMap, checkName, fieldLabel) {
      var vals = Object.keys(valMap);
      if (vals.length <= 1) return;
      var majorityVal = vals[0], majorityCount = valMap[vals[0]].length;
      for (var v = 1; v < vals.length; v++) {
        if (valMap[vals[v]].length > majorityCount) { majorityVal = vals[v]; majorityCount = valMap[vals[v]].length; }
      }
      for (var v = 0; v < vals.length; v++) {
        if (vals[v] !== majorityVal) {
          var label = checkName + ": " + fieldLabel + " \u2192 expected " + majorityVal + ", got " + vals[v];
          if (!consistByType[label]) consistByType[label] = [];
          var uList = valMap[vals[v]];
          for (var s = 0; s < uList.length; s++) consistByType[label].push(uList[s]);
        }
      }
    }

    var mfrKeys = Object.keys(makeToMfr);
    for (var m = 0; m < mfrKeys.length; m++) findMinority(makeToMfr[mfrKeys[m]], "Make \u2192 Manufacturer", mfrKeys[m]);
    var vtKeys = Object.keys(makeToVt);
    for (var m = 0; m < vtKeys.length; m++) findMinority(makeToVt[vtKeys[m]], "Make \u2192 Veh Type", vtKeys[m]);

    return { active: active, missingByType: missingByType, consistByType: consistByType };
  }

  // ── HIERARCHY LANDING — Tiles by issue type ──
  function hierarchyView() {
    return DB.getAllUnits().then(function (units) {
      var data = buildHierarchyData(units);

      var h = '<div class="view">';
      h += backBtn("audit", "Audit");
      h += '<div class="section-header" style="margin-top:0;">Product Hierarchy Audit</div>'
        + '<div style="font-size:18px;color:var(--text-3);margin-bottom:12px;">Missing required fields and inconsistent product relationships</div>';

      var totalMissing = 0;
      var mKeys = Object.keys(data.missingByType);
      for (var i = 0; i < mKeys.length; i++) totalMissing += data.missingByType[mKeys[i]].length;
      var totalConsist = 0;
      var cKeys = Object.keys(data.consistByType);
      for (var i = 0; i < cKeys.length; i++) totalConsist += data.consistByType[cKeys[i]].length;

      h += '<div class="stats-row">'
        + '<div class="stat-pill"><div class="stat-val text-orange">' + totalMissing + '</div><div class="stat-label">Missing Fields</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-purple">' + totalConsist + '</div><div class="stat-label">Inconsistent</div></div>'
        + '<div class="stat-pill"><div class="stat-val text-blue">' + data.active.length + '</div><div class="stat-label">Active Units</div></div>'
        + '</div>';

      // ── Missing Field Tiles ──
      if (mKeys.length > 0) {
        h += '<div class="section-header">Missing Required Fields</div>';
        for (var i = 0; i < mKeys.length; i++) {
          var label = mKeys[i];
          var count = data.missingByType[label].length;
          h += '<a class="note-type-card" href="#hierarchy-detail/' + encodeURIComponent(label) + '">'
            + '<div class="note-type-icon" style="background:var(--orange-dim);color:var(--orange);">&#9888;</div>'
            + '<div><div class="note-type-label">' + esc(label) + '</div>'
            + '<div class="note-type-desc"><span style="color:var(--orange);font-weight:700;">' + count + ' unit' + (count !== 1 ? 's' : '') + '</span></div>'
            + '</div></a>';
        }
      }

      // ── Consistency Issue Tiles ──
      if (cKeys.length > 0) {
        h += '<div class="section-header">Consistency Issues</div>';
        for (var i = 0; i < cKeys.length; i++) {
          var label = cKeys[i];
          var count = data.consistByType[label].length;
          h += '<a class="note-type-card" href="#hierarchy-detail/' + encodeURIComponent(label) + '">'
            + '<div class="note-type-icon" style="background:var(--red-dim);color:var(--red);">&#128295;</div>'
            + '<div><div class="note-type-label">' + esc(label) + '</div>'
            + '<div class="note-type-desc"><span style="color:var(--red);font-weight:700;">' + count + ' unit' + (count !== 1 ? 's' : '') + '</span></div>'
            + '</div></a>';
        }
      }

      if (mKeys.length === 0 && cKeys.length === 0) {
        h += '<div class="empty-state"><div class="empty-icon">&#9989;</div>'
          + '<div class="empty-title">All Clear</div>'
          + '<div class="empty-desc">All active units have complete and consistent product data</div></div>';
      }
      h += '</div>';
      return h;
    });
  }

  // ── HIERARCHY DETAIL — Unit list for a specific issue type ──
  function hierarchyDetailView(issueLabel) {
    return DB.getAllUnits().then(function (units) {
      var data = buildHierarchyData(units);
      var label = decodeURIComponent(issueLabel || "");
      var unitList = data.missingByType[label] || data.consistByType[label] || [];
      var isMissing = !!data.missingByType[label];

      // Sort by make → model → stock
      unitList.sort(function (a, b) {
        var cmp = (a.make || "").localeCompare(b.make || "");
        if (cmp !== 0) return cmp;
        cmp = (a.model || "").localeCompare(b.model || "");
        if (cmp !== 0) return cmp;
        return (a.stock_num || "").localeCompare(b.stock_num || "");
      });

      var h = '<div class="view">';
      h += backBtn("hierarchy", "Hierarchy");
      h += '<div class="section-header" style="margin-top:0;">' + esc(label) + '</div>'
        + '<div style="font-size:18px;color:var(--text-3);margin-bottom:12px;">'
        + unitList.length + ' unit' + (unitList.length !== 1 ? 's' : '') + ' affected</div>';

      var badgeClass = isMissing ? "flag-warning" : "flag-critical";

      // Group by make
      var byMake = {};
      for (var i = 0; i < unitList.length; i++) {
        var m = unitList[i].make || "UNKNOWN";
        if (!byMake[m]) byMake[m] = [];
        byMake[m].push(unitList[i]);
      }
      var makeKeys = Object.keys(byMake).sort();

      for (var mi = 0; mi < makeKeys.length; mi++) {
        var make = makeKeys[mi];
        var mu = byMake[make];
        h += '<div class="card"><div class="card-title">' + esc(make) + ' (' + mu.length + ')</div>';
        for (var j = 0; j < mu.length; j++) {
          var u = mu[j];
          h += '<div class="result-card" style="margin-bottom:8px;padding:12px 16px;border-left:3px solid var(--' + (isMissing ? 'orange' : 'red') + ');" data-action="detail" data-stock="' + esc(u.stock_num) + '">'
            + '<div style="display:flex;justify-content:space-between;align-items:center;">'
            + '<span style="font-size:20px;font-weight:700;">' + esc(u.model || "?") + ' ' + esc(u.floor_layout || "") + '</span>'
            + '<span style="font-size:18px;color:var(--text-2);">' + esc(u.year || "?") + '</span>'
            + '</div>'
            + '<div style="font-size:18px;color:var(--text-2);margin-top:4px;">'
            + 'Stk# ' + esc(u.stock_num) + ' &middot; ' + esc(u.status || "?") + ' &middot; ' + esc(u.lot_location || "N/A")
            + '</div></div>';
        }
        h += '</div>';
      }

      h += '</div>';
      return h;
    });
  }


  // ══════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════
  // SALES TAB
  // ══════════════════════════════════════════════════════════════════

  function _getSalePendingToday(units) {
    // Strictly status_days=0 — units that entered SP today
    var results = [];
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var st = (u.status || "").toUpperCase();
      var sd = u.status_days;
      if (st === "SALE PENDING" && (sd === 0 || sd === "0")) {
        results.push(u);
      }
    }
    return results;
  }

  function _dataDateStr() {
    // Use the exported_at timestamp as "today" instead of device clock
    // This avoids timezone mismatches between pipeline run time and phone time
    return DB.getMeta("exported_at").then(function (exp) {
      if (exp) {
        // exported_at format: "03/22/2026 08:27 AM" — extract date part
        var parts = exp.split(" ");
        if (parts.length >= 1) return parts[0]; // "03/22/2026"
      }
      return _todayStrLocal();
    });
  }

  function _todayStrLocal() {
    var d = new Date();
    var mm = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return mm + '/' + dd + '/' + d.getFullYear();
  }

  function _todayStr() {
    return _todayStrLocal();
  }

  function _normalizeDate(val) {
    // Handle various date formats: "MM/DD/YYYY", "YYYY-MM-DD", "M/D/YYYY"
    if (!val) return '';
    var s = String(val).trim();
    // ISO format: 2026-03-21
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      var parts = s.substring(0, 10).split('-');
      return parts[1] + '/' + parts[2] + '/' + parts[0];
    }
    // MM/DD/YYYY or M/D/YYYY
    if (s.indexOf('/') !== -1) {
      var parts = s.split('/');
      if (parts.length >= 3) {
        var mm = String(parseInt(parts[0], 10)).padStart(2, '0');
        var dd = String(parseInt(parts[1], 10)).padStart(2, '0');
        var yyyy = parts[2].length === 2 ? '20' + parts[2] : parts[2];
        return mm + '/' + dd + '/' + yyyy;
      }
    }
    return s;
  }

  function _fmtPrice(val) {
    if (!val) return "";
    var n = typeof val === "string" ? parseFloat(val.replace(/[$,]/g, "")) : val;
    if (isNaN(n)) return "";
    return "$" + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  var INCOMING_STATUSES = ["SHIPPED","DISPATCHED","TRANSFER","STORE-TO-STORE TRANSFER",
    "DRIVER NEEDED","IN TRANSIT","ORDERED","PO ISSUED","RETAIL ORDERED",
    "OPS TRANSFER","PURCHASED"];

  function _getIncomingUnits(units) {
    var results = [];
    for (var i = 0; i < units.length; i++) {
      var st = (units[i].status || "").toUpperCase();
      for (var j = 0; j < INCOMING_STATUSES.length; j++) {
        if (st === INCOMING_STATUSES[j]) { results.push(units[i]); break; }
      }
    }
    return results;
  }

  function activityView() {
    return Promise.all([
      DB.getAllUnits(),
      DB.getMeta("retail_sold_today"),
      DB.getMeta("exported_at")
    ]).then(function (results) {
      var units = results[0];
      var retailSold = results[1] || [];
      var exportedAt = results[2] || "";

      var spToday = _getSalePendingToday(units);
      var soldToday = retailSold;
      var incoming = _getIncomingUnits(units);

      // Sale pending in display/showroom — need to pull & replace
      var spInDisplay = [];
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if ((u.status || "").toUpperCase() === "SALE PENDING") {
          var area = (u.lot_area || "").toUpperCase();
          if (area === "DISPLAY" || area === "SHOWROOM") spInDisplay.push(u);
        }
      }

      // Retail ordered today — uses order_date field
      var roToday = [];
      var todayStr = _todayStr();
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        if (u.order_date && _normalizeDate(u.order_date) === todayStr) {
          roToday.push(u);
        }
      }

      var h = '<div class="section-title">INVENTORY ACTIVITY</div>';
      h += '<p style="color:var(--text-3);font-size:13px;margin:0 0 16px;">Data as of ' + esc(exportedAt) + '</p>';

      // ── KPI pills ──
      h += '<div class="stats-row">';
      h += '<div class="stat-pill"><div class="stat-val" style="color:var(--orange);">' + spToday.length + '</div><div class="stat-label">PENDING</div></div>';
      h += '<div class="stat-pill"><div class="stat-val" style="color:var(--green);">' + soldToday.length + '</div><div class="stat-label">SOLD</div></div>';
      h += '<div class="stat-pill"><div class="stat-val" style="color:var(--blue);">' + incoming.length + '</div><div class="stat-label">INCOMING</div></div>';
      h += '</div>';

      // ── Section tiles ──
      h += '<div class="section-title" style="margin-top:16px;">OUTBOUND</div>';

      // Sale Pending tile
      h += '<a class="card card-interactive" href="#sales-section/pending/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">'
        + '<div><div style="font-size:18px;font-weight:600;">Sale Pending Today</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Units put into sale pending today</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:var(--orange);">' + spToday.length + '</span></a>';

      // Sale Pending in Display/Showroom — needs pulling
      h += '<a class="card card-interactive" href="#sales-section/pending-display/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;border-left:3px solid var(--orange);">'
        + '<div><div style="font-size:18px;font-weight:600;">Pending in Display</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Need to pull &amp; replace from overflow</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:var(--orange);">' + spInDisplay.length + '</span></a>';

      // Retail Ordered Today
      h += '<a class="card card-interactive" href="#sales-section/retail-ordered/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">'
        + '<div><div style="font-size:18px;font-weight:600;">Retail Ordered Today</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Customer orders placed today</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:#a855f7;">' + roToday.length + '</span></a>';

      // Retail Sold tile
      h += '<a class="card card-interactive" href="#sales-section/sold/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">'
        + '<div><div style="font-size:18px;font-weight:600;">Retail Sold Today</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Deals closed today</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:var(--green);">' + soldToday.length + '</span></a>';

      // ── Incoming section ──
      h += '<div class="section-title" style="margin-top:20px;">INBOUND</div>';

      // Incoming overview tile
      h += '<a class="card card-interactive" href="#incoming" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">'
        + '<div><div style="font-size:18px;font-weight:600;">Incoming Pipeline</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Ordered, shipped &amp; in transit</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:var(--blue);">' + incoming.length + '</span></a>';

      // Quick breakdown by pipeline stage
      var stageCounts = {};
      for (var i = 0; i < incoming.length; i++) {
        var st = (incoming[i].status || "").toUpperCase();
        stageCounts[st] = (stageCounts[st] || 0) + 1;
      }
      var STAGE_ORDER = ["ORDERED","PO ISSUED","RETAIL ORDERED","PURCHASED","SHIPPED","DISPATCHED","IN TRANSIT","DRIVER NEEDED","TRANSFER","STORE-TO-STORE TRANSFER","OPS TRANSFER"];
      var stageKeys = STAGE_ORDER.filter(function(s) { return stageCounts[s]; });

      if (stageKeys.length > 0) {
        h += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;">';
        for (var s = 0; s < stageKeys.length; s++) {
          var stageColor = stageKeys[s] === "SHIPPED" || stageKeys[s] === "DISPATCHED" ? "var(--green)" : "var(--blue)";
          h += '<div style="flex:1;min-width:45%;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);padding:12px;text-align:center;">'
            + '<div style="font-size:22px;font-weight:800;color:' + stageColor + ';">' + stageCounts[stageKeys[s]] + '</div>'
            + '<div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">' + esc(stageKeys[s]) + '</div></div>';
        }
        h += '</div>';
      }

      return h;
    });
  }

  function salesView() {
    // Backward compat redirect
    return activityView();
  }

  function _getSalesListBySection(section) {
    if (section === "pending") {
      return DB.getAllUnits().then(function (units) {
        return _getSalePendingToday(units);
      });
    } else if (section === "pending-display") {
      return DB.getAllUnits().then(function (units) {
        var results = [];
        for (var i = 0; i < units.length; i++) {
          var u = units[i];
          if ((u.status || "").toUpperCase() === "SALE PENDING") {
            var area = (u.lot_area || "").toUpperCase();
            if (area === "DISPLAY" || area === "SHOWROOM") results.push(u);
          }
        }
        return results;
      });
    } else if (section === "retail-ordered") {
      return DB.getAllUnits().then(function (units) {
        var results = [];
        var todayStr = _todayStr();
        for (var i = 0; i < units.length; i++) {
          var u = units[i];
          if (u.order_date && _normalizeDate(u.order_date) === todayStr) {
            results.push(u);
          }
        }
        return results;
      });
    } else {
      return DB.getMeta("retail_sold_today").then(function (sold) {
        return sold || [];
      });
    }
  }

  function salesSectionView(section, vehType) {
    return _getSalesListBySection(section).then(function (list) {
      var filtered;
      if (vehType === "ALL") {
        filtered = list;
      } else {
        filtered = [];
        for (var i = 0; i < list.length; i++) {
          if ((list[i].veh_type || "").toUpperCase() === vehType.toUpperCase()) filtered.push(list[i]);
        }
      }
      var labels = { "pending": "Sale Pending Today", "pending-display": "Pending in Display/Showroom", "retail-ordered": "Retail Ordered Today", "sold": "Retail Sold Today" };
      var label = labels[section] || section;
      var suffix = vehType === "ALL" ? "" : " — " + vehType;
      return _renderSalesUnitList(filtered, label + suffix, section);
    });
  }

  function salesMakeView(section, make) {
    return _getSalesListBySection(section).then(function (list) {
      var filtered = [];
      for (var i = 0; i < list.length; i++) {
        if ((list[i].make || "") === make) filtered.push(list[i]);
      }
      var label = section === "pending" ? "Sale Pending" : "Retail Sold";
      return _renderSalesUnitList(filtered, label + " — " + make, section);
    });
  }

  function salesUnitsView(section, stockNum) {
    // Show detail for a specific unit from the sales list
    if (section === "pending") {
      return DB.getUnit(stockNum).then(function (u) {
        if (!u) return '<div class="empty-state">Unit not found</div>';
        return DB.getAllUnits().then(function (all) { return renderUnitDetail(u, all); });
      });
    } else {
      // Sold unit — may not be in active inventory, render from retail_sold_today
      return DB.getMeta("retail_sold_today").then(function (sold) {
        var unit = null;
        for (var i = 0; i < (sold || []).length; i++) {
          if (sold[i].stock_num === stockNum) { unit = sold[i]; break; }
        }
        if (!unit) return '<div class="empty-state">Unit not found</div>';

        // Use same card-based layout as active units
        var h = '<div class="view">';
        h += backBtn("activity", "Activity");

        h += '<div class="unit-header">'
          + '<div class="unit-ymm">' + esc(unit.year || "") + ' ' + esc(unit.make || "") + ' ' + esc(unit.model || "") + '</div>'
          + '<div class="unit-sub">' + esc(unit.floor_layout || "") + (unit.body_style ? ' &middot; ' + esc(unit.body_style) : '') + '</div>'
          + '</div>';

        h += '<div class="stats-row">'
          + '<div class="stat-pill"><div class="stat-val text-green">SOLD</div><div class="stat-label">Status</div></div>'
          + '<div class="stat-pill"><div class="stat-val text-blue">' + esc(unit.age || "\u2014") + '</div><div class="stat-label">Age at Sale</div></div>'
          + '</div>';

        h += '<div class="card"><div class="card-title">Identity</div>'
          + fieldRow("Stock #", unit.stock_num) + fieldRow("VIN", unit.vin)
          + fieldRow("Make", unit.make) + fieldRow("Model", unit.model)
          + fieldRow("Year", unit.year) + fieldRow("Type", unit.veh_type)
          + fieldRow("Condition", unit.condition)
          + '</div>';

        h += '<div class="card"><div class="card-title">Sale Details</div>'
          + fieldRow("Sold Date", unit.sold_date);
        if (unit.retail_price) h += fieldRow("Retail Price", fmtPrice(unit.retail_price));
        if (unit.deal_selling_price) h += fieldRow("Selling Price", fmtPrice(unit.deal_selling_price));
        h += '</div>';

        h += '</div>';
        return h;
      });
    }
  }

  function _renderSalesUnitList(units, title, section) {
    var h = '<div class="section-title">' + esc(title) + ' <span style="color:var(--text-3);">(' + units.length + ')</span></div>';

    if (units.length === 0) {
      h += '<div style="color:var(--text-3);padding:12px 0;">No units</div>';
      return h;
    }

    units.sort(function (a, b) {
      var cmp = (a.make || "").localeCompare(b.make || "");
      return cmp !== 0 ? cmp : (a.model || "").localeCompare(b.model || "");
    });

    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var detailTarget = (section === "sold")
        ? "sales-units/sold/" + encodeURIComponent(u.stock_num)
        : "detail/" + encodeURIComponent(u.stock_num);
      var statusColors = { "pending": "var(--orange)", "pending-display": "var(--orange)", "retail-ordered": "#a855f7", "sold": "var(--green)" };
      var statusLabels = { "pending": "PENDING", "pending-display": "PENDING", "retail-ordered": "RETAIL ORD", "sold": "SOLD" };
      var statusColor = statusColors[section] || "var(--text-2)";
      var statusLabel = statusLabels[section] || (u.status || "");

      h += '<a class="card card-interactive" href="#' + detailTarget + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">';
      h += '<div>';
      h += '<div style="font-size:18px;font-weight:600;">' + esc(u.year || "") + ' ' + esc(u.make || "") + ' ' + esc(u.model || "") + '</div>';
      h += '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">' + esc(u.stock_num || "") + ' · ' + esc(u.veh_type || "") + (u.floor_layout ? ' · ' + esc(u.floor_layout) : '') + '</div>';
      // Show lot location for pending sections
      if ((section === "pending" || section === "pending-display" || section === "retail-ordered") && u.lot_location) {
        var locArea = (u.lot_area || "").toUpperCase();
        var locColor = (locArea === "DISPLAY" || locArea === "SHOWROOM") ? "var(--orange)" : "var(--text-3)";
        h += '<div style="font-size:12px;color:' + locColor + ';margin-top:2px;">' + esc(u.lot_location) + (u.lot_area ? ' (' + esc(u.lot_area) + ')' : '') + '</div>';
      }
      // Show salesman + deal status for sale pending units
      if ((section === "pending" || section === "pending-display") && u.hold_salesman) {
        h += '<div style="font-size:12px;color:var(--text-3);margin-top:2px;">Salesman: ' + esc(u.hold_salesman) + '</div>';
      }
      if ((section === "pending" || section === "pending-display") && u.deal_status) {
        var dsColor = "var(--text-3)";
        var ds = (u.deal_status || "").toUpperCase();
        if (ds.indexOf("APPROVED") !== -1 || ds.indexOf("FUNDED") !== -1) dsColor = "var(--green)";
        else if (ds.indexOf("PENDING") !== -1 || ds.indexOf("SUBMITTED") !== -1) dsColor = "var(--orange)";
        else if (ds.indexOf("DECLINED") !== -1 || ds.indexOf("DENIED") !== -1) dsColor = "#ef4444";
        h += '<div style="font-size:12px;color:' + dsColor + ';margin-top:2px;font-weight:600;">Deal: ' + esc(u.deal_status) + (u.deal_number ? ' (#' + esc(u.deal_number) + ')' : '') + '</div>';
      }
      h += '</div>';
      h += '<div style="text-align:right;">';
      if (u.retail_price) h += '<div style="font-size:14px;color:var(--text-2);">' + _fmtPrice(u.retail_price) + '</div>';
      h += '<div style="font-size:12px;font-weight:700;color:' + statusColor + ';">' + statusLabel + '</div>';
      if (u.status_days != null) h += '<div style="font-size:11px;color:var(--text-3);">' + u.status_days + 'd</div>';
      h += '</div></a>';
    }
    return h;
  }

  // ══════════════════════════════════════════════════════════════════
  // LOT MAP VIEW
  // ══════════════════════════════════════════════════════════════════

  function lotMapView() {
    var h = '<div class="section-title">CLE LOT MAP</div>';
    h += '<p style="color:var(--text-3);font-size:13px;margin:0 0 12px;">Pinch to zoom · Swipe to pan</p>';

    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-weight:600;margin-bottom:8px;color:var(--text-2);">Page 1 — Overview</div>';
    h += '<div style="overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--border);border-radius:var(--radius);background:#fff;">';
    h += '<img src="img/lot-map-p1.jpg" alt="CLE Lot Map Page 1" style="display:block;width:100%;min-width:600px;height:auto;" />';
    h += '</div></div>';

    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-weight:600;margin-bottom:8px;color:var(--text-2);">Page 2 — Legend & Codes</div>';
    h += '<div style="overflow:auto;-webkit-overflow-scrolling:touch;border:1px solid var(--border);border-radius:var(--radius);background:#fff;">';
    h += '<img src="img/lot-map-p2.jpg" alt="CLE Lot Map Page 2" style="display:block;width:100%;min-width:600px;height:auto;" />';
    h += '</div></div>';

    return Promise.resolve(h);
  }

  // ══════════════════════════════════════════════════════════════════
  // REPLACEMENT PICKER — Select overflow unit to backfill a sale pending slot
  // ══════════════════════════════════════════════════════════════════

  function replacePickerView(stockNum) {
    return DB.getAllUnits().then(function (units) {
      // Find the sale pending unit
      var spUnit = null;
      for (var i = 0; i < units.length; i++) {
        if (units[i].stock_num === stockNum) { spUnit = units[i]; break; }
      }
      if (!spUnit) return '<div class="empty-state">Unit not found</div>';

      var spMake = (spUnit.make || "").toUpperCase();
      var spVt = (spUnit.veh_type || "").toUpperCase();
      var spModel = (spUnit.model || "").toUpperCase();

      // Find overflow candidates — prioritize same make, then same type
      var sameMakeModel = [];
      var sameMake = [];
      var sameType = [];
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        var area = (u.lot_area || "").toUpperCase();
        var st = (u.status || "").toUpperCase();
        if (area !== "OVERFLOW") continue;
        if (st === "SALE PENDING" || st === "SOLD") continue;
        var uMake = (u.make || "").toUpperCase();
        var uVt = (u.veh_type || "").toUpperCase();
        var uModel = (u.model || "").toUpperCase();
        if (uMake === spMake && uModel === spModel) {
          sameMakeModel.push(u);
        } else if (uMake === spMake) {
          sameMake.push(u);
        } else if (uVt === spVt) {
          sameType.push(u);
        }
      }

      // Sort each group by age (freshest first)
      function sortByAge(a, b) {
        var aa = parseInt(a.age) || 0, ba = parseInt(b.age) || 0;
        return aa - ba;
      }
      sameMakeModel.sort(sortByAge);
      sameMake.sort(sortByAge);
      sameType.sort(sortByAge);

      var h = '<div class="section-title">SELECT REPLACEMENT</div>';
      h += '<div class="card" style="border-left:3px solid var(--orange);margin-bottom:16px;">';
      h += '<div style="font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;">Replacing</div>';
      h += '<div style="font-size:18px;font-weight:700;margin-top:4px;">' + esc(spUnit.year || "") + ' ' + esc(spUnit.make || "") + ' ' + esc(spUnit.model || "") + '</div>';
      h += '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Stk# ' + esc(spUnit.stock_num) + ' · ' + esc(spUnit.lot_location || "") + ' (' + esc(spUnit.lot_area || "") + ')</div>';
      if (spUnit.hold_salesman) h += '<div style="font-size:12px;color:var(--text-3);margin-top:2px;">Salesman: ' + esc(spUnit.hold_salesman) + '</div>';
      if (spUnit.deal_status) h += '<div style="font-size:12px;color:var(--orange);margin-top:2px;font-weight:600;">Deal: ' + esc(spUnit.deal_status) + (spUnit.deal_number ? ' (#' + esc(spUnit.deal_number) + ')' : '') + '</div>';
      h += '</div>';

      function renderCandidateGroup(label, list, accentColor) {
        if (list.length === 0) return '';
        var out = '<div style="margin-bottom:8px;color:var(--text-3);font-size:12px;text-transform:uppercase;letter-spacing:1px;">' + label + ' (' + list.length + ')</div>';
        for (var i = 0; i < list.length; i++) {
          var u = list[i];
          var stColor = (u.status || "").toUpperCase() === "READY FOR SALE" ? "var(--green)" : "var(--blue)";
          out += '<div class="card card-interactive" data-action="confirm-replace" data-sp-stock="' + esc(spUnit.stock_num) + '" data-repl-stock="' + esc(u.stock_num) + '" style="border-left:3px solid ' + accentColor + ';">';
          out += '<div style="display:flex;justify-content:space-between;align-items:center;">';
          out += '<div>';
          out += '<div style="font-size:18px;font-weight:600;">' + esc(u.year || "") + ' ' + esc(u.make || "") + ' ' + esc(u.model || "") + '</div>';
          out += '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Stk# ' + esc(u.stock_num) + ' · ' + esc(u.floor_layout || "") + '</div>';
          out += '<div style="font-size:12px;color:var(--text-3);margin-top:2px;">' + esc(u.lot_location || "") + '</div>';
          out += '</div>';
          out += '<div style="text-align:right;">';
          out += '<div style="font-size:12px;font-weight:700;color:' + stColor + ';">' + esc(u.status || "") + '</div>';
          out += '<div style="font-size:12px;color:var(--text-3);">' + (u.age || "0") + 'd</div>';
          out += '</div></div></div>';
        }
        return out;
      }

      h += renderCandidateGroup("Same Model (" + esc(spUnit.make || "") + " " + esc(spUnit.model || "") + ")", sameMakeModel, "var(--green)");
      h += renderCandidateGroup("Same Make (" + esc(spUnit.make || "") + ")", sameMake, "var(--blue)");
      h += renderCandidateGroup("Same Type (" + esc(spUnit.veh_type || "") + ")", sameType, "var(--text-3)");

      if (sameMakeModel.length === 0 && sameMake.length === 0 && sameType.length === 0) {
        h += '<div style="color:var(--text-3);padding:20px 0;text-align:center;">No overflow candidates available</div>';
      }

      return h;
    });
  }

  // ══════════════════════════════════════════════════════════════════
  // REPLACEMENT LOG
  // ══════════════════════════════════════════════════════════════════

  function replLogView() {
    return Promise.all([
      DB.getAllReplacements(),
      DB.getAllUnits()
    ]).then(function (results) {
      var entries = results[0];
      var units = results[1];

      // Build stock→unit lookup for stale detection
      var unitMap = {};
      for (var i = 0; i < units.length; i++) unitMap[units[i].stock_num] = units[i];

      var active = entries.filter(function (e) { return e.status === "active"; });
      var completed = entries.filter(function (e) { return e.status === "completed"; });
      var cancelled = entries.filter(function (e) { return e.status === "cancelled"; });

      // Sort newest first
      active.sort(function (a, b) { return (b.timestamp || "").localeCompare(a.timestamp || ""); });
      completed.sort(function (a, b) { return (b.updated_at || b.timestamp || "").localeCompare(a.updated_at || a.timestamp || ""); });

      var h = '<div class="section-title">REPLACEMENT LOG</div>';

      // KPI pills
      h += '<div class="stats-row">';
      h += '<div class="stat-pill"><div class="stat-val" style="color:var(--orange);">' + active.length + '</div><div class="stat-label">ACTIVE</div></div>';
      h += '<div class="stat-pill"><div class="stat-val" style="color:var(--green);">' + completed.length + '</div><div class="stat-label">COMPLETED</div></div>';
      h += '<div class="stat-pill"><div class="stat-val" style="color:var(--text-3);">' + cancelled.length + '</div><div class="stat-label">CANCELLED</div></div>';
      h += '</div>';

      if (completed.length > 0 || cancelled.length > 0) {
        h += '<div style="text-align:center;margin-bottom:12px;">'
          + '<a data-repl-action="clear-completed" data-repl-id="0" style="font-size:13px;color:var(--text-3);text-decoration:underline;cursor:pointer;">Clear completed & cancelled</a>'
          + '</div>';
      }

      // Active entries
      if (active.length > 0) {
        h += '<div style="margin-bottom:8px;color:var(--text-3);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Active Replacements</div>';
        for (var i = 0; i < active.length; i++) {
          var e = active[i];
          var ts = e.timestamp ? new Date(e.timestamp).toLocaleString() : "";

          // Stale detection — check if replacement unit status changed
          var replUnit = unitMap[e.repl_stock];
          var isStale = false;
          var staleMsg = "";
          if (!replUnit) {
            isStale = true;
            staleMsg = "Unit no longer in inventory";
          } else if ((replUnit.status || "").toUpperCase() === "SOLD") {
            isStale = true;
            staleMsg = "Unit has been SOLD";
          } else if ((replUnit.status || "").toUpperCase() === "SALE PENDING") {
            isStale = true;
            staleMsg = "Unit is now SALE PENDING";
          } else if ((replUnit.lot_area || "").toUpperCase() !== "OVERFLOW") {
            staleMsg = "Unit moved to " + (replUnit.lot_area || "unknown area");
          }

          var borderColor = isStale ? "#ef4444" : "var(--orange)";
          h += '<div class="card" style="border-left:3px solid ' + borderColor + ';margin-bottom:8px;">';

          if (isStale) {
            h += '<div style="background:#ef4444;color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:700;margin-bottom:8px;display:inline-block;">STALE: ' + esc(staleMsg) + '</div>';
          } else if (staleMsg) {
            h += '<div style="background:#f59e0b;color:#000;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:700;margin-bottom:8px;display:inline-block;">NOTE: ' + esc(staleMsg) + '</div>';
          }

          h += '<div style="font-size:11px;color:var(--text-3);">' + esc(ts) + '</div>';
          h += '<div style="margin-top:6px;">';
          h += '<div style="font-size:12px;color:var(--text-3);text-transform:uppercase;">Pull from ' + esc(e.repl_location) + '</div>';
          h += '<div style="font-size:16px;font-weight:700;">' + esc(e.repl_desc) + '</div>';
          h += '<div style="font-size:13px;color:var(--text-3);">Stk# ' + esc(e.repl_stock) + '</div>';
          h += '</div>';

          h += '<div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px;">';
          h += '<div style="font-size:12px;color:var(--text-3);text-transform:uppercase;">Drop at ' + esc(e.sp_location) + ' (' + esc(e.sp_area) + ')</div>';
          h += '<div style="font-size:14px;">Replacing: ' + esc(e.sp_desc) + ' (Stk# ' + esc(e.sp_stock) + ')</div>';
          if (e.sp_salesman) h += '<div style="font-size:12px;color:var(--text-3);">Salesman: ' + esc(e.sp_salesman) + '</div>';
          h += '</div>';

          h += '<div style="display:flex;gap:8px;margin-top:10px;">';
          h += '<a class="btn btn-blue" style="flex:1;text-align:center;" data-repl-action="complete" data-repl-id="' + e.id + '">Mark Complete</a>';
          h += '<a class="btn btn-ghost" style="flex:1;text-align:center;" data-repl-action="cancel" data-repl-id="' + e.id + '">Cancel</a>';
          h += '</div></div>';
        }
      } else {
        h += '<div style="color:var(--text-3);padding:20px 0;text-align:center;">No active replacements</div>';
      }

      // Completed (collapsed)
      if (completed.length > 0) {
        h += '<div style="margin:16px 0 8px;color:var(--text-3);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Completed (' + completed.length + ')</div>';
        for (var i = 0; i < Math.min(completed.length, 5); i++) {
          var e = completed[i];
          h += '<div style="padding:8px 12px;border-left:3px solid var(--green);margin-bottom:6px;opacity:0.6;">';
          h += '<div style="font-size:14px;">' + esc(e.repl_desc) + ' → ' + esc(e.sp_location) + '</div>';
          h += '<div style="font-size:12px;color:var(--text-3);">' + esc(e.repl_stock) + ' replaced ' + esc(e.sp_stock) + '</div>';
          h += '</div>';
        }
      }

      return h;
    });
  }


  // ══════════════════════════════════════════════════════════════════
  // HELP / FAQ
  // ══════════════════════════════════════════════════════════════════

  function helpView() {
    var h = '<div class="section-title">HOW TO USE THIS APP</div>';
    h += '<p style="color:var(--text-3);font-size:13px;margin:0 0 16px;">CLE Lot Manager — Quick Reference</p>';

    var sections = [
      {
        title: "Home Tab",
        icon: "🏠",
        items: [
          "Search by stock number or last 8 of VIN",
          "Browse inventory by Lots, Status, Makes, or Floor Layout",
          "Status Overview shows sellable, dead, transit, and ordered counts"
        ]
      },
      {
        title: "Notes Tab",
        icon: "📝",
        items: [
          "Log field observations: holes, verifications, reorgs, and general notes",
          "Notes push to the CLE Lot Report Google Sheet for tracking",
          "View submission history to see what's been logged"
        ]
      },
      {
        title: "Audit Tab",
        icon: "✅",
        items: [
          "Status & Location Audit: flags units with data issues (wrong PC, missing lot, etc.)",
          "Product Hierarchy: flags missing vehicle type, body style, or manufacturer (new units only)"
        ]
      },
      {
        title: "Activity Tab",
        icon: "↕️",
        items: [
          "Sale Pending Today: units put into sale pending today (status days = 0)",
          "Pending in Display: sale pending units in showroom/display that need pulling",
          "Select Replacement: pick an overflow unit to backfill a sale pending display slot",
          "Retail Ordered Today: customer orders placed today (by order date)",
          "Incoming Pipeline: ordered, shipped, and in-transit units by stage/type/make"
        ]
      },
      {
        title: "Coverage Tab",
        icon: "📊",
        items: [
          "Coverage Matrix: every model's placement (showroom, display, overflow, incoming)",
          "Zone Map: per-zone model grid for reorganization planning",
          "Overflow Only: units in overflow with no showroom or display presence",
          "Replacement Log: track your replacement picks — mark complete or cancel"
        ]
      },
      {
        title: "Unit Replacement Tool",
        icon: "🔄",
        items: [
          "From a sale pending unit in display/showroom, tap 'Select Replacement from Overflow'",
          "Candidates are grouped: Same Model (best) → Same Make → Same Type",
          "Sorted by freshness — newest units first",
          "Selection is logged to the Google Sheet and tracked in the Replacement Log",
          "Duplicate assignments are blocked — each overflow unit can only be assigned once"
        ]
      },
      {
        title: "Data Refresh",
        icon: "🔄",
        items: [
          "Data updates when the CLE Lot Report runs (usually daily)",
          "Close all app tabs and reopen to pick up new data",
          "The 'Updated' timestamp at the top shows when data was last refreshed"
        ]
      }
    ];

    for (var s = 0; s < sections.length; s++) {
      var sec = sections[s];
      h += '<div class="card" style="margin-bottom:8px;">';
      h += '<div style="font-size:18px;font-weight:700;margin-bottom:8px;">' + sec.icon + ' ' + esc(sec.title) + '</div>';
      h += '<ul style="margin:0;padding-left:20px;color:var(--text-2);font-size:14px;line-height:1.8;">';
      for (var i = 0; i < sec.items.length; i++) {
        h += '<li>' + esc(sec.items[i]) + '</li>';
      }
      h += '</ul></div>';
    }

    return Promise.resolve(h);
  }


  // ══════════════════════════════════════════════════════════════════
  // INCOMING PIPELINE VIEWS
  // ══════════════════════════════════════════════════════════════════

  function incomingView() {
    return DB.getAllUnits().then(function (units) {
      var incoming = _getIncomingUnits(units);

      // Group by pipeline stage
      var STAGE_ORDER = ["ORDERED","PO ISSUED","RETAIL ORDERED","PURCHASED","SHIPPED","DISPATCHED","IN TRANSIT","DRIVER NEEDED","TRANSFER","STORE-TO-STORE TRANSFER","OPS TRANSFER"];
      var byStatus = {};
      var byType = {};
      var byMake = {};
      for (var i = 0; i < incoming.length; i++) {
        var u = incoming[i];
        var st = (u.status || "").toUpperCase();
        var vt = (u.veh_type || "Other").toUpperCase();
        var mk = u.make || "Unknown";
        byStatus[st] = (byStatus[st] || 0) + 1;
        byType[vt] = (byType[vt] || 0) + 1;
        byMake[mk] = (byMake[mk] || 0) + 1;
      }

      var h = '<div class="section-title">INCOMING PIPELINE <span style="color:var(--blue);">(' + incoming.length + ')</span></div>';

      // Stage breakdown
      h += '<div style="margin-bottom:8px;color:var(--text-3);font-size:12px;text-transform:uppercase;letter-spacing:1px;">By Pipeline Stage</div>';
      var stageKeys = STAGE_ORDER.filter(function(s) { return byStatus[s]; });
      for (var s = 0; s < stageKeys.length; s++) {
        var stageColor = (stageKeys[s] === "SHIPPED" || stageKeys[s] === "DISPATCHED" || stageKeys[s] === "IN TRANSIT" || stageKeys[s] === "DRIVER NEEDED") ? "var(--green)" : "var(--blue)";
        h += '<a class="card card-interactive" href="#incoming-status/' + encodeURIComponent(stageKeys[s]) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">'
          + '<span style="font-size:18px;font-weight:600;">' + esc(stageKeys[s]) + '</span>'
          + '<span class="stat-val" style="font-size:24px;color:' + stageColor + ';">' + byStatus[stageKeys[s]] + '</span></a>';
      }

      // By Type
      h += '<div style="margin:16px 0 8px;color:var(--text-3);font-size:12px;text-transform:uppercase;letter-spacing:1px;">By Type</div>';
      var typeKeys = Object.keys(byType).sort();
      for (var t = 0; t < typeKeys.length; t++) {
        h += '<a class="card card-interactive" href="#incoming-units/type/' + encodeURIComponent(typeKeys[t]) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">'
          + '<span style="font-size:18px;font-weight:600;">' + esc(typeKeys[t]) + '</span>'
          + '<span class="stat-val" style="font-size:24px;color:var(--blue);">' + byType[typeKeys[t]] + '</span></a>';
      }

      // By Make
      h += '<div style="margin:16px 0 8px;color:var(--text-3);font-size:12px;text-transform:uppercase;letter-spacing:1px;">By Make</div>';
      var makeKeys = Object.keys(byMake).sort();
      for (var m = 0; m < makeKeys.length; m++) {
        h += '<a class="card card-interactive" href="#incoming-make/' + encodeURIComponent(makeKeys[m]) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">'
          + '<span style="font-size:18px;font-weight:600;">' + esc(makeKeys[m]) + '</span>'
          + '<span class="stat-val" style="font-size:24px;color:var(--blue);">' + byMake[makeKeys[m]] + '</span></a>';
      }

      return h;
    });
  }

  function incomingStatusView(status) {
    return DB.getAllUnits().then(function (units) {
      var incoming = _getIncomingUnits(units);
      var filtered = [];
      for (var i = 0; i < incoming.length; i++) {
        if ((incoming[i].status || "").toUpperCase() === status.toUpperCase()) filtered.push(incoming[i]);
      }
      return _renderIncomingUnitList(filtered, status);
    });
  }

  function incomingMakeView(make) {
    return DB.getAllUnits().then(function (units) {
      var incoming = _getIncomingUnits(units);
      var filtered = [];
      for (var i = 0; i < incoming.length; i++) {
        if ((incoming[i].make || "") === make) filtered.push(incoming[i]);
      }
      return _renderIncomingUnitList(filtered, make);
    });
  }

  function incomingUnitsView(filterType, filterVal) {
    return DB.getAllUnits().then(function (units) {
      var incoming = _getIncomingUnits(units);
      var filtered = [];
      for (var i = 0; i < incoming.length; i++) {
        var u = incoming[i];
        if (filterType === "type" && (u.veh_type || "").toUpperCase() === filterVal.toUpperCase()) filtered.push(u);
        else if (filterType === "make" && (u.make || "") === filterVal) filtered.push(u);
      }
      return _renderIncomingUnitList(filtered, filterVal);
    });
  }

  function _renderIncomingUnitList(units, title) {
    var h = '<div class="section-title">' + esc(title) + ' <span style="color:var(--text-3);">(' + units.length + ')</span></div>';

    if (units.length === 0) {
      h += '<div style="color:var(--text-3);padding:12px 0;">No units</div>';
      return h;
    }

    units.sort(function (a, b) {
      var cmp = (a.make || "").localeCompare(b.make || "");
      if (cmp !== 0) return cmp;
      cmp = (a.model || "").localeCompare(b.model || "");
      if (cmp !== 0) return cmp;
      return ((a.status_days || 0) - (b.status_days || 0));
    });

    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      var st = (u.status || "").toUpperCase();
      var statusColor = (st === "SHIPPED" || st === "DISPATCHED" || st === "IN TRANSIT" || st === "DRIVER NEEDED") ? "var(--green)" : "var(--blue)";
      var statusDays = u.status_days != null ? u.status_days + "d" : "";

      h += '<a class="card card-interactive" href="#detail/' + encodeURIComponent(u.stock_num) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:inherit;">';
      h += '<div>';
      h += '<div style="font-size:18px;font-weight:600;">' + esc(u.year || "") + ' ' + esc(u.make || "") + ' ' + esc(u.model || "") + '</div>';
      h += '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">' + esc(u.stock_num || "") + ' · ' + esc(u.veh_type || "") + (u.floor_layout ? ' · ' + esc(u.floor_layout) : '') + '</div>';
      h += '</div>';
      h += '<div style="text-align:right;">';
      h += '<div style="font-size:12px;font-weight:700;color:' + statusColor + ';">' + esc(st) + '</div>';
      if (statusDays) h += '<div style="font-size:12px;color:var(--text-3);">' + statusDays + '</div>';
      h += '</div></a>';
    }
    return h;
  }

  // ── Module Exports ──────────────────────────────────────────────
  return {
    homeView: homeView,
    unitDetailView: unitDetailView,
    unitDupesView: unitDupesView,
    unitSimilarView: unitSimilarView,
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
    lotMapView: lotMapView,
    coverageTabView: coverageTabView,
    coverageView: coverageView,
    zoneMapView: zoneMapView,
    overflowOnlyView: overflowOnlyView,
    hierarchyView: hierarchyView,
    hierarchyDetailView: hierarchyDetailView,
    notesView: notesView,
    noteFormView: noteFormView,
    auditTabView: auditTabView,
    auditStatusView: auditStatusView,
    activityView: activityView,
    salesView: salesView,
    salesSectionView: salesSectionView,
    salesMakeView: salesMakeView,
    salesUnitsView: salesUnitsView,
    replacePickerView: replacePickerView,
    replLogView: replLogView,
    helpView: helpView,
    incomingView: incomingView,
    incomingStatusView: incomingStatusView,
    incomingMakeView: incomingMakeView,
    incomingUnitsView: incomingUnitsView,
    renderAuditFlags: renderAuditFlags,
    computeAuditFlags: computeAuditFlags,
    esc: esc,
  };
})();
