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
    var age = parseInt(u.age) || 0;
    var ageColor = age > 180 ? 'var(--red)' : age > 120 ? 'var(--orange)' : age > 60 ? 'var(--copper)' : 'var(--text-3)';
    var yearColor = (parseInt(u.year) || 0) <= 2025 ? 'var(--orange)' : 'var(--text)';
    var condVal = (u.condition || "New").toUpperCase();
    var isSP = (u.status || "").toUpperCase() === "SALE PENDING";

    var h = '<div class="result-card" data-action="detail" data-stock="' + esc(u.stock_num) + '" data-condition="' + esc(condVal) + '">';
    h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';

    // Left side
    h += '<div style="flex:1;min-width:0;">';

    // Line 1: Year Make Model-StockNumber
    h += '<div class="result-ymm"><span style="color:' + yearColor + ';">' + esc(u.year) + '</span> '
      + esc(u.make) + ' ' + esc(u.model) + '<span style="color:var(--text-3);font-weight:400;">-' + esc(u.stock_num) + '</span></div>';

    // Line 2: Manufacturer
    if (u.manufacturer) h += '<div style="font-size:11px;color:var(--text-3);margin-top:1px;text-transform:uppercase;letter-spacing:0.5px;">' + esc(u.manufacturer) + '</div>';

    // Line 3: VehType · FloorLayout · SubFloorPlan
    var line3Parts = [];
    if (u.veh_type) line3Parts.push(esc(u.veh_type));
    if (u.floor_layout) line3Parts.push(esc(u.floor_layout));
    if (u.sub_floorplan) line3Parts.push(esc(u.sub_floorplan));
    if (line3Parts.length > 0) h += '<div class="result-meta">' + line3Parts.join('<span class="sep">&middot;</span>') + '</div>';

    // Line 4: LotLocation · Status badge · StatusDays + Condition badge
    h += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">';
    if (u.lot_location) h += '<span style="font-size:12px;color:var(--text-3);">' + esc(u.lot_location) + '</span>';
    h += '<span class="status-badge ' + statusClass(u.status) + '">' + esc(u.status) + '</span>';
    if (u.status_days != null && u.status_days !== "") {
      var sd = parseInt(u.status_days) || 0;
      var sdColor = sd > 7 ? 'var(--red)' : sd > 3 ? 'var(--orange)' : 'var(--text-3)';
      h += '<span style="font-size:11px;font-weight:700;color:' + sdColor + ';">' + sd + 'd in status</span>';
    }
    if (condVal === "USED") h += '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:#fde8e8;color:#C8102E;">USED</span>';
    else if (condVal === "DEMO" || condVal === "D") h += '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:var(--blue-dim);color:var(--blue);">DEMO</span>';
    h += '</div>';

    // Line 5 (Sale Pending only): DealNumber · DealStatus · HoldSalesman
    if (isSP && (u.deal_number || u.deal_status || u.hold_salesman)) {
      h += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">';
      if (u.deal_number) h += '<span style="font-size:11px;font-weight:700;color:var(--text-2);">Deal #' + esc(u.deal_number) + '</span>';
      if (u.deal_status) {
        var dsU = (u.deal_status || "").toUpperCase();
        var dsBg = '#e9ecef', dsFg = 'var(--text-2)';
        if (dsU.indexOf("FUNDED") !== -1 || dsU.indexOf("APPROVED") !== -1 || dsU.indexOf("SCHEDULED") !== -1) { dsBg = 'var(--green-dim)'; dsFg = 'var(--green)'; }
        else if (dsU.indexOf("PENDING") !== -1 || dsU.indexOf("SUBMITTED") !== -1 || dsU.indexOf("IN PROGRESS") !== -1) { dsBg = 'var(--orange-dim)'; dsFg = 'var(--orange)'; }
        else if (dsU.indexOf("DECLINED") !== -1 || dsU.indexOf("DENIED") !== -1 || dsU.indexOf("CANCEL") !== -1) { dsBg = '#fde8e8'; dsFg = '#C8102E'; }
        h += '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:' + dsBg + ';color:' + dsFg + ';">' + esc(u.deal_status) + '</span>';
      }
      if (u.hold_salesman) h += '<span style="font-size:11px;color:var(--text-3);">' + esc(u.hold_salesman) + '</span>';
      h += '</div>';
    }

    h += '</div>';

    // Right side: Age + Prices stacked
    h += '<div style="text-align:right;min-width:55px;">';
    h += '<div style="font-size:18px;font-weight:800;color:' + ageColor + ';">' + age + 'd</div>';
    if (fmtPrice(u.msrp)) h += '<div style="font-size:11px;color:var(--text-3);text-decoration:line-through;">' + fmtPrice(u.msrp) + '</div>';
    if (fmtPrice(u.retail_price)) {
      var rpColor = fmtPrice(u.special_price) ? 'var(--text-3)' : 'var(--green)';
      h += '<div style="font-size:12px;font-weight:700;color:' + rpColor + ';">' + fmtPrice(u.retail_price) + '</div>';
    }
    if (fmtPrice(u.special_price)) h += '<div style="font-size:12px;font-weight:700;color:var(--green);">' + fmtPrice(u.special_price) + '</div>';
    h += '</div></div></div>';
    return h;
  }

  // ── Selectable unit tile (pick-stock / pick-fill actions) ───────
  function renderUnitSelectCard(u, action, overflowPriority) {
    // Reuse the standard tile but swap the data-action and add cursor + priority banner
    var card = renderUnitCard(u);
    // Replace data-action="detail" with the selection action
    card = card.replace('data-action="detail"', 'data-action="' + action + '" style="cursor:pointer;"');
    if (overflowPriority) {
      card = card.replace('<div class="result-card"',
        '<div class="result-card"').replace(
        'data-action="' + action + '"',
        'data-action="' + action + '"'
      );
      // Insert overflow priority banner after opening tag
      var insertAt = card.indexOf('>') + 1;
      card = card.substring(0, insertAt)
        + '<div style="font-size:10px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:3px;">&#9650; OVERFLOW — PRIORITY</div>'
        + card.substring(insertAt);
    }
    return card;
  }

  function renderUnitPickTile(u) {
    return renderUnitSelectCard(u, "pick-stock", false);
  }

  function renderUnitFillTile(u) {
    return renderUnitSelectCard(u, "pick-fill", (u.lot_area || "").toUpperCase() === "OVERFLOW");
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

  // ── Shared multi-select dropdown ─────────────────────────────
  function renderMultiSelect(id, label, optionMap, onchangeFn, preSelections) {
    var keys = Object.keys(optionMap).sort();
    var out = '<div style="margin-bottom:8px;">'
      + '<label style="font-size:12px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;">' + label + '</label>'
      + '<select class="form-select" id="' + id + '" multiple onchange="' + onchangeFn + '" style="margin-top:4px;min-height:36px;">';
    for (var k = 0; k < keys.length; k++) {
      var selected = (preSelections && preSelections[keys[k]]) ? ' selected' : '';
      out += '<option value="' + esc(keys[k]) + '"' + selected + '>' + esc(keys[k]) + ' (' + optionMap[keys[k]] + ')</option>';
    }
    out += '</select></div>';
    return out;
  }

  // ── Cross-filter accordions (read-only breakdowns for navigation views) ──
  function renderCrossFilters(units, exclude) {
    var h = '';
    if (exclude !== "status") {
      var byCat = {};
      for (var i = 0; i < units.length; i++) { var cat = statusCat(units[i].status); byCat[cat] = (byCat[cat] || 0) + 1; }
      var items = [];
      for (var ci = 0; ci < STATUS_CATS.length; ci++) { var c = STATUS_CATS[ci]; if (byCat[c.name]) items.push({ label: c.name, count: byCat[c.name], pct: Math.round(byCat[c.name] / units.length * 100), color: c.color }); }
      if (Object.keys(byCat).length > 0) h += renderAccordion("By Status (" + units.length + ")", renderBreakdown(items));
    }
    if (exclude !== "makes") {
      var byMfr = {};
      for (var i = 0; i < units.length; i++) { var m = units[i].manufacturer || units[i].make || "Unknown"; byMfr[m] = (byMfr[m] || 0) + 1; }
      var sorted = Object.keys(byMfr).sort(function (a, b) { return byMfr[b] - byMfr[a]; });
      var items = [];
      for (var i = 0; i < Math.min(sorted.length, 10); i++) { items.push({ label: sorted[i], count: byMfr[sorted[i]], pct: Math.round(byMfr[sorted[i]] / units.length * 100), color: "blue" }); }
      if (sorted.length > 0) h += renderAccordion("By Manufacturer (" + sorted.length + ")", renderBreakdown(items));
    }
    if (exclude !== "lots") {
      var byArea = {};
      for (var i = 0; i < units.length; i++) { var a = units[i].lot_area || "UNASSIGNED"; byArea[a] = (byArea[a] || 0) + 1; }
      var sorted = Object.keys(byArea).sort(function (a, b) { return byArea[b] - byArea[a]; });
      var items = [];
      for (var i = 0; i < sorted.length; i++) { items.push({ label: sorted[i], count: byArea[sorted[i]], pct: Math.round(byArea[sorted[i]] / units.length * 100), color: "blue" }); }
      if (sorted.length > 0) h += renderAccordion("By Location (" + sorted.length + ")", renderBreakdown(items));
    }
    return h;
  }

  // ── Drill-through filter panel (replaces renderCrossFilters + renderConditionFilter on unit views) ──
  function renderDrillFilters(units, viewId, exclude) {
    var locSet = {}, typeSet = {}, statusSet = {}, mfrSet = {}, condSet = {};
    for (var i = 0; i < units.length; i++) {
      var u = units[i];
      locSet[u.lot_area || "Unassigned"] = (locSet[u.lot_area || "Unassigned"] || 0) + 1;
      typeSet[u.veh_type || "Other"] = (typeSet[u.veh_type || "Other"] || 0) + 1;
      statusSet[u.status || "Unknown"] = (statusSet[u.status || "Unknown"] || 0) + 1;
      mfrSet[u.manufacturer || "Unknown"] = (mfrSet[u.manufacturer || "Unknown"] || 0) + 1;
      var c = (u.condition || "New").toUpperCase();
      condSet[c] = (condSet[c] || 0) + 1;
    }
    var fn = "App.filterDrillView('" + viewId + "')";
    var h = '<div class="card" style="margin-bottom:8px;">';
    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
    if (exclude.indexOf("location") === -1) h += renderMultiSelect(viewId + "FilterLocation", "Location", locSet, fn);
    if (exclude.indexOf("type") === -1) h += renderMultiSelect(viewId + "FilterType", "Type", typeSet, fn);
    if (exclude.indexOf("status") === -1) h += renderMultiSelect(viewId + "FilterStatus", "Status", statusSet, fn);
    if (exclude.indexOf("manufacturer") === -1) h += renderMultiSelect(viewId + "FilterMfr", "Manufacturer", mfrSet, fn);
    if (exclude.indexOf("condition") === -1 && Object.keys(condSet).length > 1) h += renderMultiSelect(viewId + "FilterCondition", "Condition", condSet, fn);
    h += '</div></div>';
    return h;
  }

  // ── Grouping render helpers (used by initial render + filter callback) ──

  function renderFlatCards(units) {
    if (units.length === 0) return '<div class="empty-state"><div class="empty-icon">&#128230;</div><div class="empty-title">No Units</div></div>';
    var h = '<div style="margin-bottom:8px;font-size:13px;color:var(--text-3);">' + units.length + ' units shown</div>';
    for (var i = 0; i < units.length; i++) h += renderUnitCard(units[i]);
    return h;
  }

  function renderGroupedByStatusCat(units) {
    if (units.length === 0) return '<div class="empty-state"><div class="empty-icon">&#128230;</div><div class="empty-title">No Units</div></div>';
    var h = '<div style="margin-bottom:8px;font-size:13px;color:var(--text-3);">' + units.length + ' units shown</div>';
    for (var ci = 0; ci < STATUS_CATS.length; ci++) {
      var cat = STATUS_CATS[ci];
      var catUnits = units.filter(function (u) { return statusCat(u.status) === cat.name; });
      if (catUnits.length === 0) continue;
      h += '<div class="card" style="border-left:3px solid var(--' + cat.color + ');">'
        + '<div class="card-title" style="color:var(--' + cat.color + ');">' + esc(cat.name) + ' — ' + esc(cat.label) + ' (' + catUnits.length + ')</div>';
      catUnits.sort(function (a, b) {
        var cmp = (a.make || "").localeCompare(b.make || "");
        return cmp !== 0 ? cmp : (a.model || "").localeCompare(b.model || "");
      });
      for (var j = 0; j < catUnits.length; j++) h += renderUnitCard(catUnits[j]);
      h += '</div>';
    }
    return h;
  }

  function renderGroupedByLotCode(units) {
    if (units.length === 0) return '<div class="empty-state"><div class="empty-icon">&#128230;</div><div class="empty-title">No Units</div></div>';
    var h = '<div style="margin-bottom:8px;font-size:13px;color:var(--text-3);">' + units.length + ' units shown</div>';
    var byLot = {};
    for (var i = 0; i < units.length; i++) {
      var lot = units[i].lot_location || "(No Lot)";
      if (!byLot[lot]) byLot[lot] = [];
      byLot[lot].push(units[i]);
    }
    var lots = Object.keys(byLot).sort();
    for (var li = 0; li < lots.length; li++) {
      var lot = lots[li];
      var lu = byLot[lot];
      h += '<div class="card"><div class="card-title">' + esc(lot) + ' (' + lu.length + ')</div>';
      for (var j = 0; j < lu.length; j++) h += renderUnitCard(lu[j]);
      h += '</div>';
    }
    return h;
  }

  function renderGroupedByModel(units, makeName) {
    if (units.length === 0) return '<div class="empty-state"><div class="empty-icon">&#128230;</div><div class="empty-title">No Units</div></div>';
    var h = '<div style="margin-bottom:8px;font-size:13px;color:var(--text-3);">' + units.length + ' units shown</div>';
    var byModel = {};
    for (var i = 0; i < units.length; i++) {
      var model = units[i].model || "Unknown";
      if (!byModel[model]) byModel[model] = [];
      byModel[model].push(units[i]);
    }
    var modelKeys = Object.keys(byModel).sort();
    for (var mi = 0; mi < modelKeys.length; mi++) {
      var model = modelKeys[mi];
      var mu = byModel[model];
      var repUnit = mu[0];
      var sectionTitle = esc((repUnit.year || "") + " " + (makeName || repUnit.make || "") + " " + model);
      h += '<div class="card"><div class="card-title" style="font-size:18px;">' + sectionTitle + ' <span style="font-weight:400;color:var(--text-3);">(' + mu.length + ')</span></div>';
      mu.sort(function (a, b) { return priceNum(a.retail_price) - priceNum(b.retail_price); });
      for (var j = 0; j < mu.length; j++) h += renderUnitCard(mu[j]);
      h += '</div>';
    }
    return h;
  }

  function renderGroupedBySubFloorplan(units) {
    if (units.length === 0) return '<div class="empty-state"><div class="empty-icon">&#128722;</div><div class="empty-title">None Available</div><div class="empty-desc">No active units with this layout</div></div>';
    var h = '<div style="margin-bottom:8px;font-size:13px;color:var(--text-3);">' + units.length + ' units shown</div>';
    var bySub = {};
    for (var i = 0; i < units.length; i++) {
      var sf = units[i].sub_floorplan || "(No Sub Layout)";
      if (!bySub[sf]) bySub[sf] = [];
      bySub[sf].push(units[i]);
    }
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
      for (var j = 0; j < su.length; j++) h += renderUnitCard(su[j]);
      h += '</div>';
    }
    return h;
  }

  function renderGroupedByMake(units) {
    if (units.length === 0) return '<div class="empty-state"><div class="empty-icon">&#128230;</div><div class="empty-title">No Units</div></div>';
    var h = '<div style="margin-bottom:8px;font-size:13px;color:var(--text-3);">' + units.length + ' units shown</div>';
    var byMake = {};
    for (var i = 0; i < units.length; i++) {
      var m = units[i].make || "UNKNOWN";
      if (!byMake[m]) byMake[m] = [];
      byMake[m].push(units[i]);
    }
    var makeKeys = Object.keys(byMake).sort();
    for (var mi = 0; mi < makeKeys.length; mi++) {
      var make = makeKeys[mi];
      var mu = byMake[make];
      h += '<div class="card"><div class="card-title">' + esc(make) + ' (' + mu.length + ')</div>';
      for (var j = 0; j < mu.length; j++) h += renderUnitCard(mu[j]);
      h += '</div>';
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

  function renderZoneSelect(name, required, displayOnly) {
    // displayOnly: if true, only show Showroom + Display zones (for hole reports)
    var h = '<select class="form-select" name="' + name + '"' + (required ? ' required' : '') + '>'
      + '<option value="">Select zone...</option>';
    for (var gi = 0; gi < ZONE_GROUPS.length; gi++) {
      var g = ZONE_GROUPS[gi];
      if (displayOnly && g.type !== "SHR" && g.type !== "DISP") continue;
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

  // ── User name persistence ──────────────────────────────────
  var USER_KEY = "ftrv_note_user";
  function _getSavedUser() { try { return localStorage.getItem(USER_KEY) || ""; } catch(e) { return ""; } }
  function _saveUser(name) { try { localStorage.setItem(USER_KEY, name); } catch(e) {} }

  // ── User name field (auto-fills from last submission) ──────
  function renderUserField() {
    var saved = _getSavedUser();
    return '<label class="form-label">Your Name</label>'
      + '<input class="form-input" type="text" name="user" value="' + esc(saved) + '" placeholder="e.g. John" required id="noteUserField">';
  }

  // ── Spot details field ─────────────────────────────────────
  function renderSpotDetails() {
    return '<label class="form-label">Spot Details <span style="font-weight:400;color:var(--text-3);">(optional)</span></label>'
      + '<input class="form-input" type="text" name="spot_details" placeholder="e.g. Row 3, near fence, back corner by building">';
  }

  // ── Standard unit preview card ─────────────────────────────
  function renderUnitPreviewCard(u) {
    if (!u) return '';
    var condBadge = '';
    var cond = (u.condition || "").toUpperCase();
    if (cond === "USED") condBadge = '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:#fde8e8;color:#C8102E;margin-left:6px;">USED</span>';
    else if (cond === "DEMO" || cond === "D") condBadge = '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:var(--blue-dim);color:var(--blue);margin-left:6px;">DEMO</span>';
    return '<div class="card" style="padding:12px;margin-bottom:12px;">'
      + '<div style="font-size:18px;font-weight:700;">' + esc(u.year || "") + ' ' + esc(u.make || "") + ' ' + esc(u.model || "") + condBadge + '</div>'
      + (u.manufacturer ? '<div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.5px;margin-top:1px;">' + esc(u.manufacturer) + '</div>' : '')
      + '<div style="font-size:13px;color:var(--text-2);margin-top:4px;">VIN: ' + esc(u.vin || "") + '</div>'
      + '<div style="font-size:14px;margin-top:6px;">Location: <span style="font-weight:700;color:var(--blue);">' + esc(u.lot_location || "NONE") + '</span>'
      + (u.lot_area ? ' (' + esc(u.lot_area) + ')' : '') + '</div>'
      + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Status: ' + esc(u.status || "") + ' | ' + esc(u.veh_type || "") + ' | ' + esc(u.floor_layout || "") + '</div>'
      + '</div>';
  }


  // ══════════════════════════════════════════════════════════════
  // HOME VIEW (Summary + Search)
  // ══════════════════════════════════════════════════════════════
  function homeView() {
    return DB.getAllUnits().then(function (units) {
      return DB.getMeta("exported_at").then(function (exportedAt) {
        var h = '<div class="view">';

        // How to use + Updated timestamp row (above search)
        if (exportedAt) {
          h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">'
            + '<a href="#help" style="font-size:12px;color:#8899aa;text-decoration:none;">&#8505; How to Use</a>'
            + '<span style="font-size:12px;color:#8899aa;">Updated ' + esc(exportedAt) + '</span>'
            + '</div>';
        }

        // Search box
        h += '<div class="search-box">'
          + '<svg class="search-icon" viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="7" fill="none" stroke="currentColor" stroke-width="2.5"/><line x1="15.5" y1="15.5" x2="21" y2="21" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>'
          + '<input class="search-input" type="text" id="searchInput" placeholder="Stock# or VIN (last 8)..." autocomplete="off" autocapitalize="characters">'
          + '<button class="search-clear" id="searchClear">&times;</button>'
          + '</div>';
        h += '<div id="searchResults"></div>';

        // View All Inventory — top-level action right under search
        h += '<a href="#all-inventory" style="display:block;text-align:center;padding:12px;margin-bottom:8px;font-size:14px;font-weight:600;color:var(--blue);text-decoration:none;border:1px solid var(--border);border-radius:var(--radius);background:var(--surface-2);">View All Inventory (' + units.length + ' units)</a>';

        // Dashboard
        h += '<div id="searchDashboard">';

        // ── Section A: Quick Insights (2x2 stat cards) ──
        var my2025Count = 0, salePending = 0, incomingCount = 0;
        var deadOnDisplay = 0;
        var DEAD_DISPLAY_STATUSES = ["IN SERVICE", "AWAITING PARTS", "DAMAGED"];
        var INCOMING_STATUSES = ["SHIPPED","DISPATCHED","TRANSFER","ORDERED","PO ISSUED","RETAIL ORDERED"];
        for (var i = 0; i < units.length; i++) {
          var u = units[i];
          var st = (u.status || "").toUpperCase();
          var age = parseInt(u.age) || 0;
          var area = (u.lot_area || "").toUpperCase();
          // 2025 model year count
          var isTerminal = false;
          for (var t = 0; t < TERMINAL_STATUSES.length; t++) {
            if (st === TERMINAL_STATUSES[t]) { isTerminal = true; break; }
          }
          var modelYear = parseInt(u.year) || 0;
          if (!isTerminal && modelYear === 2025 && st !== "SOLD") my2025Count++;
          // Sale pending
          if (st === "SALE PENDING") salePending++;
          // Incoming
          for (var ii = 0; ii < INCOMING_STATUSES.length; ii++) {
            if (st === INCOMING_STATUSES[ii]) { incomingCount++; break; }
          }
          // Dead in display
          for (var di = 0; di < DEAD_DISPLAY_STATUSES.length; di++) {
            if (st === DEAD_DISPLAY_STATUSES[di] && (area === "DISPLAY" || area === "SHOWROOM")) {
              deadOnDisplay++;
              break;
            }
          }
        }

        // Display coverage: models with at least 1 unit in DISPLAY or SHOWROOM / total active models
        var modelOnFloor = {};
        var modelAll = {};
        for (var i = 0; i < units.length; i++) {
          var u = units[i];
          var st = (u.status || "").toUpperCase();
          var isTerminal2 = false;
          for (var t = 0; t < TERMINAL_STATUSES.length; t++) {
            if (st === TERMINAL_STATUSES[t]) { isTerminal2 = true; break; }
          }
          if (isTerminal2) continue;
          var mk = (u.make || "") + "|" + (u.model || "");
          modelAll[mk] = true;
          var area = (u.lot_area || "").toUpperCase();
          if (area === "DISPLAY" || area === "SHOWROOM") modelOnFloor[mk] = true;
        }
        var totalModels = Object.keys(modelAll).length;
        var floorModels = Object.keys(modelOnFloor).length;
        var coveragePct = totalModels > 0 ? Math.round(floorModels / totalModels * 100) : 0;

        h += '<div class="qi-grid">'
          + '<a class="qi-card qi-red" href="#all-inventory/year=2025" style="text-decoration:none;color:inherit;"><div class="qi-val">' + my2025Count + '</div><div class="qi-lbl">2025 Models</div></a>'
          + '<a class="qi-card qi-blue" href="#coverage" style="text-decoration:none;color:inherit;"><div class="qi-val">' + coveragePct + '%</div><div class="qi-lbl">Display Coverage</div></a>'
          + '<a class="qi-card qi-orange" href="#sales-section/all-pending/ALL" style="text-decoration:none;color:inherit;"><div class="qi-val">' + salePending + '</div><div class="qi-lbl">Sale Pending</div></a>'
          + '<a class="qi-card qi-green" href="#incoming" style="text-decoration:none;color:inherit;"><div class="qi-val">' + incomingCount + '</div><div class="qi-lbl">Incoming</div></a>'
          + '</div>';

        // ── Section B: Navigate (2x2 compact nav tiles) ──
        h += '<div class="section-header">Navigate</div>';
        h += '<div class="quick-nav-grid">';
        h += '<a class="quick-nav-tile" href="#lots"><div class="quick-nav-label">Lots</div><div class="quick-nav-sub">Search by lot</div></a>';
        h += '<a class="quick-nav-tile" href="#status"><div class="quick-nav-label">Status</div><div class="quick-nav-sub">Stock, dead, transit</div></a>';
        h += '<a class="quick-nav-tile" href="#makes"><div class="quick-nav-label">Makes</div><div class="quick-nav-sub">By manufacturer</div></a>';
        h += '<a class="quick-nav-tile" href="#shop"><div class="quick-nav-label">Type</div><div class="quick-nav-sub">By vehicle type</div></a>';
        h += '</div>';

        // ── Section C: Attention Needed ──
        // Compute overflow-only (display holes) count
        var mmOnFloor2 = {};
        var ovrModels = {};
        for (var i = 0; i < units.length; i++) {
          var u = units[i];
          var st = (u.status || "").toUpperCase();
          var isT3 = false;
          for (var t = 0; t < TERMINAL_STATUSES.length; t++) { if (st === TERMINAL_STATUSES[t]) { isT3 = true; break; } }
          if (isT3) continue;
          var mk = (u.make || "") + "|" + (u.model || "");
          var bucket = lotBucket(u.lot_location || "");
          if (bucket === "SHOWROOM" || (bucket !== "OVERFLOW" && bucket !== "OTHER")) {
            mmOnFloor2[mk] = true;
          }
          if (bucket === "OVERFLOW") {
            ovrModels[mk] = (ovrModels[mk] || 0) + 1;
          }
        }
        var displayHoles = 0;
        var ovrKeys = Object.keys(ovrModels);
        for (var i = 0; i < ovrKeys.length; i++) {
          if (!mmOnFloor2[ovrKeys[i]]) displayHoles += ovrModels[ovrKeys[i]];
        }

        var auditFlags = computeAuditFlags(units);

        h += '<div class="attn-card">'
          + '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:2px;color:#94a3b8;margin-bottom:10px;">Attention Needed</div>'
          + '<a href="#overflow-only" class="attn-row" style="text-decoration:none;color:inherit;cursor:pointer;"><div><span class="attn-label">Display Holes</span><div style="font-size:11px;color:#8899aa;margin-top:2px;">Models needing display placement</div></div><span class="attn-val" style="color:var(--orange);">' + displayHoles + '</span></a>'
          + '<a href="#audit-status" class="attn-row" style="text-decoration:none;color:inherit;cursor:pointer;"><div><span class="attn-label">Audit Flags</span><div style="font-size:11px;color:#8899aa;margin-top:2px;">Data quality issues to resolve</div></div><span class="attn-val" style="color:var(--yellow);">' + auditFlags.length + '</span></a>'
          + '<a href="#all-inventory/dead-display=1" class="attn-row" style="border-bottom:none;text-decoration:none;color:inherit;cursor:pointer;"><div><span class="attn-label">Dead in Display</span><div style="font-size:11px;color:#8899aa;margin-top:2px;">Non-sellable units in customer areas</div></div><span class="attn-val" style="color:var(--red);">' + deadOnDisplay + '</span></a>'
          + '</div>';

        // Powered by RAY.i footer
        h += '<div style="margin:0 -16px;overflow:hidden;">'
          + '<img src="img/powered-by-rayi.png" alt="Powered by RAY.i" style="width:100%;display:block;mix-blend-mode:lighten;opacity:0.85;" />'
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
    var ORDERED_CATS = ["ORDERED","PO ISSUED","PURCHASED"];
    var isOrdered = false;
    for (var oi = 0; oi < ORDERED_CATS.length; oi++) { if (stUp === ORDERED_CATS[oi]) { isOrdered = true; break; } }
    var inDisplay = (u.lot_area || "").toUpperCase() === "DISPLAY" || (u.lot_area || "").toUpperCase() === "SHOWROOM";
    var yearColor = (parseInt(u.year) || 0) <= 2025 ? 'var(--orange)' : '';

    // ── Header (matches tile: Year Make Model-Stock + Manufacturer) ──
    h += '<div class="unit-header">'
      + '<div class="unit-ymm">' + (yearColor ? '<span style="color:' + yearColor + ';">' + esc(u.year) + '</span>' : esc(u.year))
      + ' ' + esc(u.make) + ' ' + esc(u.model)
      + '<span style="opacity:0.5;font-weight:400;">-' + esc(u.stock_num) + '</span></div>';
    if (u.manufacturer) h += '<div style="font-size:12px;color:var(--text-3);text-transform:uppercase;letter-spacing:1px;margin-top:2px;">' + esc(u.manufacturer) + '</div>';
    h += '<div class="unit-sub">' + esc(u.floor_layout || "") + (u.body_style ? ' &middot; ' + esc(u.body_style) : '') + '</div>'
      + '</div>';

    // ── Quick Stats (color-coded to match tiles) ──
    var age = parseInt(u.age) || 0;
    var ageColor = age > 180 ? 'var(--red)' : age > 120 ? 'var(--orange)' : age > 60 ? 'var(--copper)' : 'var(--blue)';
    var sd = parseInt(u.status_days) || 0;
    var sdColor = sd > 7 ? 'var(--red)' : sd > 3 ? 'var(--orange)' : 'var(--blue)';

    h += '<div class="stats-row">'
      + '<div class="stat-pill"><div class="stat-val" style="color:' + ageColor + ';">' + esc(u.age || "\u2014") + '</div><div class="stat-label">Days Old</div></div>'
      + '<div class="stat-pill"><div class="stat-val" style="color:' + sdColor + ';">' + esc(u.status_days || "\u2014") + '</div><div class="stat-label">In Status</div></div>'
      + '<div class="stat-pill"><div class="stat-val" style="font-size:20px;"><span class="status-badge ' + statusClass(u.status) + '">' + esc(u.status) + '</span></div><div class="stat-label">Status</div></div>'
      + '</div>';

    // Condition badge row (Used / Demo)
    var condUp = (u.condition || "").toUpperCase();
    if (condUp === "USED" || condUp === "DEMO" || condUp === "D") {
      var condBg = condUp === "USED" ? '#fde8e8' : 'var(--blue-dim)';
      var condFg = condUp === "USED" ? '#C8102E' : 'var(--blue)';
      var condLabel = condUp === "USED" ? 'USED' : 'DEMO';
      h += '<div style="text-align:center;margin-bottom:12px;"><span style="display:inline-block;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:700;background:' + condBg + ';color:' + condFg + ';">' + condLabel + '</span></div>';
    }

    // ── Card 1: Unit Info ──
    h += '<div class="card"><div class="card-title">Unit Info</div>'
      + fieldRow("Stock #", u.stock_num)
      + fieldRow("VIN", u.vin)
      + fieldRow("Make", u.make)
      + fieldRow("Model", u.model)
      + fieldRow("Type", u.veh_type)
      + fieldRow("Body Style", u.body_style)
      + fieldRow("Floor Layout", u.floor_layout);
    if (u.sub_floorplan) h += fieldRow("Sub Layout", u.sub_floorplan);
    h += fieldRow("Condition", u.condition)
      + '</div>';

    // ── Card 2: Location ──
    h += '<div class="card"><div class="card-title">Location</div>'
      + fieldRow("PC", u.pc);
    if (u.current_loc && u.current_loc !== u.lot_location) h += fieldRow("Current Loc", u.current_loc);
    h += fieldRow("Lot Location", u.lot_location)
      + fieldRow("Lot Area", u.lot_area);

    if (isTransit && u.transfer_notes) {
      h += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">'
        + fieldRow("Transfer Notes", u.transfer_notes) + '</div>';
    }

    h += '<div style="margin-top:12px;display:flex;gap:8px;">'
      + '<a class="btn btn-blue" style="flex:1;text-align:center;" data-action="verify-note" data-stock="' + esc(u.stock_num) + '">Verify</a>'
      + '<a class="btn btn-ghost" style="flex:1;text-align:center;" data-action="reorg-note" data-stock="' + esc(u.stock_num) + '">Suggest Move</a>'
      + '</div></div>';

    // ── Card 3: Retail Deal (SP/pending/retail ordered) ──
    if (isRetailPending && (u.deal_status || u.deal_number || u.hold_salesman
        || u.deal_type || u.deal_delivery_date || u.exp_delivery_date
        || u.funding_status || u.funded_date)) {
      h += '<div class="card"><div class="card-title">Retail Deal</div>';
      if (u.hold_salesman) h += fieldRow("Salesman", u.hold_salesman);
      if (u.deal_number) h += fieldRow("Deal #", u.deal_number);
      if (u.deal_status) {
        var dsU = (u.deal_status || "").toUpperCase();
        var dsFg = 'var(--text)';
        if (dsU.indexOf("FUNDED") !== -1 || dsU.indexOf("APPROVED") !== -1 || dsU.indexOf("SCHEDULED") !== -1) dsFg = 'var(--green)';
        else if (dsU.indexOf("PENDING") !== -1 || dsU.indexOf("SUBMITTED") !== -1 || dsU.indexOf("IN PROGRESS") !== -1) dsFg = 'var(--orange)';
        else if (dsU.indexOf("DECLINED") !== -1 || dsU.indexOf("DENIED") !== -1 || dsU.indexOf("CANCEL") !== -1) dsFg = 'var(--red)';
        h += '<div class="field-row"><span class="field-label">Deal Status</span><span class="field-value" style="color:' + dsFg + ';font-weight:700;">' + esc(u.deal_status) + '</span></div>';
      }
      if (u.deal_type) h += fieldRow("Deal Type", u.deal_type);
      if (u.deal_delivery_date) h += fieldRow("Deal Delivery", u.deal_delivery_date);
      if (u.exp_delivery_date) h += fieldRow("Exp. Delivery", u.exp_delivery_date);
      if (u.funding_status) {
        var fsU = (u.funding_status || "").toUpperCase();
        var fsFg = (fsU.indexOf("FUNDED") !== -1 || fsU.indexOf("APPROVED") !== -1) ? 'var(--green)' : (fsU.indexOf("DECLINED") !== -1 || fsU.indexOf("DENIED") !== -1) ? 'var(--red)' : 'var(--text)';
        h += '<div class="field-row"><span class="field-label">Funding Status</span><span class="field-value" style="color:' + fsFg + ';font-weight:700;">' + esc(u.funding_status) + '</span></div>';
      }
      if (u.funded_date) h += fieldRow("Funded Date", u.funded_date);
      h += '</div>';
    }

    // ── Card 3b: Pipeline Info (for incoming units — ordered/shipped/transfer) ──
    if ((isOrdered || isTransit) && !isRetailPending) {
      var hasAnyPipelineField = u.order_date || u.exp_delivery_date || u.purch_date || (isTransit && u.current_loc);
      if (hasAnyPipelineField) {
        h += '<div class="card"><div class="card-title">Pipeline</div>';
        if (u.order_date) h += fieldRow("Order Date", u.order_date);
        if (u.purch_date) h += fieldRow("Purchase Date", u.purch_date);
        if (u.exp_delivery_date) h += '<div class="field-row"><span class="field-label">Expected Delivery</span><span class="field-value" style="color:var(--green);font-weight:700;">' + esc(u.exp_delivery_date) + '</span></div>';
        if (isTransit && u.current_loc) h += fieldRow("Shipping From", u.current_loc);
        h += '</div>';
      }
    }

    // ── Card 4: Pricing (conditionally formatted) ──
    if (fmtPrice(u.retail_price) || fmtPrice(u.msrp) || fmtPrice(u.special_price)) {
      h += '<div class="card"><div class="card-title">Pricing</div>';
      if (fmtPrice(u.msrp)) {
        var msrpStyle = fmtPrice(u.retail_price) ? 'text-decoration:line-through;color:var(--text-3);' : '';
        h += '<div class="field-row"><span class="field-label">MSRP</span><span class="field-value" style="' + msrpStyle + '">' + esc(fmtPrice(u.msrp)) + '</span></div>';
      }
      if (fmtPrice(u.retail_price)) {
        var rpColor = fmtPrice(u.special_price) ? 'var(--text-3)' : 'var(--green)';
        var rpStrike = fmtPrice(u.special_price) ? 'text-decoration:line-through;' : '';
        h += '<div class="field-row"><span class="field-label">Retail</span><span class="field-value" style="color:' + rpColor + ';font-weight:700;' + rpStrike + '">' + esc(fmtPrice(u.retail_price)) + '</span></div>';
      }
      if (fmtPrice(u.special_price)) {
        h += '<div class="field-row"><span class="field-label">Special</span><span class="field-value" style="color:var(--green);font-weight:700;">' + esc(fmtPrice(u.special_price)) + '</span></div>';
      }
      h += '</div>';
    }

    // ── Card 5: Dates ──
    var hasDates = u.purch_date || u.order_date || u.offline_date || u.hold_date;
    if (hasDates && !isOrdered && !isTransit) {
      h += '<div class="card"><div class="card-title">Dates</div>';
      if (u.purch_date) h += fieldRow("Purchase Date", u.purch_date);
      if (u.order_date) h += fieldRow("Order Date", u.order_date);
      if (u.offline_date) h += fieldRow("Offline Date", u.offline_date);
      if (u.hold_date) h += fieldRow("Hold Date", u.hold_date);
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
    if (allUnits && u.veh_type && u.floor_layout) {
      for (var si = 0; si < allUnits.length; si++) {
        if (allUnits[si].stock_num !== u.stock_num
            && allUnits[si].veh_type === u.veh_type
            && allUnits[si].floor_layout === u.floor_layout) similarCount++;
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
        h += '<a class="card card-interactive" href="#unit-dupes/' + encodeURIComponent(u.stock_num) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
          + '<div><div style="font-size:16px;font-weight:600;">Duplicate Make &amp; Models</div>'
          + '<div style="font-size:13px;color:var(--text-3);">Same ' + esc(u.make) + ' ' + esc(u.model) + '</div></div>'
          + '<span class="stat-val" style="font-size:24px;color:var(--orange);">' + dupeCount + '</span></a>';
      }
      if (similarCount > 0) {
        h += '<a class="card card-interactive" href="#unit-similar/' + encodeURIComponent(u.stock_num) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
          + '<div><div style="font-size:16px;font-weight:600;">Compare Similar Models</div>'
          + '<div style="font-size:13px;color:var(--text-3);">Same ' + esc(u.veh_type) + ' / ' + esc(u.floor_layout) + '</div></div>'
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
        // Group by status category, then sort by status_days within each group
        var dupeCatOrder = ["Stock", "Dead", "Transit", "Ordered", "Other"];
        var dupeCatColors = { Stock: "var(--green)", Dead: "var(--red)", Transit: "var(--blue)", Ordered: "var(--purple)", Other: "var(--muted)" };
        var dupesByCategory = {};
        for (var i = 0; i < dupes.length; i++) {
          var cat = statusCat(dupes[i].status);
          if (!dupesByCategory[cat]) dupesByCategory[cat] = [];
          dupesByCategory[cat].push(dupes[i]);
        }
        // Sort within each group by status_days descending
        var catKeys = Object.keys(dupesByCategory);
        for (var k = 0; k < catKeys.length; k++) {
          dupesByCategory[catKeys[k]].sort(function (a, b) {
            return (parseInt(b.status_days) || 0) - (parseInt(a.status_days) || 0);
          });
        }

        var h = '<div class="view">';
        h += backBtn("detail/" + encodeURIComponent(u.stock_num), "Unit Detail");
        h += '<div class="section-title">DUPLICATE MAKE &amp; MODELS <span style="color:var(--orange);">(' + dupes.length + ')</span></div>';
        h += '<p style="color:#8899aa;font-size:13px;margin:0 0 12px;">Same ' + esc(u.make) + ' ' + esc(u.model) + ' across the lot</p>';

        for (var ci = 0; ci < dupeCatOrder.length; ci++) {
          var catName = dupeCatOrder[ci];
          var catUnits = dupesByCategory[catName];
          if (!catUnits || catUnits.length === 0) continue;
          var catColor = dupeCatColors[catName] || "var(--muted)";
          h += '<div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:' + catColor + ';margin:12px 0 6px;">' + esc(catName) + ' (' + catUnits.length + ')</div>';
          for (var i = 0; i < catUnits.length; i++) {
            h += renderUnitCard(catUnits[i]);
          }
        }
        if (dupes.length === 0) h += '<div style="color:#8899aa;padding:12px;">No duplicates found</div>';
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
            && o.floor_layout === u.floor_layout;
        });
        similar.sort(function (a, b) {
          return priceNum(a.retail_price) - priceNum(b.retail_price);
        });

        var h = '<div class="view">';
        h += backBtn("detail/" + encodeURIComponent(u.stock_num), "Unit Detail");
        h += '<div class="section-title">COMPARE SIMILAR MODELS <span style="color:var(--blue);">(' + similar.length + ')</span></div>';
        h += '<p style="color:#8899aa;font-size:13px;margin:0 0 12px;">Same ' + esc(u.veh_type) + ' / ' + esc(u.floor_layout) + '</p>';

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
            h += renderUnitCard(pgUnits[j]);
          }
        }
        if (similar.length === 0) h += '<div style="color:#8899aa;padding:12px;">No similar models found</div>';
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

      // Pre-compute primary vehicle type per zone code
      var _allZoneCodes = ["SHR01","SHR02","SHR03","DISP01","DISP02","DISP03","DISP04","DISP05","DISP06","DISP07","DISP08","DISP10","DISP11","OVR01","OVR02","OVR03","OVRB"];
      var zoneVtCounts = {};
      var globalVtCounts = {};
      for (var i = 0; i < units.length; i++) {
        var uLot = (units[i].lot_location || "").toUpperCase().replace("CLE-", "");
        var uVt = (units[i].veh_type || "Other").toUpperCase();
        globalVtCounts[uVt] = (globalVtCounts[uVt] || 0) + 1;
        for (var zi = 0; zi < _allZoneCodes.length; zi++) {
          if (uLot.indexOf(_allZoneCodes[zi]) === 0) {
            if (!zoneVtCounts[_allZoneCodes[zi]]) zoneVtCounts[_allZoneCodes[zi]] = {};
            zoneVtCounts[_allZoneCodes[zi]][uVt] = (zoneVtCounts[_allZoneCodes[zi]][uVt] || 0) + 1;
            break;
          }
        }
      }
      function zonePrimaryVt(code) {
        var vc = zoneVtCounts[code];
        if (!vc) return "";
        var best = "", bestN = 0;
        for (var k in vc) { if (vc[k] > bestN) { best = k; bestN = vc[k]; } }
        return best;
      }
      function zoneHasVt(code, vt) {
        var vc = zoneVtCounts[code];
        return vc && vc[vt] > 0;
      }

      var h = '<div class="view">';

      // View All tile
      h += '<a class="card card-interactive" href="#area-detail/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
        + '<div style="font-size:16px;font-weight:700;">View All Inventory</div>'
        + '<span style="font-size:22px;font-weight:800;color:var(--blue);">' + units.length + '</span></a>';

      // Lot Map quick-access
      h += '<a href="#lot-map" style="display:flex;align-items:center;gap:10px;padding:12px 16px;margin-bottom:12px;background:var(--surface-2);border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;color:#1a1a2e;">'
        + '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="var(--copper)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>'
        + '<div><div style="font-size:16px;font-weight:600;">CLE Lot Map</div>'
        + '<div style="font-size:12px;color:var(--text-3);">View full lot layout</div></div></a>';

      // Type filter dropdown
      var vtKeys = Object.keys(globalVtCounts).sort();
      if (vtKeys.length > 1) {
        h += '<select id="lotTypeFilter" class="form-select" style="margin-bottom:12px;" onchange="App.filterLotCells(this.value)">'
          + '<option value="ALL">All Types (' + units.length + ')</option>';
        for (var vi = 0; vi < vtKeys.length; vi++) {
          h += '<option value="' + esc(vtKeys[vi]) + '">' + esc(vtKeys[vi]) + ' (' + globalVtCounts[vtKeys[vi]] + ')</option>';
        }
        h += '</select>';
      }

      // Showroom grid
      h += '<div class="section-header">Showrooms</div>';
      h += '<div class="lot-grid">';
      var showroomCodes = ["SHR01","SHR02","SHR03"];
      for (var si = 0; si < showroomCodes.length; si++) {
        var scode = showroomCodes[si];
        var scount = 0;
        for (var j = 0; j < units.length; j++) {
          var slot = (units[j].lot_location || "").toUpperCase().replace("CLE-", "");
          if (slot.indexOf(scode) === 0) scount++;
        }
        var sVts = zoneVtCounts[scode] ? Object.keys(zoneVtCounts[scode]).join(",") : "";
        h += '<div class="lot-cell lot-cell-filterable" data-action="zone-detail" data-zone="' + scode + '" data-primary-vt="' + zonePrimaryVt(scode) + '" data-vt-list="' + esc(sVts) + '">'
          + '<div class="lot-cell-code">' + scode + '</div>'
          + '<div class="lot-cell-count">' + scount + '</div>'
          + '<div class="lot-cell-desc">' + esc((ZONE_INFO[scode] || "").split(" — ")[1] || "") + '</div>'
          + '</div>';
      }
      h += '</div>';

      // Display zone grid
      h += '<div class="section-header">Display Zones</div>';
      h += '<div class="lot-grid">';
      var displayCodes = ["DISP01","DISP02","DISP03","DISP04","DISP05","DISP06","DISP07","DISP08","DISP10","DISP11"];
      for (var di = 0; di < displayCodes.length; di++) {
        var code = displayCodes[di];
        var count = 0;
        for (var j = 0; j < units.length; j++) {
          var lot = (units[j].lot_location || "").toUpperCase().replace("CLE-", "");
          if (lot.indexOf(code) === 0) count++;
        }
        var shortCode = code;
        var dVts = zoneVtCounts[code] ? Object.keys(zoneVtCounts[code]).join(",") : "";
        h += '<div class="lot-cell lot-cell-filterable" data-action="zone-detail" data-zone="' + code + '" data-primary-vt="' + zonePrimaryVt(code) + '" data-vt-list="' + esc(dVts) + '">'
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
          var oVts = zoneVtCounts[ocode] ? Object.keys(zoneVtCounts[ocode]).join(",") : "";
          h += '<div class="lot-cell lot-cell-filterable" data-action="zone-detail" data-zone="' + ocode + '" data-primary-vt="' + zonePrimaryVt(ocode) + '" data-vt-list="' + esc(oVts) + '">'
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
      var areaUnits = areaName === "ALL" ? units : units.filter(function (u) {
        return (u.lot_area || "UNASSIGNED") === areaName;
      });
      var displayName = areaName === "ALL" ? "All Inventory" : areaName;

      if (!window._drillViewConfigs) window._drillViewConfigs = {};
      window._drillViewConfigs.areaDetail = {
        preFilter: function(all) { return areaName === "ALL" ? all : all.filter(function(u) { return (u.lot_area || "UNASSIGNED") === areaName; }); },
        groupAndRender: renderGroupedByLotCode
      };

      var h = '<div class="view">';
      h += backBtn("lots", "Lots");
      h += '<div class="zone-banner"><div class="zone-banner-name">' + esc(displayName) + '</div>'
        + '<div class="zone-banner-count">' + areaUnits.length + ' units</div></div>';

      h += renderDrillFilters(areaUnits, "areaDetail", ["location"]);
      h += '<div id="areaDetailResults">' + renderGroupedByLotCode(areaUnits) + '</div>';

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

      if (!window._drillViewConfigs) window._drillViewConfigs = {};
      window._drillViewConfigs.zoneDetail = {
        preFilter: function(all) { return all.filter(function(u) { var lot = (u.lot_location || "").toUpperCase().replace("CLE-", ""); return lot.indexOf(zoneCode) === 0; }); },
        groupAndRender: renderGroupedByStatusCat
      };

      var h = '<div class="view">';
      h += backBtn("lots", "Lots");
      h += '<div class="zone-banner">'
        + '<div class="zone-banner-name">' + zoneCode + '</div>'
        + '<div class="zone-banner-desc">' + esc(ZONE_INFO[zoneCode] || "") + '</div>'
        + '<div class="zone-banner-count">' + zoneUnits.length + '</div>'
        + '</div>';

      h += renderDrillFilters(zoneUnits, "zoneDetail", ["location"]);
      h += '<div id="zoneDetailResults">' + renderGroupedByStatusCat(zoneUnits) + '</div>';

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

      // Register drill config
      if (!window._drillViewConfigs) window._drillViewConfigs = {};
      window._drillViewConfigs.statusUnits = {
        preFilter: function(all) { return all.filter(function(u) { return u.status === statusName; }); },
        groupAndRender: renderFlatCards
      };

      var h = '<div class="view">';
      var cat = statusCat(statusName);
      h += backBtn("status-cat/" + encodeURIComponent(cat), cat);
      h += '<div class="zone-banner"><div class="zone-banner-name">' + esc(statusName) + '</div>'
        + '<div class="zone-banner-count">' + filtered.length + '</div></div>';

      h += renderDrillFilters(filtered, "statusUnits", ["status"]);
      h += '<div id="statusUnitsResults">' + renderFlatCards(filtered) + '</div>';

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

      // Type filter dropdown then manufacturer tiles
      var vtCounts = {};
      for (var vi = 0; vi < units.length; vi++) {
        var vt = (units[vi].veh_type || "Other").toUpperCase();
        vtCounts[vt] = (vtCounts[vt] || 0) + 1;
      }
      var vtSorted = Object.keys(vtCounts).sort();
      if (vtSorted.length > 1) {
        h += '<select class="form-select" style="margin-bottom:12px;" onchange="App.filterMakeCards(this.value)">'
          + '<option value="ALL">All Types (' + units.length + ')</option>';
        for (var vi = 0; vi < vtSorted.length; vi++) {
          h += '<option value="' + esc(vtSorted[vi]) + '">' + esc(vtSorted[vi]) + ' (' + vtCounts[vtSorted[vi]] + ')</option>';
        }
        h += '</select>';
      }
      h += '<div class="section-header">Manufacturers</div>';
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

      if (!window._drillViewConfigs) window._drillViewConfigs = {};
      window._drillViewConfigs.modelUnits = {
        preFilter: function(all) { return all.filter(function(u) { return u.make === make; }); },
        groupAndRender: function(filtered) { return renderGroupedByModel(filtered, make); }
      };

      var h = '<div class="view">';
      h += backBtn("make-detail/" + encodeURIComponent(manufacturer || make), manufacturer || make);
      h += '<div class="zone-banner"><div class="zone-banner-name">' + esc(make) + '</div>'
        + '<div class="zone-banner-count">' + makeUnits.length + ' units</div></div>';

      h += renderDrillFilters(makeUnits, "modelUnits", ["manufacturer"]);
      h += '<div id="modelUnitsResults">' + renderGroupedByModel(makeUnits, make) + '</div>';

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
      h += '<div style="font-size:18px;color:#8899aa;margin-bottom:16px;">Browse inventory by type and floor layout</div>';

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

      if (!window._drillViewConfigs) window._drillViewConfigs = {};
      window._drillViewConfigs.shopLayout = {
        preFilter: function(all) {
          return all.filter(function(u) {
            if (u.veh_type !== vehType || (u.floor_layout || "Unknown") !== floorLayout) return false;
            var st = (u.status || "").toUpperCase();
            for (var t = 0; t < TERMINAL_STATUSES.length; t++) { if (st === TERMINAL_STATUSES[t]) return false; }
            return true;
          });
        },
        groupAndRender: renderGroupedBySubFloorplan
      };

      var h = '<div class="view">';
      h += backBtn("shop-body/" + encodeURIComponent(vehType), vehType);
      h += '<div class="zone-banner" style="background:linear-gradient(135deg, var(--purple-dim), var(--surface-2));">'
        + '<div class="zone-banner-name" style="color:var(--purple);">' + esc(floorLayout) + '</div>'
        + '<div class="zone-banner-desc">' + esc(vehType) + '</div>'
        + '<div class="zone-banner-count">' + filtered.length + '</div></div>';

      h += renderDrillFilters(filtered, "shopLayout", ["type"]);
      h += '<div id="shopLayoutResults">' + renderGroupedBySubFloorplan(filtered) + '</div>';

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
        + '<div class="note-type-icon" style="background:var(--blue-dim);color:var(--blue);"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg></div>'
        + '<div><div class="note-type-label">Coverage Matrix</div>'
        + '<div class="note-type-desc">Model placement gaps — what needs displayed</div></div></a>';

      h += '<a class="note-type-card" href="#zone-map">'
        + '<div class="note-type-icon" style="background:var(--green-dim);color:var(--green);"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg></div>'
        + '<div><div class="note-type-label">Zone Map</div>'
        + '<div class="note-type-desc">Per-zone model grid — what needs reorganized</div></div></a>';

      h += '<a class="note-type-card" href="#overflow-only">'
        + '<div class="note-type-icon" style="background:var(--orange-dim);color:var(--orange);"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg></div>'
        + '<div><div class="note-type-label">Overflow Only</div>'
        + '<div class="note-type-desc">Units in overflow with no showroom or display presence'
        + (ovrOnly > 0 ? ' <span style="color:var(--orange);font-weight:700;">(' + ovrOnly + ')</span>' : '')
        + '</div></div></a>';

      // Replacement Log tile — show active count
      return DB.getActiveReplacements().then(function (activeRepls) {
        h += '<a class="note-type-card" href="#repl-log">'
          + '<div class="note-type-icon" style="background:#451a03;color:var(--orange);"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg></div>'
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
        + '<div style="font-size:18px;color:#8899aa;margin-bottom:8px;">Which models are on display vs. sitting in overflow or missing entirely</div>';

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
        + '<div style="font-size:18px;color:#8899aa;margin-bottom:8px;">Where each model sits across display zones — find what needs reorganized</div>';

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
            + '<td class="cov-num' + (md.showroom > 0 ? ' cov-shr' : '') + '">' + (md.showroom || '') + '</td>';

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

        h += '<div class="note-type-card" data-action="note-form" data-type="verify" style="border-left:3px solid var(--green);">'
          + '<div class="note-type-icon" style="background:var(--green-dim);color:var(--green);"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg></div>'
          + '<div><div class="note-type-label">Verify Location</div>'
          + '<div class="note-type-desc">Confirm or correct a unit\'s lot location</div></div></div>';

        h += '<div class="note-type-card" data-action="note-form" data-type="hole" style="border-left:3px solid var(--orange);">'
          + '<div class="note-type-icon" style="background:var(--orange-dim);color:var(--orange);"><svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="12" cy="12" r="8"/></svg></div>'
          + '<div><div class="note-type-label">Coverage Hole</div>'
          + '<div class="note-type-desc">Flag an empty display spot</div></div></div>';

        h += '<div class="note-type-card" data-action="note-form" data-type="reorg" style="border-left:3px solid var(--blue);">'
          + '<div class="note-type-icon" style="background:var(--blue-dim);color:var(--blue);"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 014-4h14"/><path d="M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg></div>'
          + '<div><div class="note-type-label">Reorganization</div>'
          + '<div class="note-type-desc">Suggest units to move or regroup</div></div></div>';

        // History
        if (history.length > 0) {
          h += '<div class="section-header" style="display:flex;justify-content:space-between;align-items:center;">Recent Notes'
            + '<a data-action="clear-notes-history" style="font-size:13px;color:#8899aa;cursor:pointer;text-decoration:underline;font-weight:400;">Clear</a></div>';
          for (var i = 0; i < history.length; i++) {
            var n = history[i];
            var typeColor = n.entry_type === "Verify" ? "var(--blue)" : n.entry_type === "Hole" ? "var(--orange)" : "var(--red)";
            var typeBg = n.entry_type === "Verify" ? "var(--blue-dim)" : n.entry_type === "Hole" ? "var(--orange-dim)" : "#fde8e8";
            // Format timestamp nicely
            var tsDisplay = n.timestamp || "";
            if (tsDisplay) {
              try {
                var d = new Date(tsDisplay);
                if (!isNaN(d.getTime())) {
                  var months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
                  var hr = d.getHours(), ampm = hr >= 12 ? "PM" : "AM";
                  hr = hr % 12; if (hr === 0) hr = 12;
                  var min = d.getMinutes(); var minStr = min < 10 ? "0" + min : "" + min;
                  tsDisplay = months[d.getMonth()] + " " + d.getDate() + ", " + hr + ":" + minStr + " " + ampm;
                }
              } catch (e) { /* keep raw */ }
            }
            h += '<div class="card" style="padding:12px;background:#f8f9fa;">'
              + '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">'
              + '<span style="display:inline-block;padding:3px 10px;border-radius:4px;font-size:12px;font-weight:700;background:' + typeBg + ';color:' + typeColor + ';">' + esc(n.entry_type) + '</span>'
              + '<span style="font-size:12px;color:var(--text-3);">' + esc(tsDisplay) + '</span>'
              + '</div>'
              + (n.stock ? '<div style="font-size:18px;font-weight:800;color:var(--text);">Stk# ' + esc(n.stock) + '</div>' : '')
              + (n.description ? '<div style="font-size:14px;color:var(--text-2);margin-top:4px;line-height:1.4;">' + esc(n.description) + '</div>' : '')
              + (n.user ? '<div style="font-size:12px;color:var(--text-3);margin-top:6px;">' + esc(n.user) + '</div>' : '')
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
      var prefix = '<div class="view">' + backBtn("notes", "Notes");
      var suffix = '</div>';
      if (type === "verify") {
        return prefix + renderVerifyForm(unit, stockNum) + suffix;
      } else if (type === "hole") {
        return renderHoleForm().then(function (formHtml) {
          return prefix + formHtml + suffix;
        });
      } else {
        return prefix + renderReorgForm(unit, stockNum) + suffix;
      }
    });
  }

  function renderVerifyForm(unit, stockNum) {
    var h = '<div class="card"><div class="card-title">Verify Unit Location</div>'
      + '<form id="noteForm" data-type="verify">';

    h += renderUserField();

    h += '<label class="form-label">Stock #</label>'
      + '<input class="form-input" type="text" name="stock" value="' + esc(stockNum || "") + '" placeholder="Enter stock number" required id="noteStock" autocapitalize="characters">';
    h += '<div id="noteStockResults"></div>';

    // Unit preview (auto-populated on lookup)
    if (unit) {
      h += '<div id="unitPreview">' + renderUnitPreviewCard(unit) + '</div>';
    } else {
      h += '<div id="unitPreview"></div>';
    }

    // Verification section (shown after unit lookup if no stock pre-filled)
    var formVis = unit ? '' : ' id="verifyFormBody" style="display:none;"';
    h += '<div' + formVis + '>';

    h += '<label class="form-label">Is the unit where the system says?</label>'
      + '<div class="form-radio-group">'
      + '<label class="form-radio" onclick="App.selectRadio(this)"><input type="radio" name="verified" value="Yes" required><span style="font-weight:600;color:var(--green);">Yes — Correct</span></label>'
      + '<label class="form-radio" onclick="App.selectRadio(this)"><input type="radio" name="verified" value="No"><span style="font-weight:600;color:var(--orange);">No — Wrong Spot</span></label>'
      + '<label class="form-radio" onclick="App.selectRadio(this)"><input type="radio" name="verified" value="Not Found"><span style="font-weight:600;color:#C8102E;">Not Found on Lot</span></label>'
      + '</div>';

    h += '<label class="form-label">Actual Location <span style="font-weight:400;color:var(--text-3);">(if different)</span></label>'
      + renderZoneSelect("actual_lot", false);
    h += renderSpotDetails();

    h += '<label class="form-label">Notes <span style="font-weight:400;color:var(--text-3);">(optional)</span></label>'
      + '<textarea class="form-textarea" name="notes" placeholder="Any additional details..."></textarea>';

    h += '<button class="btn btn-green mt-8" type="submit">Submit Verification</button>';
    h += '</div>'; // close verifyFormBody
    h += '</form></div>';
    return h;
  }

  function renderHoleForm() {
    return DB.getAllUnits().then(function (units) {
      // Build type and make options from active inventory
      var typeSet = {}, makesByType = {};
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        var st = (u.status || "").toUpperCase();
        var isT = false;
        for (var t = 0; t < TERMINAL_STATUSES.length; t++) { if (st === TERMINAL_STATUSES[t]) { isT = true; break; } }
        if (isT) continue;
        var vt = u.veh_type || "OTHER";
        var mk = u.make || "";
        typeSet[vt] = true;
        if (!makesByType[vt]) makesByType[vt] = {};
        if (mk) makesByType[vt][mk] = true;
      }
      var typeKeys = Object.keys(typeSet).sort();
      var allMakes = {};
      for (var vt in makesByType) { for (var mk in makesByType[vt]) allMakes[mk] = true; }
      var makeKeys = Object.keys(allMakes).sort();

      var h = '<div class="card"><div class="card-title">Report Coverage Hole</div>'
        + '<form id="noteForm" data-type="hole">';

      h += renderUserField();

      // Zone (display/showroom only)
      h += '<label class="form-label">Zone</label>'
        + renderZoneSelect("zone", true, true);  // displayOnly = true
      h += renderSpotDetails();

      // Type dropdown
      h += '<label class="form-label">Vehicle Type Missing</label>'
        + '<select class="form-select" name="missing_veh_type" id="holeTypeSelect" onchange="App.filterHoleMakes(this.value)">'
        + '<option value="">Select type...</option>';
      for (var ti = 0; ti < typeKeys.length; ti++) {
        h += '<option value="' + esc(typeKeys[ti]) + '">' + esc(typeKeys[ti]) + '</option>';
      }
      h += '</select>';

      // Make dropdown (populated based on type selection)
      h += '<label class="form-label">Make/Brand Missing</label>'
        + '<select class="form-select" name="missing_make" id="holeMakeSelect">'
        + '<option value="">Select make...</option>';
      for (var mi = 0; mi < makeKeys.length; mi++) {
        h += '<option value="' + esc(makeKeys[mi]) + '" data-vt="' + esc(_getMakeType(makeKeys[mi], units)) + '">' + esc(makeKeys[mi]) + '</option>';
      }
      h += '</select>';

      // Nearby unit reference
      h += '<label class="form-label">Nearby Stock # <span style="font-weight:400;color:var(--text-3);">(helps locate the hole)</span></label>'
        + '<input class="form-input" type="text" name="nearby_units" id="holeNearbyStock" placeholder="e.g. 219464" autocapitalize="characters">';
      h += '<div id="holeNearbyPreview"></div>';

      // Description
      h += '<label class="form-label">Description</label>'
        + '<textarea class="form-textarea" name="description" required placeholder="How many empty spots? Any other details about the location."></textarea>';

      h += '<label class="form-label">Notes <span style="font-weight:400;color:var(--text-3);">(optional)</span></label>'
        + '<textarea class="form-textarea" name="notes" placeholder="Additional context..."></textarea>';

      // Fulfillment suggestion
      h += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">';
      h += '<label class="form-label" style="margin-bottom:8px;display:flex;align-items:center;gap:10px;">'
        + '<input type="checkbox" id="holeFillToggle" onchange="App.toggleHoleFillSuggestion(this.checked)" style="width:18px;height:18px;flex-shrink:0;">'
        + '<span style="font-weight:700;">Suggest a unit to fill this hole?</span></label>';
      h += '<div id="holeFillSection" style="display:none;">';
      h += '<div style="font-size:13px;color:var(--text-3);margin-bottom:8px;">Overflow units shown first. Tap a tile to select it as your suggested fill.</div>';
      h += '<div id="holeFillResults"></div>';
      h += '<div id="holeFillSelected" style="display:none;margin-top:8px;"></div>';
      h += '<input type="hidden" name="suggested_fill_stock" id="suggestedFillStock" value="">';
      h += '</div></div>';

      h += '<button class="btn btn-orange mt-8" type="submit">Submit Hole Report</button>';
      h += '</form></div>';
      return h;
    });
  }

  function _getMakeType(make, units) {
    for (var i = 0; i < units.length; i++) {
      if (units[i].make === make && units[i].veh_type) return units[i].veh_type;
    }
    return "";
  }

  function renderReorgForm(unit, stockNum) {
    var h = '<div class="card"><div class="card-title">Suggest Reorganization</div>'
      + '<form id="noteForm" data-type="reorg">';

    h += renderUserField();

    h += '<label class="form-label">Stock # to Move</label>'
      + '<input class="form-input" type="text" name="stock" value="' + esc(stockNum || "") + '" placeholder="Enter stock number" required id="reorgStock" autocapitalize="characters">';
    h += '<div id="reorgStockResults"></div>';

    // Unit preview (populated by auto-lookup)
    if (unit) {
      var condBadge = '';
      var cond = (unit.condition || "").toUpperCase();
      if (cond === "USED") condBadge = '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:#fde8e8;color:#C8102E;margin-left:6px;">USED</span>';
      else if (cond === "DEMO" || cond === "D") condBadge = '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:var(--blue-dim);color:var(--blue);margin-left:6px;">DEMO</span>';

      h += '<div class="card" style="margin-bottom:12px;padding:12px;" id="reorgUnitPreview">'
        + '<div style="font-size:18px;font-weight:700;">' + esc(unit.year || "") + ' ' + esc(unit.make || "") + ' ' + esc(unit.model || "") + condBadge + '</div>'
        + (unit.manufacturer ? '<div style="font-size:11px;color:var(--text-3);text-transform:uppercase;letter-spacing:0.5px;margin-top:1px;">' + esc(unit.manufacturer) + '</div>' : '')
        + '<div style="font-size:13px;color:var(--text-2);margin-top:4px;">VIN: ' + esc(unit.vin || "") + '</div>'
        + '<div style="font-size:14px;margin-top:6px;">Current: <span style="font-weight:700;color:var(--blue);">' + esc(unit.lot_location || "NONE") + '</span>'
        + (unit.lot_area ? ' (' + esc(unit.lot_area) + ')' : '') + '</div>'
        + '<div style="font-size:13px;color:var(--text-2);margin-top:4px;">Status: ' + esc(unit.status || "") + ' | Type: ' + esc(unit.veh_type || "") + ' | ' + esc(unit.floor_layout || "") + '</div>'
        + '</div>';
    } else {
      h += '<div id="reorgUnitPreview" style="margin-bottom:12px;"></div>';
    }

    // Rest of form (shown after unit lookup if no stock pre-filled, or immediately if pre-filled)
    var formVis = unit ? '' : ' id="reorgFormBody" style="display:none;"';
    h += '<div' + formVis + '>';

    h += '<label class="form-label">From Zone</label>'
      + renderZoneSelect("zone_from", false);

    h += '<label class="form-label">To Zone</label>'
      + renderZoneSelect("zone_to", false);
    h += renderSpotDetails();

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

    // ── Backfill section ──
    h += '<div style="margin-top:16px;padding-top:16px;border-top:1px solid var(--border);">';
    h += '<label class="form-label" style="margin-bottom:8px;">'
      + '<input type="checkbox" id="reorgBackfillToggle" onchange="document.getElementById(\'reorgBackfillSection\').style.display=this.checked?\'block\':\'none\';" style="margin-right:8px;width:18px;height:18px;vertical-align:middle;">'
      + '<span style="font-weight:700;">Backfill the vacated spot?</span></label>';
    h += '<div id="reorgBackfillSection" style="display:none;">';
    h += '<label class="form-label">Backfill Stock #</label>'
      + '<input class="form-input" type="text" name="backfill_stock" id="reorgBackfillStock" placeholder="Enter stock # to use as replacement" autocapitalize="characters">';
    h += '<div id="reorgBackfillPreview" style="margin:8px 0;"></div>';
    h += '<div style="margin-top:8px;font-size:13px;color:var(--text-3);">This unit will be moved into the spot vacated by the unit above. Both moves will be logged together.</div>';
    h += '</div></div>';

    h += '<label class="form-label" style="margin-top:12px;">Notes (optional)</label>'
      + '<textarea class="form-textarea" name="notes" placeholder="Additional context..."></textarea>';

    h += '<button class="btn btn-blue mt-8" type="submit">Submit Suggestion</button>';
    h += '</div>'; // close reorgFormBody
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
        + '<div class="note-type-icon" style="background:var(--red-dim);color:var(--red);"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>'
        + '<div><div class="note-type-label">Status &amp; Location</div>'
        + '<div class="note-type-desc">Dead units on display, stale statuses, missing lot codes'
        + (critical > 0 ? ' <span style="color:var(--red);font-weight:700;">(' + critical + ' critical)</span>' : '')
        + '</div></div></a>';

      h += '<a class="note-type-card" href="#hierarchy">'
        + '<div class="note-type-icon" style="background:var(--purple-dim);color:var(--purple);"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></div>'
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
        + '<div style="font-size:18px;color:#8899aa;margin-bottom:12px;">Dead units on display, stale statuses, missing lot codes</div>';

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
  function _overflowPreFilter(units) {
    var active = [];
    for (var i = 0; i < units.length; i++) {
      var st = (units[i].status || "").toUpperCase();
      var isT = false;
      for (var t = 0; t < TERMINAL_STATUSES.length; t++) { if (st === TERMINAL_STATUSES[t]) { isT = true; break; } }
      if (!isT) active.push(units[i]);
    }
    var mmInShr = {}, mmInDsp = {}, ovrUnits = [];
    for (var i = 0; i < active.length; i++) {
      var u = active[i];
      var mk = (u.make || "") + "|" + (u.model || "");
      var b = lotBucket(u.lot_location || "");
      if (b === "SHOWROOM") mmInShr[mk] = true;
      else if (b !== "OVERFLOW" && b !== "OTHER") mmInDsp[mk] = true;
      else if (b === "OVERFLOW") ovrUnits.push(u);
    }
    var filtered = [];
    for (var i = 0; i < ovrUnits.length; i++) {
      var mk = (ovrUnits[i].make || "") + "|" + (ovrUnits[i].model || "");
      if (!mmInShr[mk] && !mmInDsp[mk]) filtered.push(ovrUnits[i]);
    }
    filtered.sort(function (a, b) {
      var cmp = (a.make || "").localeCompare(b.make || "");
      if (cmp !== 0) return cmp;
      cmp = (a.model || "").localeCompare(b.model || "");
      if (cmp !== 0) return cmp;
      return (parseInt(b.age) || 0) - (parseInt(a.age) || 0);
    });
    return filtered;
  }

  function overflowOnlyView() {
    return DB.getAllUnits().then(function (units) {
      var filtered = _overflowPreFilter(units);

      if (!window._drillViewConfigs) window._drillViewConfigs = {};
      window._drillViewConfigs.overflowOnly = {
        preFilter: _overflowPreFilter,
        groupAndRender: renderGroupedByMake
      };

      var h = '<div class="view">';
      h += backBtn("coverage", "Coverage");
      h += '<div class="section-header" style="margin-top:0;">Overflow Only</div>'
        + '<div style="font-size:18px;color:#8899aa;margin-bottom:12px;">Units in overflow with no showroom or display presence — candidates to move onto the floor</div>';

      h += '<div class="stats-row">'
        + '<div class="stat-pill"><div class="stat-val text-orange">' + filtered.length + '</div><div class="stat-label">Units</div></div>'
        + '</div>';

      h += renderDrillFilters(filtered, "overflowOnly", []);
      h += '<div id="overflowOnlyResults">' + renderGroupedByMake(filtered) + '</div>';

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
        + '<div style="font-size:18px;color:#8899aa;margin-bottom:12px;">Missing required fields and inconsistent product relationships</div>';

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

      unitList.sort(function (a, b) {
        var cmp = (a.make || "").localeCompare(b.make || "");
        if (cmp !== 0) return cmp;
        cmp = (a.model || "").localeCompare(b.model || "");
        if (cmp !== 0) return cmp;
        return (a.stock_num || "").localeCompare(b.stock_num || "");
      });

      if (!window._drillViewConfigs) window._drillViewConfigs = {};
      window._drillViewConfigs.hierarchyDetail = {
        preFilter: function(all) {
          var d = buildHierarchyData(all);
          return d.missingByType[label] || d.consistByType[label] || [];
        },
        groupAndRender: renderGroupedByMake
      };

      var h = '<div class="view">';
      h += backBtn("hierarchy", "Hierarchy");
      h += '<div class="section-header" style="margin-top:0;">' + esc(label) + '</div>'
        + '<div style="font-size:18px;color:#8899aa;margin-bottom:12px;">'
        + unitList.length + ' unit' + (unitList.length !== 1 ? 's' : '') + ' affected</div>';

      h += renderDrillFilters(unitList, "hierarchyDetail", []);
      h += '<div id="hierarchyDetailResults">' + renderGroupedByMake(unitList) + '</div>';

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

      // All sale pending (any status_days)
      var allSP = [];
      for (var i = 0; i < units.length; i++) {
        if ((units[i].status || "").toUpperCase() === "SALE PENDING") allSP.push(units[i]);
      }

      var h = '<div class="section-title">INVENTORY ACTIVITY</div>';
      h += '<p style="color:#8899aa;font-size:13px;margin:0 0 16px;">Data as of ' + esc(exportedAt) + '</p>';

      // ── KPI pills ──
      h += '<div class="stats-row">';
      h += '<div class="stat-pill"><div class="stat-val" style="color:var(--orange);">' + allSP.length + '</div><div class="stat-label">SALE PEND</div></div>';
      h += '<div class="stat-pill"><div class="stat-val" style="color:var(--green);">' + soldToday.length + '</div><div class="stat-label">SOLD</div></div>';
      h += '<div class="stat-pill"><div class="stat-val" style="color:var(--blue);">' + incoming.length + '</div><div class="stat-label">INCOMING</div></div>';
      h += '</div>';

      // ── Sale Pending section ──
      h += '<div class="section-title" style="margin-top:16px;">SALE PENDING</div>';

      // New Today
      h += '<a class="card card-interactive" href="#sales-section/pending/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
        + '<div><div style="font-size:18px;font-weight:600;">New Today</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Units entering sale pending today</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:var(--orange);">' + spToday.length + '</span></a>';

      // All Sale Pending
      h += '<a class="card card-interactive" href="#sales-section/all-pending/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
        + '<div><div style="font-size:18px;font-weight:600;">All Sale Pending</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Every unit in sale pending status</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:var(--orange);">' + allSP.length + '</span></a>';

      // Pending in Display/Showroom
      h += '<a class="card card-interactive" href="#sales-section/pending-display/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;border-left:3px solid var(--orange);">'
        + '<div><div style="font-size:18px;font-weight:600;">Pending in Display</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Need to pull &amp; replace from overflow</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:var(--orange);">' + spInDisplay.length + '</span></a>';

      // ── Other Activity ──
      h += '<div class="section-title" style="margin-top:20px;">OTHER ACTIVITY</div>';

      // Retail Ordered Today
      h += '<a class="card card-interactive" href="#sales-section/retail-ordered/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
        + '<div><div style="font-size:18px;font-weight:600;">Retail Ordered Today</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Customer orders placed today</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:#a855f7;">' + roToday.length + '</span></a>';

      // Retail Sold tile
      h += '<a class="card card-interactive" href="#sales-section/sold/ALL" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;">'
        + '<div><div style="font-size:18px;font-weight:600;">Retail Sold Today</div>'
        + '<div style="font-size:13px;color:var(--text-3);margin-top:4px;">Deals closed today</div></div>'
        + '<span class="stat-val" style="font-size:28px;color:var(--green);">' + soldToday.length + '</span></a>';

      // (Sold Not Delivered removed — redundant with Sale Pending)

      // ── Incoming section ──
      h += '<div class="section-title" style="margin-top:20px;">INBOUND</div>';

      // Incoming overview tile
      h += '<a class="card card-interactive" href="#incoming" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
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
    } else if (section === "all-pending") {
      return DB.getAllUnits().then(function (units) {
        var results = [];
        for (var i = 0; i < units.length; i++) {
          if ((units[i].status || "").toUpperCase() === "SALE PENDING") results.push(units[i]);
        }
        return results;
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
      var labels = { "pending": "New Today", "all-pending": "All Sale Pending", "pending-display": "Pending in Display/Showroom", "retail-ordered": "Retail Ordered Today", "sold": "Retail Sold Today" };
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

    // Type + Deal Status filter chips for sale pending sections
    var isPending = (section === "pending" || section === "all-pending" || section === "pending-display");
    if (isPending && units.length > 3) {
      // Collect filter options
      var typeSet = {}, dealSet = {}, mfrSet = {}, condSet = {};
      for (var fi = 0; fi < units.length; fi++) {
        var vt = (units[fi].veh_type || "OTHER").toUpperCase();
        typeSet[vt] = (typeSet[vt] || 0) + 1;
        var ds = units[fi].deal_status || "";
        if (ds) dealSet[ds] = (dealSet[ds] || 0) + 1;
        var mfr = units[fi].manufacturer || "Unknown";
        mfrSet[mfr] = (mfrSet[mfr] || 0) + 1;
        var cond = (units[fi].condition || "New").toUpperCase();
        condSet[cond] = (condSet[cond] || 0) + 1;
      }

      h += '<div class="card" style="padding:12px;margin-bottom:8px;">';

      // Type chip filters
      var typeKeys = Object.keys(typeSet).sort();
      if (typeKeys.length > 1) {
        h += '<div style="margin-bottom:6px;color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Type</div>';
        h += '<div class="chip-bar" id="spTypeFilters">';
        h += '<span class="chip chip-active" data-sp-type="ALL" onclick="App.filterSPList(this,\'type\')">All</span>';
        for (var ti = 0; ti < typeKeys.length; ti++) {
          h += '<span class="chip" data-sp-type="' + typeKeys[ti] + '" onclick="App.filterSPList(this,\'type\')">' + esc(typeKeys[ti]) + ' (' + typeSet[typeKeys[ti]] + ')</span>';
        }
        h += '</div>';
      }

      // Manufacturer dropdown
      var mfrKeys = Object.keys(mfrSet).sort();
      if (mfrKeys.length > 1) {
        h += '<div style="margin:8px 0 4px;color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Manufacturer</div>';
        h += '<select class="form-select" id="spMfrFilter" onchange="App.filterSPList(this,\'mfr\')" style="margin-bottom:4px;">';
        h += '<option value="ALL">All Manufacturers</option>';
        for (var mi = 0; mi < mfrKeys.length; mi++) {
          h += '<option value="' + esc(mfrKeys[mi]) + '">' + esc(mfrKeys[mi]) + ' (' + mfrSet[mfrKeys[mi]] + ')</option>';
        }
        h += '</select>';
      }

      // Condition filter
      var condKeys = Object.keys(condSet).sort();
      if (condKeys.length > 1) {
        h += '<div style="margin:8px 0 4px;color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Condition</div>';
        h += '<select class="form-select" id="spCondFilter" onchange="App.filterSPList(this,\'cond\')" style="margin-bottom:4px;">';
        h += '<option value="ALL">All (New & Used)</option>';
        for (var ci = 0; ci < condKeys.length; ci++) {
          h += '<option value="' + esc(condKeys[ci]) + '">' + esc(condKeys[ci]) + ' (' + condSet[condKeys[ci]] + ')</option>';
        }
        h += '</select>';
      }

      // Deal status dropdown
      var dealKeys = Object.keys(dealSet).sort();
      if (dealKeys.length > 0) {
        h += '<div style="margin:8px 0 4px;color:var(--text-3);font-size:11px;text-transform:uppercase;letter-spacing:1px;">Deal Status</div>';
        h += '<select class="form-select" id="spDealFilter" onchange="App.filterSPList(this,\'deal\')">';
        h += '<option value="ALL">All Deal Statuses</option>';
        for (var di = 0; di < dealKeys.length; di++) {
          h += '<option value="' + esc(dealKeys[di]) + '">' + esc(dealKeys[di]) + ' (' + dealSet[dealKeys[di]] + ')</option>';
        }
        h += '</select>';
      }

      h += '</div>';
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
      var statusColors = { "pending": "var(--orange)", "all-pending": "var(--orange)", "pending-display": "var(--orange)", "retail-ordered": "#a855f7", "sold": "var(--green)" };
      var statusLabels = { "pending": "PENDING", "all-pending": "PENDING", "pending-display": "PENDING", "retail-ordered": "RETAIL ORD", "sold": "SOLD" };
      var statusColor = statusColors[section] || "var(--text-2)";
      var statusLabel = statusLabels[section] || (u.status || "");

      var spTypeAttr = isPending ? ' data-unit-type="' + esc((u.veh_type || "OTHER").toUpperCase()) + '"' : '';
      var spDealAttr = isPending ? ' data-unit-deal="' + esc(u.deal_status || "") + '"' : '';
      var spMfrAttr = isPending ? ' data-unit-mfr="' + esc(u.manufacturer || "Unknown") + '"' : '';
      var spCondAttr = ' data-unit-cond="' + esc((u.condition || "New").toUpperCase()) + '"';

      // Status days conditional formatting for pending
      var sDays = parseInt(u.status_days) || 0;
      var sDaysColor = isPending ? (sDays >= 8 ? '#C8102E' : sDays >= 3 ? 'var(--orange)' : 'var(--green)') : 'var(--text-3)';

      // Deal status conditional formatting
      var dsText = u.deal_status || "";
      var dsUpper = dsText.toUpperCase();
      var dsBg = '#e9ecef'; var dsFg = 'var(--text-2)';
      // Dark green: funded / complete / delivered (deal closed)
      if (dsUpper.indexOf("FUNDED") !== -1 || dsUpper.indexOf("COMPLETE") !== -1 || dsUpper.indexOf("DELIVERED") !== -1) { dsBg = '#c7f0da'; dsFg = '#166534'; }
      // Green: approved / scheduled (moving toward delivery — includes "Delivery Scheduled" and "Approved to be Scheduled")
      else if (dsUpper.indexOf("APPROVED") !== -1 || dsUpper.indexOf("SCHEDULED") !== -1) { dsBg = 'var(--green-dim)'; dsFg = 'var(--green)'; }
      // Orange: active mid-stage
      else if (dsUpper.indexOf("PENDING") !== -1 || dsUpper.indexOf("SUBMITTED") !== -1 || dsUpper.indexOf("IN PROGRESS") !== -1 || dsUpper.indexOf("REVIEWING") !== -1) { dsBg = 'var(--orange-dim)'; dsFg = 'var(--orange)'; }
      // Amber: uncertain / conditional
      else if (dsUpper.indexOf("CONDITIONAL") !== -1 || dsUpper.indexOf("COUNTER") !== -1 || dsUpper.indexOf("WAITING") !== -1 || dsUpper.indexOf("NEEDS") !== -1) { dsBg = 'var(--yellow-dim)'; dsFg = 'var(--copper)'; }
      // Red: declined / cancelled
      else if (dsUpper.indexOf("DECLINED") !== -1 || dsUpper.indexOf("DENIED") !== -1 || dsUpper.indexOf("CANCEL") !== -1) { dsBg = '#fde8e8'; dsFg = '#C8102E'; }

      // Location highlighting
      var locArea = (u.lot_area || "").toUpperCase();
      var locInDisplay = (locArea === "DISPLAY" || locArea === "SHOWROOM");
      var locBorderColor = locInDisplay ? 'var(--orange)' : 'var(--border)';

      h += '<a class="card card-interactive sp-unit-card" href="#' + detailTarget + '"' + spTypeAttr + spDealAttr + spMfrAttr + spCondAttr + ' style="border-left:3px solid ' + locBorderColor + ';">';

      // Top row: unit info + status days
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';
      h += '<div style="flex:1;">';
      h += '<div style="font-size:16px;font-weight:700;">' + esc(u.year || "") + ' ' + esc(u.make || "") + ' ' + esc(u.model || "") + '</div>';
      h += '<div style="font-size:13px;color:var(--text-3);margin-top:3px;">' + esc(u.stock_num || "") + ' · ' + esc(u.veh_type || "") + (u.floor_layout ? ' · ' + esc(u.floor_layout) : '') + '</div>';
      h += '</div>';
      h += '<div style="text-align:right;min-width:55px;">';
      if (isPending && sDays != null) {
        h += '<div style="font-size:20px;font-weight:800;color:' + sDaysColor + ';">' + sDays + 'd</div>';
        h += '<div style="font-size:10px;color:var(--text-3);text-transform:uppercase;">Pending</div>';
      }
      if (u.retail_price) {
        var p = parseFloat(u.retail_price) || 0;
        if (p > 0) h += '<div style="font-size:12px;color:var(--text-3);margin-top:2px;">$' + Math.round(p/1000) + 'K</div>';
      }
      h += '</div></div>';

      // Bottom row: badges
      h += '<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;align-items:center;">';

      // Status badge
      h += '<span class="status-badge status-pending" style="font-size:11px;">' + statusLabel + '</span>';

      // Location badge (highlighted if in display/showroom)
      if (u.lot_location) {
        var locBadgeBg = locInDisplay ? 'var(--orange-dim)' : '#e9ecef';
        var locBadgeFg = locInDisplay ? 'var(--orange)' : 'var(--text-2)';
        h += '<span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;background:' + locBadgeBg + ';color:' + locBadgeFg + ';">' + esc(u.lot_location) + '</span>';
      }

      // Deal status badge (conditionally formatted)
      if (isPending && dsText) {
        h += '<span style="display:inline-block;padding:3px 8px;border-radius:4px;font-size:11px;font-weight:700;background:' + dsBg + ';color:' + dsFg + ';">' + esc(dsText) + '</span>';
      }

      // Salesman
      if (isPending && u.hold_salesman) {
        h += '<span style="font-size:11px;color:var(--text-3);">' + esc(u.hold_salesman) + '</span>';
      }

      // Condition badge (Used/Demo)
      var condUpper = (u.condition || "").toUpperCase();
      if (condUpper === "USED") {
        h += '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:#fde8e8;color:#C8102E;">USED</span>';
      } else if (condUpper === "DEMO" || condUpper === "D") {
        h += '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:var(--blue-dim);color:var(--blue);">DEMO</span>';
      }

      h += '</div></a>';
    }
    return h;
  }

  // ══════════════════════════════════════════════════════════════════
  // LOT MAP VIEW
  // ══════════════════════════════════════════════════════════════════

  function lotMapView() {
    var h = '<div class="section-title">CLE LOT MAP</div>';
    h += '<p style="color:#8899aa;font-size:13px;margin:0 0 12px;">Pinch to zoom · Swipe to pan</p>';

    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-weight:600;margin-bottom:8px;color:#c8cdd3;">Page 1 — Overview</div>';
    h += '<div style="overflow:auto;-webkit-overflow-scrolling:touch;background:#fff;border-radius:10px;padding:8px;border:1px solid var(--border);">';
    h += '<img src="img/lot-map-p1.jpg" alt="CLE Lot Map Page 1" style="display:block;width:100%;min-width:600px;height:auto;" />';
    h += '</div></div>';

    h += '<div style="margin-bottom:16px;">';
    h += '<div style="font-weight:600;margin-bottom:8px;color:var(--text-2);">Page 2 — Legend & Codes</div>';
    h += '<div style="overflow:auto;-webkit-overflow-scrolling:touch;background:#fff;border-radius:10px;padding:8px;border:1px solid var(--border);">';
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
  // ALL INVENTORY VIEW — full inventory with multi-select filters
  // ══════════════════════════════════════════════════════════════════

  function allInventoryView(filterStr) {
    return DB.getAllUnits().then(function (units) {
      // Parse pre-filters from route param (e.g. "year=2025" or "dead-display=1")
      var preFilter = {};
      if (filterStr) {
        var parts = filterStr.split("&");
        for (var p = 0; p < parts.length; p++) {
          var kv = parts[p].split("=");
          if (kv.length === 2) preFilter[kv[0]] = kv[1];
        }
      }

      // Collect filter options
      var locationSet = {}, typeSet = {}, statusSet = {}, mfrSet = {};
      for (var i = 0; i < units.length; i++) {
        var u = units[i];
        var loc = u.lot_area || "Unassigned";
        var vt = u.veh_type || "Other";
        var st = u.status || "Unknown";
        var mfr = u.manufacturer || "Unknown";
        locationSet[loc] = (locationSet[loc] || 0) + 1;
        typeSet[vt] = (typeSet[vt] || 0) + 1;
        statusSet[st] = (statusSet[st] || 0) + 1;
        mfrSet[mfr] = (mfrSet[mfr] || 0) + 1;
      }

      var h = '<div class="view">';
      h += backBtn("home", "Home");

      // Contextual banner
      var bannerTitle = "All Inventory";
      if (preFilter.year) bannerTitle = preFilter.year + " Models in Stock";
      else if (preFilter["dead-display"]) bannerTitle = "Dead in Display";
      h += '<div class="zone-banner"><div class="zone-banner-name">' + esc(bannerTitle) + '</div>'
        + '<div class="zone-banner-count">' + units.length + ' units</div></div>';

      // Multi-select filters (using shared renderMultiSelect)
      var aiFn = "App.filterAllInventory()";
      var typePre = {}; if (preFilter.type) typePre[preFilter.type] = true;
      var statusPre = {}; if (preFilter.status) statusPre[preFilter.status] = true;

      h += '<div class="card" style="margin-bottom:8px;">';
      h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">';
      h += renderMultiSelect("aiFilterLocation", "Location", locationSet, aiFn);
      h += renderMultiSelect("aiFilterType", "Type", typeSet, aiFn, typePre);
      h += renderMultiSelect("aiFilterStatus", "Status", statusSet, aiFn, statusPre);
      h += renderMultiSelect("aiFilterMfr", "Manufacturer", mfrSet, aiFn);
      h += '</div></div>';

      // Pre-filtered unit list
      var filtered = units;

      // Handle special pre-filters
      if (preFilter.year) {
        filtered = filtered.filter(function(u) { return String(u.year) === preFilter.year; });
      }
      if (preFilter["dead-display"]) {
        var DEAD_STATUSES = ["IN SERVICE","AWAITING PARTS","DAMAGED","DRIVER DAMAGE","LOT DAMAGE","INSURANCE CLAIM"];
        filtered = filtered.filter(function(u) {
          var st = (u.status || "").toUpperCase();
          var area = (u.lot_area || "").toUpperCase();
          var isDead = false;
          for (var d = 0; d < DEAD_STATUSES.length; d++) { if (st === DEAD_STATUSES[d]) { isDead = true; break; } }
          return isDead && (area === "DISPLAY" || area === "SHOWROOM");
        });
      }

      // Sort by make then model
      filtered.sort(function(a, b) {
        var cmp = (a.make || "").localeCompare(b.make || "");
        return cmp !== 0 ? cmp : (a.model || "").localeCompare(b.model || "");
      });

      h += '<div id="aiResults">';
      h += '<div style="margin-bottom:8px;font-size:13px;color:var(--text-3);">' + filtered.length + ' units shown</div>';
      var maxShow = Math.min(filtered.length, 100);
      for (var i = 0; i < maxShow; i++) {
        h += renderUnitCard(filtered[i]);
      }
      if (filtered.length > 100) {
        h += '<div style="text-align:center;padding:12px;font-size:14px;color:var(--text-3);">Showing 100 of ' + filtered.length + ' — use filters to narrow</div>';
      }
      h += '</div>';

      h += '</div>';
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
    var h = '';

    // Header
    h += '<div style="text-align:center;margin-bottom:20px;">';
    h += '<div style="font-size:22px;font-weight:800;color:var(--text-1);margin-bottom:4px;">CLE Lot Manager</div>';
    h += '<div style="font-size:13px;color:var(--text-3);">User Guide &amp; Feature Reference</div>';
    h += '</div>';

    // ── Table of Contents ──
    h += '<div class="card" style="margin-bottom:16px;">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">QUICK LINKS</div>';
    var tocItems = [
      ["#help-search", "Search & Lookup"],
      ["#help-home", "Home Tab & KPIs"],
      ["#help-browse", "Browsing Inventory"],
      ["#help-unit", "Unit Detail Pages"],
      ["#help-activity", "Activity & Sales"],
      ["#help-replacement", "Unit Replacement Tool"],
      ["#help-notes", "Field Notes"],
      ["#help-coverage", "Coverage & Analysis"],
      ["#help-audit", "Data Audits"],
      ["#help-refresh", "Data Refresh"],
    ];
    for (var t = 0; t < tocItems.length; t++) {
      h += '<div style="padding:6px 0;border-bottom:1px solid var(--border);">'
        + '<a href="' + tocItems[t][0] + '" onclick="event.preventDefault();var el=document.getElementById(\'' + tocItems[t][0].substring(1) + '\');if(el)el.scrollIntoView({behavior:\'smooth\'});" style="font-size:14px;color:var(--blue);text-decoration:none;font-weight:600;">'
        + (t + 1) + '. ' + tocItems[t][1] + '</a></div>';
    }
    h += '</div>';

    // Helper for section headers
    function secHeader(id, num, title) {
      return '<div id="' + id + '" style="margin-top:24px;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--blue);">'
        + '<span style="font-size:16px;font-weight:800;color:var(--text-1);">' + num + '. ' + title + '</span></div>';
    }

    function stepCard(num, title, detail) {
      return '<div style="display:flex;gap:10px;margin-bottom:8px;align-items:flex-start;">'
        + '<div style="min-width:28px;height:28px;background:var(--blue);color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;">' + num + '</div>'
        + '<div><div style="font-size:14px;font-weight:700;color:var(--text-1);">' + title + '</div>'
        + '<div style="font-size:13px;color:var(--text-2);margin-top:2px;line-height:1.5;">' + detail + '</div></div></div>';
    }

    function tipCard(text, color) {
      color = color || 'var(--blue)';
      return '<div style="border-left:3px solid ' + color + ';background:var(--surface-2);padding:10px 12px;margin:8px 0;border-radius:0 var(--radius) var(--radius) 0;">'
        + '<div style="font-size:13px;color:var(--text-2);line-height:1.5;">' + text + '</div></div>';
    }

    function featureRow(name, desc) {
      return '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">'
        + '<span style="font-size:13px;font-weight:600;color:var(--text-1);">' + name + '</span>'
        + '<span style="font-size:13px;color:var(--text-2);text-align:right;max-width:55%;">' + desc + '</span></div>';
    }

    // ── 1. SEARCH ──
    h += secHeader('help-search', '1', 'Search & Lookup');
    h += '<div class="card">';
    h += '<div style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:10px;">The search bar at the top of the Home tab lets you instantly find any unit.</div>';
    h += featureRow('Stock Number', 'Enter the full stock number (e.g., 224840)');
    h += featureRow('VIN (last 8)', 'Enter the last 8 characters of the VIN');
    h += featureRow('Results', 'Tap any result to open the full unit detail page');
    h += tipCard('Search is instant &mdash; results appear as you type. No need to press Enter.');
    h += tipCard('Single match auto-navigation: if your search narrows to exactly one unit (or you type 5+ characters), the app navigates directly to that unit\'s detail page. Works with both stock numbers and VINs.');
    h += '</div>';

    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Live Stock# Search in Forms</div>';
    h += '<div style="font-size:13px;color:var(--text-2);margin-bottom:10px;">The stock number field in the <strong>Verify Location</strong> and <strong>Reorganization</strong> note forms also has live search. As you type, matching unit tiles appear below the input.</div>';
    h += featureRow('Tile results', 'Tap any tile to populate the stock# field and load the unit preview');
    h += featureRow('Auto-select', 'If your prefix matches exactly one unit, it is selected automatically');
    h += '</div>';

    // ── 2. HOME TAB ──
    h += secHeader('help-home', '2', 'Home Tab & KPIs');
    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Quick Insight Cards</div>';
    h += '<div style="font-size:13px;color:var(--text-2);margin-bottom:10px;">Four tappable KPI cards at the top. Each drills through to the relevant data:</div>';
    h += featureRow('2025 Models', 'Count of MY2025 units still in active inventory');
    h += featureRow('Display Coverage', '% of active models with at least one unit on the floor');
    h += featureRow('Sale Pending', 'Total units in SP status (taps to All Sale Pending)');
    h += featureRow('Incoming', 'Units ordered/shipped/in transit (taps to pipeline)');
    h += '</div>';

    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Navigate Tiles</div>';
    h += featureRow('Lots', 'Browse by physical lot location (showrooms, display zones, overflow)');
    h += featureRow('Status', 'Browse by status category (Stock, Dead, Transit, Ordered)');
    h += featureRow('Makes', 'Browse by manufacturer and make');
    h += featureRow('Type', 'Browse by vehicle type and floor layout');
    h += '</div>';

    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Attention Needed</div>';
    h += '<div style="font-size:13px;color:var(--text-2);margin-bottom:8px;">Highlights items requiring action. Each row is tappable:</div>';
    h += featureRow('Display Holes', 'Models in overflow with NO showroom/display presence');
    h += featureRow('Audit Flags', 'Data quality issues needing correction');
    h += featureRow('Dead in Display', 'Non-sellable units (In Service, etc.) in customer areas');
    h += '</div>';

    // ── 3. BROWSING ──
    h += secHeader('help-browse', '3', 'Browsing Inventory');
    h += '<div class="card">';
    h += '<div style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:10px;">All browse views support filters. Look for the <strong>New/Used condition dropdown</strong> at the top of every drill-through page, plus Type, Manufacturer, Location, and Status filters where applicable.</div>';
    h += featureRow('Lots View', 'Showrooms, Display Zones, Overflow, and all other lot areas as tiles');
    h += featureRow('Status View', 'Grouped by category: Stock, Dead, Transit, Ordered');
    h += featureRow('Makes View', 'Manufacturer &#x2192; Make &#x2192; Model hierarchy with type dropdown');
    h += featureRow('Type View', 'Vehicle type &#x2192; Floor layout &#x2192; Sub-floorplan grouping');
    h += featureRow('View All Inventory', 'Full list with multi-select filters for Location, Type, Status, Manufacturer');
    h += featureRow('Lot Map', 'Visual reference of the CLE lot layout (pinch to zoom)');
    h += '</div>';

    // ── 4. UNIT DETAIL ──
    h += secHeader('help-unit', '4', 'Unit Detail Pages');
    h += '<div class="card">';
    h += '<div style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:10px;">Tap any unit from search or browse to see its full detail. The page is organized into clean sections:</div>';
    h += featureRow('Unit Info', 'Stock#, VIN, Year, Manufacturer, Make, Model, Type, Body Style, Layout, Condition (New/Used/Demo)');
    h += featureRow('Location', 'PC, Lot Location, Area. Verify Location and Suggest Move buttons inside.');
    h += featureRow('Transfer Notes', 'Shown for transit units if transfer notes exist');
    h += featureRow('Retail Deal', 'Sale Pending only: Salesman, Deal#, Deal Status, Type, Delivery Dates, Funding');
    h += featureRow('Pricing', 'MSRP &#x2192; Retail &#x2192; Special Price (green if discounted)');
    h += '</div>';

    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Bottom Buttons</div>';
    h += featureRow('Duplicate Make &amp; Models', 'Other units of the same make + model, grouped by status');
    h += featureRow('Compare Similar Models', 'Units of the same type and floor layout, sorted and grouped by price');
    h += featureRow('Select Replacement', 'Sale Pending in display only &mdash; pick an overflow backfill unit');
    h += '</div>';

    // ── 5. ACTIVITY ──
    h += secHeader('help-activity', '5', 'Activity & Sales');
    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Sale Pending Sections</div>';
    h += featureRow('New Today', 'Units entering SP today (status days = 0)');
    h += featureRow('All Sale Pending', 'Every SP unit regardless of duration');
    h += featureRow('Pending in Display', 'SP units in display/showroom &mdash; need to pull &amp; replace');
    h += '</div>';

    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Sale Pending Tile Colors</div>';
    h += '<div style="font-size:13px;color:var(--text-2);margin-bottom:8px;">Each tile is color-coded to help you prioritize:</div>';
    h += featureRow('Status Days', '<span style="color:var(--green);">Green</span> 0-2d &bull; <span style="color:var(--orange);">Orange</span> 3-7d &bull; <span style="color:#C8102E;">Red</span> 8d+');
    h += featureRow('Deal Status', ''
      + '<span style="color:#166534;">&#9646;</span> Dark Green = Funded/Complete/Delivered &bull; '
      + '<span style="color:var(--green);">&#9646;</span> Green = Approved/Scheduled &bull; '
      + '<span style="color:var(--orange);">&#9646;</span> Orange = Pending/In Progress &bull; '
      + '<span style="color:var(--copper);">&#9646;</span> Amber = Conditional/Waiting &bull; '
      + '<span style="color:#C8102E;">&#9646;</span> Red = Declined/Cancelled');
    h += featureRow('Left Border', '<span style="color:var(--orange);">Orange</span> = Unit is in Display or Showroom (needs pulling)');
    h += featureRow('Condition Badge', '<span style="color:#C8102E;">USED</span> (red) or <span style="color:var(--blue);">DEMO</span> (blue) badge on tiles');
    h += featureRow('Filters', 'Type chips + Manufacturer, Condition &amp; Deal Status dropdowns');
    h += '</div>';

    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Other Activity</div>';
    h += featureRow('Retail Ordered Today', 'Customer orders placed today (uses OrderDate field)');
    h += featureRow('Retail Sold Today', 'Deals closed today from the Retail Units data');
    h += featureRow('Incoming Pipeline', 'Browse by stage (Ordered &#x2192; PO Issued &#x2192; Shipped &#x2192; Dispatched)');
    h += '</div>';

    // ── 6. REPLACEMENT TOOL ──
    h += secHeader('help-replacement', '6', 'Unit Replacement Tool');
    h += '<div class="card">';
    h += '<div style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:12px;">When a sale pending unit is in display or showroom, you need to pull it and replace it with a unit from overflow.</div>';
    h += stepCard(1, 'Find the SP Unit', 'Go to Activity &#x2192; Pending in Display, or search by stock number.');
    h += stepCard(2, 'Open Unit Detail', 'Tap the tile to see full details.');
    h += stepCard(3, 'Tap Select Replacement', 'Button appears at the bottom for SP units in display/showroom.');
    h += stepCard(4, 'Choose a Candidate', 'Candidates grouped: Same Model (best) &#x2192; Same Make &#x2192; Same Type. Sorted by freshness.');
    h += stepCard(5, 'Confirm Selection', 'Tap the candidate, confirm. Logged to Google Sheet &amp; tracked in Replacement Log.');
    h += '</div>';

    h += tipCard('<strong>Duplicate blocking:</strong> Each overflow unit can only be assigned once. If already assigned, the app will block it and direct you to the Replacement Log.', 'var(--orange)');

    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Replacement Log (Coverage Tab)</div>';
    h += featureRow('Active', 'Pending replacements with stale detection warnings');
    h += featureRow('Mark Complete', 'When the forklift move is done');
    h += featureRow('Cancel', 'Changed your mind or unit unavailable');
    h += featureRow('Stale Detection', 'Warns if the replacement unit status changed since you picked it');
    h += '</div>';

    // ── 7. NOTES ──
    h += secHeader('help-notes', '7', 'Field Notes');
    h += '<div class="card">';
    h += '<div style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:10px;">Log observations while walking the lot. All notes push to the CLE Lot Report Google Sheet as structured rows.</div>';
    h += featureRow('Verify Location', 'Confirm or correct where a unit physically sits');
    h += featureRow('Coverage Hole', 'Report an empty display spot &mdash; include zone, missing type/brand, and nearby stock numbers');
    h += featureRow('Reorganization', 'Suggest moving units between zones with reason dropdown');
    h += featureRow('Reorg Backfill', 'Optional: select a stock# to fill the spot vacated by the moved unit');
    h += '</div>';

    h += tipCard('<strong>Reorg + Backfill:</strong> When submitting a reorganization, check "Backfill the vacated spot?" to enter a replacement stock number. Both the move and the backfill are logged as paired entries.', 'var(--blue)');

    h += '<div class="card">';
    h += '<div style="font-size:14px;font-weight:700;margin-bottom:8px;color:var(--text-1);">Coverage Hole &mdash; Fill Suggestion</div>';
    h += '<div style="font-size:13px;color:var(--text-2);margin-bottom:10px;">When reporting a hole, you can optionally suggest a unit from inventory to fill it.</div>';
    h += stepCard(1, 'Check the checkbox', '"Suggest a unit to fill this hole?" appears near the bottom of the form.');
    h += stepCard(2, 'Browse candidates', 'Matching units (same type &amp; make) load as tappable tiles. Overflow units are sorted to the top and flagged <strong style="color:var(--orange);">&#9650; OVERFLOW &mdash; PRIORITY</strong>.');
    h += stepCard(3, 'Tap a tile to select', 'A green confirmation row appears. Tap &times; to clear and pick again.');
    h += stepCard(4, 'Submit as normal', 'The suggested stock# is included with the note when you hit Submit. Nothing is pushed early.');
    h += '</div>';

    h += tipCard('<strong>Best practice:</strong> When reporting a hole, always include nearby stock numbers. This helps the lot crew find the exact spot.', 'var(--green)');

    // ── 8. COVERAGE ──
    h += secHeader('help-coverage', '8', 'Coverage & Analysis');
    h += '<div class="card">';
    h += featureRow('Coverage Matrix', 'Every model&#x2019;s placement: SHR (blue), DSP (green), OVR, INC, OTH. Gap column flags missing coverage.');
    h += featureRow('Zone Map', 'Per-zone column grid (DISP01-11). Shows which models are in each zone.');
    h += featureRow('Overflow Only', 'Units in overflow with no display/showroom presence &mdash; candidates to move onto the floor.');
    h += featureRow('Replacement Log', 'Track replacement picks, mark complete or cancel.');
    h += featureRow('Type Filters', 'Both Coverage Matrix and Zone Map have type filter buttons at the top.');
    h += '</div>';

    // ── 9. AUDIT ──
    h += secHeader('help-audit', '9', 'Data Audits');
    h += '<div class="card">';
    h += featureRow('Status &amp; Location', 'Dead inventory in display, missing lot codes, PC mismatches, stale statuses');
    h += featureRow('Product Hierarchy', 'Missing Type, Body Style, Manufacturer, Make, or Model (new units only)');
    h += featureRow('Severity', '<span style="color:#C8102E;">CRITICAL</span> (red) &bull; <span style="color:var(--orange);">WARNING</span> (orange) &bull; <span style="color:var(--yellow);">INFO</span> (yellow)');
    h += '</div>';

    // ── 10. DATA REFRESH ──
    h += secHeader('help-refresh', '10', 'Data Refresh');
    h += '<div class="card">';
    h += '<div style="font-size:13px;color:var(--text-2);line-height:1.6;margin-bottom:10px;">Data updates when the CLE Lot Report runs (typically daily).</div>';
    h += stepCard(1, 'Run the CLE Lot Report', 'This triggers the data pipeline and pushes updated JSON to the app.');
    h += stepCard(2, 'Close All Tabs', 'Close every tab/instance of the app on your phone.');
    h += stepCard(3, 'Reopen the App', 'The new service worker installs and loads fresh data.');
    h += '</div>';

    h += tipCard('<strong>Troubleshooting:</strong> If data looks stale after reopening, clear your browser cache (Settings &#x2192; Safari/Chrome &#x2192; Clear Cache) and reload.', 'var(--orange)');

    // ── Daily Workflow ──
    h += '<div style="margin-top:24px;margin-bottom:12px;padding-bottom:6px;border-bottom:2px solid var(--green);">'
      + '<span style="font-size:16px;font-weight:800;color:var(--text-1);">Recommended Daily Workflow</span></div>';

    h += '<div class="card">';
    h += stepCard(1, 'Check Activity Tab', 'Review new sale pending units and pending in display.');
    h += stepCard(2, 'Pull &amp; Replace', 'For SP units in display, use the replacement picker to assign overflow backfills.');
    h += stepCard(3, 'Walk the Lot', 'Log holes, verify locations, and suggest reorgs via the Notes tab.');
    h += stepCard(4, 'Track Moves', 'Check the Replacement Log on Coverage to mark completed moves.');
    h += stepCard(5, 'Review Coverage', 'Use the Coverage Matrix to spot remaining gaps.');
    h += '</div>';

    h += '<div style="text-align:center;padding:16px 0;font-size:12px;color:var(--text-3);">CLE Lot Manager v1.2 &bull; Powered by RAY.i</div>';

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
        h += '<a class="card card-interactive" href="#incoming-status/' + encodeURIComponent(stageKeys[s]) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
          + '<span style="font-size:18px;font-weight:600;">' + esc(stageKeys[s]) + '</span>'
          + '<span class="stat-val" style="font-size:24px;color:' + stageColor + ';">' + byStatus[stageKeys[s]] + '</span></a>';
      }

      // By Type
      h += '<div style="margin:16px 0 8px;color:var(--text-3);font-size:12px;text-transform:uppercase;letter-spacing:1px;">By Type</div>';
      var typeKeys = Object.keys(byType).sort();
      for (var t = 0; t < typeKeys.length; t++) {
        h += '<a class="card card-interactive" href="#incoming-units/type/' + encodeURIComponent(typeKeys[t]) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
          + '<span style="font-size:18px;font-weight:600;">' + esc(typeKeys[t]) + '</span>'
          + '<span class="stat-val" style="font-size:24px;color:var(--blue);">' + byType[typeKeys[t]] + '</span></a>';
      }

      // By Make
      h += '<div style="margin:16px 0 8px;color:var(--text-3);font-size:12px;text-transform:uppercase;letter-spacing:1px;">By Make</div>';
      var makeKeys = Object.keys(byMake).sort();
      for (var m = 0; m < makeKeys.length; m++) {
        h += '<a class="card card-interactive" href="#incoming-make/' + encodeURIComponent(makeKeys[m]) + '" style="display:flex;justify-content:space-between;align-items:center;text-decoration:none;color:#1a1a2e;">'
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
      var condVal = (u.condition || "New").toUpperCase();
      var isTransfer = (st === "TRANSFER" || st === "STORE-TO-STORE TRANSFER" || st === "OPS TRANSFER");
      var isShipped = (st === "SHIPPED" || st === "DISPATCHED" || st === "IN TRANSIT" || st === "DRIVER NEEDED");
      var isRetailOrder = (st === "RETAIL ORDERED");
      var isOrdered = (st === "ORDERED" || st === "PO ISSUED" || st === "PURCHASED");
      var statusColor = isShipped ? "var(--green)" : isTransfer ? "var(--orange)" : "var(--blue)";
      var sd = parseInt(u.status_days) || 0;
      var sdColor = sd > 14 ? 'var(--red)' : sd > 7 ? 'var(--orange)' : 'var(--text-3)';

      h += '<div class="result-card" data-action="detail" data-stock="' + esc(u.stock_num) + '" data-condition="' + esc(condVal) + '">';
      h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;">';

      // Left side
      h += '<div style="flex:1;min-width:0;">';

      // Line 1: Year Make Model-Stock
      h += '<div class="result-ymm">' + esc(u.year || "") + ' ' + esc(u.make || "") + ' ' + esc(u.model || "")
        + '<span style="color:var(--text-3);font-weight:400;">-' + esc(u.stock_num) + '</span></div>';

      // Line 2: Manufacturer
      if (u.manufacturer) h += '<div style="font-size:11px;color:var(--text-3);margin-top:1px;text-transform:uppercase;letter-spacing:0.5px;">' + esc(u.manufacturer) + '</div>';

      // Line 3: Type · Layout · Sub
      var line3 = [];
      if (u.veh_type) line3.push(esc(u.veh_type));
      if (u.floor_layout) line3.push(esc(u.floor_layout));
      if (u.sub_floorplan) line3.push(esc(u.sub_floorplan));
      if (line3.length > 0) h += '<div class="result-meta">' + line3.join('<span class="sep">&middot;</span>') + '</div>';

      // Line 4: Status badge + status days
      h += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">';
      h += '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;background:' + statusColor + ';color:#fff;">' + esc(u.status) + '</span>';
      if (u.status_days != null && u.status_days !== "") h += '<span style="font-size:11px;font-weight:700;color:' + sdColor + ';">' + sd + 'd in status</span>';
      if (condVal === "USED") h += '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:#fde8e8;color:#C8102E;">USED</span>';
      h += '</div>';

      // Line 5: Status-specific context
      h += '<div style="display:flex;align-items:center;gap:6px;margin-top:4px;flex-wrap:wrap;">';

      if (isTransfer) {
        // Transfer: show origin location → destination
        if (u.current_loc) h += '<span style="font-size:11px;color:var(--text-2);">From: <strong>' + esc(u.current_loc) + '</strong></span>';
        if (u.lot_location) h += '<span style="font-size:11px;color:var(--green);">To: <strong>' + esc(u.lot_location) + '</strong></span>';
        if (u.transfer_notes) h += '<span style="font-size:11px;color:var(--text-3);font-style:italic;">' + esc(u.transfer_notes) + '</span>';
      } else if (isShipped) {
        // Shipped: show expected delivery
        if (u.exp_delivery_date) h += '<span style="font-size:11px;color:var(--green);">ETA: <strong>' + esc(u.exp_delivery_date) + '</strong></span>';
        if (u.lot_location) h += '<span style="font-size:11px;color:var(--text-3);">' + esc(u.lot_location) + '</span>';
      } else if (isRetailOrder) {
        // Retail ordered: deal info like sale pending
        if (u.deal_number) h += '<span style="font-size:11px;font-weight:700;color:var(--text-2);">Deal #' + esc(u.deal_number) + '</span>';
        if (u.deal_status) {
          var dsU = (u.deal_status || "").toUpperCase();
          var dsBg = '#e9ecef', dsFg = 'var(--text-2)';
          if (dsU.indexOf("FUNDED") !== -1 || dsU.indexOf("APPROVED") !== -1) { dsBg = 'var(--green-dim)'; dsFg = 'var(--green)'; }
          else if (dsU.indexOf("PENDING") !== -1 || dsU.indexOf("SUBMITTED") !== -1) { dsBg = 'var(--orange-dim)'; dsFg = 'var(--orange)'; }
          h += '<span style="display:inline-block;padding:2px 6px;border-radius:3px;font-size:10px;font-weight:700;background:' + dsBg + ';color:' + dsFg + ';">' + esc(u.deal_status) + '</span>';
        }
        if (u.hold_salesman) h += '<span style="font-size:11px;color:var(--text-3);">' + esc(u.hold_salesman) + '</span>';
        if (u.deal_delivery_date) h += '<span style="font-size:11px;color:var(--green);">Delivery: ' + esc(u.deal_delivery_date) + '</span>';
      } else if (isOrdered) {
        // Ordered / PO Issued: order date + expected delivery
        if (u.order_date) h += '<span style="font-size:11px;color:var(--text-2);">Ordered: ' + esc(u.order_date) + '</span>';
        if (u.exp_delivery_date) h += '<span style="font-size:11px;color:var(--green);">ETA: <strong>' + esc(u.exp_delivery_date) + '</strong></span>';
        if (u.lot_location) h += '<span style="font-size:11px;color:var(--text-3);">' + esc(u.lot_location) + '</span>';
      }

      h += '</div>';
      h += '</div>';

      // Right side: status days big + price
      h += '<div style="text-align:right;min-width:50px;">';
      h += '<div style="font-size:16px;font-weight:800;color:' + sdColor + ';">' + sd + 'd</div>';
      if (fmtPrice(u.retail_price)) h += '<div style="font-size:11px;color:var(--text-3);">' + fmtPrice(u.retail_price) + '</div>';
      h += '</div></div></div>';
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
    allInventoryView: allInventoryView,
    replLogView: replLogView,
    helpView: helpView,
    incomingView: incomingView,
    incomingStatusView: incomingStatusView,
    incomingMakeView: incomingMakeView,
    incomingUnitsView: incomingUnitsView,
    renderUnitCard: renderUnitCard,
    renderUnitPickTile: renderUnitPickTile,
    renderUnitFillTile: renderUnitFillTile,
    renderAuditFlags: renderAuditFlags,
    renderUnitPreviewCard: renderUnitPreviewCard,
    computeAuditFlags: computeAuditFlags,
    esc: esc,
  };
})();
