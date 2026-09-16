/* Claudito Writer mockup, round 2: the page editor. */
(function () {
  "use strict";
  var CW = window.CW, U = CW.util, $ = U.$, $$ = U.$$;
  var S = CW.state = CW.state || {};

  function changed() { if (typeof CW.pageChanged === "function") CW.pageChanged(); }

  /* ── selection helpers ── */
  function anchorNode() {
    var s = window.getSelection();
    if (s.rangeCount && S.sheet.contains(s.getRangeAt(0).startContainer)) return s.getRangeAt(0).startContainer;
    return S.lastRange && S.sheet.contains(S.lastRange.startContainer) ? S.lastRange.startContainer : null;
  }
  function inside(sel) { var el = U.elOf(anchorNode()); return !!(el && el !== S.sheet && el.closest(sel)); }
  function topOf(node) {
    var n = node;
    if (!n || n === S.sheet) return null;
    while (n.parentNode && n.parentNode !== S.sheet) n = n.parentNode;
    return n.parentNode === S.sheet ? n : null;
  }
  function lastParagraph() { var ps = $$(":scope > p", S.sheet); return ps[ps.length - 1] || null; }
  function restore() {
    var s = window.getSelection();
    if (s.rangeCount && S.sheet.contains(s.getRangeAt(0).startContainer)) return;
    S.sheet.focus({ preventScroll: true });
    var r = S.lastRange && S.sheet.contains(S.lastRange.startContainer) ? S.lastRange : null;
    if (!r) {
      var p = lastParagraph();
      if (!p) return;
      r = document.createRange(); r.selectNodeContents(p); r.collapse(false);
    }
    s.removeAllRanges(); s.addRange(r);
  }
  function focusCell(c) {
    if (!c) return;
    var r = document.createRange(); r.selectNodeContents(c);
    var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  CW.sectionOfNode = function (node) {
    var b = topOf(node);
    for (; b; b = b.previousElementSibling) if (/^H[23]$/.test(b.tagName)) return b.textContent.trim();
    return "";
  };
  CW.currentSection = function () { return CW.sectionOfNode(anchorNode()); };

  /* ── rendering ── */
  CW.renumber = function () {
    $$(".tbl .lbl", S.sheet).forEach(function (l, i) { l.textContent = "Table " + (i + 1) + "."; });
    $$(".fig .lbl", S.sheet).forEach(function (l, i) { l.textContent = "Figure " + (i + 1) + "."; });
    $$(".eq .eq-no", S.sheet).forEach(function (l, i) { l.textContent = "(" + (i + 1) + ")"; });
  };
  /* Only the first paragraph of a section keeps the grey question; empty ones show it. */
  CW.normalizeGuides = function () {
    var guided = false;
    Array.prototype.forEach.call(S.sheet.children, function (el) {
      if (/^H[1-3]$/.test(el.tagName)) { guided = false; return; }
      if (el.tagName !== "P") return;
      if (el.hasAttribute("data-guide")) { if (guided) el.removeAttribute("data-guide"); else guided = true; }
      el.classList.toggle("is-empty", !el.textContent.trim() && !el.querySelector(".cite, .ieq"));
    });
  };
  CW.renderSheet = function () {
    S.sheet.innerHTML = CW.docToHTML(S.doc);
    S.lastRange = null;
    CW.renumber(); CW.normalizeGuides();
  };
  CW.syncFromSheet = function () { S.doc.blocks = CW.domToBlocks(S.sheet); };

  function fromHTML(html) { var w = document.createElement("div"); w.innerHTML = html; return w.firstElementChild; }
  CW.insertBlockHTML = function (html, after) {
    var el = fromHTML(html), b = after === undefined ? topOf(anchorNode()) : after;
    if (b && b.tagName === "H1") b = b.nextElementSibling ? b : null;
    if (b && b.parentNode === S.sheet) {
      var emptyPlain = b.tagName === "P" && !b.textContent.trim() && !b.querySelector(".cite, .ieq") && !b.hasAttribute("data-guide");
      if (emptyPlain) b.replaceWith(el); else b.after(el);
    } else S.sheet.appendChild(el);
    var next = el.nextElementSibling;
    if (!next || next.tagName !== "P") { var p = document.createElement("p"); p.innerHTML = "<br>"; p.className = "is-empty"; el.after(p); }
    CW.renumber(); changed();
    el.scrollIntoView({ behavior: U.motion(), block: "nearest" });
    return el;
  };

  /* ── commands: toolbar, quick commands and the assistant all use these ── */
  CW.runCommand = function (id, anchor) {
    CW.closePops();
    if (id === "h2" || id === "h3" || id === "ul" || id === "ol" || id === "bold") {
      restore();
      if (inside(".blk")) return;
      if (id === "bold") document.execCommand("bold");
      else if (id === "ul") document.execCommand("insertUnorderedList");
      else if (id === "ol") document.execCommand("insertOrderedList");
      else {
        var b = topOf(anchorNode());
        if (b && b.tagName === "H1") return;
        var tag = id === "h2" ? "H2" : "H3";
        document.execCommand("formatBlock", false, b && b.tagName === tag ? "<p>" : "<" + tag.toLowerCase() + ">");
      }
      CW.normalizeGuides(); changed();
    } else if (id === "table") {
      var t = CW.insertBlockHTML(CW.tableHTML({ rows: [["Column 1", "Column 2", "Column 3"], ["", "", ""], ["", "", ""]], caption: "" }));
      focusCell($("thead tr:not(.ctl-row) th", t));
    } else if (/^fig[123]$/.test(id)) {
      var n = +id.charAt(3), imgs = [];
      for (var i = 0; i < n; i++) imgs.push("");
      var f = CW.insertBlockHTML(CW.figureHTML({ images: imgs, caption: "" }, S.doc.images));
      S.pick = { fig: f, index: 0 };
      if (n === 1) $("#figPick").click();
    } else if (id === "equation") {
      S.editingEq = null; CW.openEq(anchor || $('.tool[data-cmd="equation"]'), "");
    } else if (id === "cite") {
      CW.openCite(anchor || $('.tool[data-cmd="cite"]'));
    } else if (id === "assistant" || id === "txt" || id === "latex") {
      if (typeof CW.showSide === "function") CW.showSide(id === "latex" ? "tex" : id);
    }
  };

  /* ── tables (Astrolaby pattern) ── */
  function mutateTable(fig, act, i) {
    var m = CW.readTable(fig), rows = m.rows, cols = rows[0].length;
    if (act === "addrow") rows.push(rows[0].map(function () { return ""; }));
    else if (act === "delrow" && rows.length > 2) rows.splice(i, 1);
    else if (act === "addcol") rows.forEach(function (r, ri) { r.push(ri === 0 ? "Column " + (cols + 1) : ""); });
    else if (act === "delcol" && cols > 1) rows.forEach(function (r) { r.splice(i, 1); });
    var nf = fromHTML(CW.tableHTML(m));
    fig.replaceWith(nf);
    CW.renumber(); changed();
    return nf;
  }
  function dataCells(table) { return $$("th:not(.ctl), td:not(.ctl)", table).filter(function (c) { return !c.closest(".ctl-row"); }); }

  /* ── figures ── */
  CW.shrink = function (file, max, quality) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) { reject(new Error("not an image")); return; }
      var fr = new FileReader();
      fr.onerror = reject;
      fr.onload = function () {
        var img = new Image();
        img.onerror = reject;
        img.onload = function () {
          var w = img.naturalWidth || img.width || 1, h = img.naturalHeight || img.height || 1, k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
          var ctx = c.getContext("2d");
          ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL("image/jpeg", quality));
        };
        img.src = fr.result;
      };
      fr.readAsDataURL(file);
    });
  };
  function putImage(fig, index, file) {
    CW.shrink(file, 1400, 0.82).then(function (data) {
      if (!fig.isConnected) return;
      var base = "figures/" + U.slug(file.name || "image").replace(/\.[a-z0-9]+$/, "") + ".jpg", path = base, k = 2;
      while (S.doc.images[path] && S.doc.images[path] !== data) path = base.replace(/\.jpg$/, "-" + (k++) + ".jpg");
      S.doc.images[path] = data;
      var m = CW.readFigure(fig);
      m.images[Math.min(index, m.images.length - 1)] = path;
      fig.replaceWith(fromHTML(CW.figureHTML(m, S.doc.images)));
      CW.renumber(); changed();
    }, function () {});
  }
  function setPanels(fig, n) {
    var m = CW.readFigure(fig);
    while (m.images.length < n) m.images.push("");
    m.images = m.images.slice(0, n);
    fig.replaceWith(fromHTML(CW.figureHTML(m, S.doc.images)));
    CW.renumber(); changed();
  }

  /* ── pop-ups ── */
  function place(pop, anchor) {
    pop.hidden = false;
    var app = $("#app"), ar = anchor.getBoundingClientRect(), pr = app.getBoundingClientRect();
    pop.style.top = (ar.bottom - pr.top + 8) + "px";
    pop.style.left = Math.max(12, Math.min(ar.left - pr.left, app.clientWidth - pop.offsetWidth - 12)) + "px";
  }
  CW.closePops = function () { $("#eqPop").hidden = true; $("#citePop").hidden = true; closeSlash(); };

  CW.openEq = function (anchor, src) {
    CW.closePops(); place($("#eqPop"), anchor);
    $("#eqInput").value = src;
    $("#eqPreview").innerHTML = CW.renderEq(src);
    $("#eqAsk").value = ""; $("#eqSugg").innerHTML = "";
    $("#eqOk").textContent = S.editingEq ? "Update" : "Insert";
    $("#eqRemove").hidden = !S.editingEq;
    $("#eqInput").focus({ preventScroll: true });
  };
  function renderEqSugg(q) {
    var list = CW.EQ_SUGGESTIONS.map(function (s) { return { s: s, score: U.fuzzy(q, s.name + " " + s.words) }; })
      .filter(function (x) { return x.score > 0; }).sort(function (a, b) { return b.score - a.score; }).slice(0, 4);
    $("#eqSugg").innerHTML = !q.trim() ? "" : list.length
      ? list.map(function (x) { return '<li><button type="button" data-src="' + U.esc(x.s.src) + '"><span class="n">' + U.esc(x.s.name) + '</span><span class="f">' + CW.renderEq(x.s.src) + "</span></button></li>"; }).join("")
      : '<li class="pop-hint">No prepared example matches. In Claudito the local AI would still try.</li>';
  }

  CW.refsForSection = function (title) {
    var t = U.norm(String(title || "").replace(/^[\d.\s]+/, ""));
    if (!t) return [];
    return CW.REFS.filter(function (r) {
      return r.screen !== "Exclude" && (CW.SECTION_RULES[r.subject] || []).some(function (k) { return t.indexOf(k) >= 0; });
    }).sort(function (a, b) { return (a.screen === "Include" ? 0 : 1) - (b.screen === "Include" ? 0 : 1); });
  };
  CW.refButton = function (r) {
    return '<button type="button" class="ref" data-doi="' + U.esc(r.doi) + '"><span class="t">' + U.esc(r.title) + "</span>" +
      '<span class="m"><span>' + U.esc(r.key) + ", " + r.year + '</span><span class="badge ' + r.screen + '">' + r.screen + "</span><span>references/" + U.esc(r.subject) + "/</span></span></button>";
  };
  function renderRefs(q) {
    var html = "", showEx = !!S.showExcluded;
    if (q.trim()) {
      var hits = CW.REFS.map(function (r) { return { r: r, s: U.fuzzy(q, r.title + " " + r.key + " " + r.year + " " + r.subject) }; })
        .filter(function (x) { return x.s > 0 && (showEx || x.r.screen !== "Exclude"); }).sort(function (a, b) { return b.s - a.s; });
      html = hits.length ? "<h4>Matches</h4>" + hits.map(function (x) { return CW.refButton(x.r); }).join("") : '<p class="none">Nothing matches “' + U.esc(q) + "”.</p>";
    } else {
      var sug = CW.refsForSection(S.citeSection);
      html = "<h4>Suggested for " + U.esc(S.citeSection || "this part") + "</h4>" + (sug.length ? sug.map(CW.refButton).join("") : '<p class="none">No subject is mapped to this section yet.</p>');
      var groups = {};
      CW.REFS.forEach(function (r) { if (showEx || r.screen !== "Exclude") (groups[r.subject] = groups[r.subject] || []).push(r); });
      Object.keys(groups).sort().forEach(function (g) { html += "<h4>references/" + U.esc(g) + "/</h4>" + groups[g].map(CW.refButton).join(""); });
    }
    $("#refList").innerHTML = html;
    var ex = CW.REFS.filter(function (r) { return r.screen === "Exclude"; }).length;
    $("#citeFoot").innerHTML = "Example references. Suggestions follow harvest subjects, screening and section_rules.txt. " +
      '<button type="button" class="linkish" id="toggleExcluded">' + (showEx ? "Hide" : "Show") + " the " + ex + " excluded by screening</button>";
  }
  CW.openCite = function (anchor) {
    CW.closePops();
    S.citeSection = CW.currentSection();
    clearTimeout(S.qhTimer);
    $("#qhPanel").hidden = true;
    place($("#citePop"), anchor);
    $("#citeSearch").value = "";
    renderRefs("");
    $("#citeSearch").focus({ preventScroll: true });
  };
  CW.insertCite = function (doi) {
    var r = CW.refByDoi(doi);
    if (!r) return;
    var chip = document.createElement("span");
    chip.className = "cite"; chip.setAttribute("contenteditable", "false"); chip.setAttribute("data-doi", doi);
    chip.textContent = CW.citeLabel([doi]);
    var at = S.lastRange && S.sheet.contains(S.lastRange.startContainer) ? S.lastRange.cloneRange() : null;
    var el = at ? U.elOf(at.startContainer) : null;
    if (!at || !el || el === S.sheet || el.closest(".blk, h1")) {
      var p = lastParagraph() || S.sheet;
      p.appendChild(document.createTextNode(" ")); p.appendChild(chip);
    } else {
      at.collapse(false);
      var tail = document.createTextNode(" ");
      at.insertNode(tail); at.insertNode(chip); at.insertNode(document.createTextNode(" "));
      S.sheet.focus({ preventScroll: true });
      var caret = document.createRange(); caret.setStartAfter(tail); caret.collapse(true);
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(caret);
    }
    CW.normalizeGuides(); changed();
  };

  /* ── quick harvest (Pedro, 2026-09-15): the paragraph + the project's scope -> up to 10 good
        papers, searched only in databases whose API is ready. Served by `clt write`, the bridge
        (CW.searchPapers, bridge.js) searches for real; opened as a plain file, the example
        results from data.js stand in so the pop-up can still be tried. ── */
  function paragraphAtCursor() {
    var node = S.lastRange && S.sheet.contains(S.lastRange.startContainer) ? S.lastRange.startContainer : null;
    var b = topOf(node);
    return b && /^(P|UL|OL|DIV)$/.test(b.tagName) ? b.textContent.replace(/\s+/g, " ").trim() : "";
  }
  function scopeText() {
    var title = "", abs = "", on = false;
    S.doc.blocks.forEach(function (b) {
      if (b.t === "h") { if (b.level === 1 && !title) title = b.text; on = /abstract/i.test(b.text); return; }
      if (on && b.t === "p") abs += " " + b.text;
    });
    return (title + " " + abs).replace(/\[CITE:[^\]]*\]|\[EQ:[^\]]*\]|\*\*/g, "");
  }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function saveHarvested() {
    U.set("cw2.qhrefs", CW.REFS.filter(function (r) { return r.harvested; }));
    U.set("cw2.qhrules", S.qhRules || {});
  }
  CW.quickHarvest = function () {
    CW.syncFromSheet();
    var panel = $("#qhPanel"), section = S.citeSection || "this section";
    var para = paragraphAtCursor(), terms = CW.keywords(para).slice(0, 3);
    if (!terms.length) terms = CW.keywords(section.replace(/^[\d.\s]+/, "")).slice(0, 2);
    var scope = CW.keywords(scopeText()).filter(function (k) {
      return !terms.some(function (t) { return t.indexOf(k) >= 0 || k.indexOf(t) >= 0; });
    }).slice(0, 2);
    panel.hidden = false;
    panel.innerHTML = "<h4>Quick harvest for “" + U.esc(section) + "”</h4>" +
      "<p>" + (para ? "Terms from the paragraph you are in" : "No paragraph under the cursor, so terms from the section title") + ", plus the project's scope:</p>" +
      '<div class="as-row">' + terms.map(function (k) { return '<span class="kw">' + U.esc(k) + "</span>"; }).join("") +
      scope.map(function (k) { return '<span class="kw">' + U.esc(k) + "</span>"; }).join("") + "</div>" +
      '<p class="busy" id="qhBusy">Searching</p>';
    if (typeof CW.searchPapers === "function") {
      /* bridge mode: the server searches the databases active on this machine */
      CW.searchPapers(terms.concat(scope), function (err, data) {
        if (panel.hidden) return;
        if (err || !data || data.error) {
          var busyErr = $("#qhBusy");
          if (busyErr) busyErr.outerHTML = '<p class="none">The search did not answer' +
            (data && data.error ? ": " + U.esc(data.error) : " (is the bridge still running?)") + ". Your references below still work.</p>";
          return;
        }
        showHarvest(section, terms, scope, data);
      });
    } else {
      clearTimeout(S.qhTimer);
      S.qhTimer = setTimeout(function () { showHarvest(section, terms, scope, null); }, 900);
    }
  };
  function dbLists(dbs) {
    return '<p class="dbs"><b>Searched ' + dbs.ready.length + " database" + (dbs.ready.length === 1 ? "" : "s") + " with a ready API:</b> " +
      dbs.ready.map(function (d) { return U.esc(d[0]) + " (" + d[1] + ")"; }).join(" · ") + "</p>" +
      '<p class="dbs"><b>Not searched:</b> ' + dbs.needKey.map(function (d) { return '<span class="skip">' + U.esc(d[0]) + "</span>"; }).join(" · ") +
      " need a key that isn't set; " + dbs.noApi.map(function (d) { return '<span class="skip">' + U.esc(d) + "</span>"; }).join(" · ") + " have no API.</p>";
  }
  function showHarvest(section, terms, scope, data) {
    var panel = $("#qhPanel"), busy = $("#qhBusy");
    if (panel.hidden || !busy) return;
    var a = terms[0] || "home technology", dbs, foot;
    if (data) {
      /* Real results from the bridge (/api/harvest): DOI-carrying papers only,
         already deduplicated and sorted best first by the server. */
      S.qhResults = data.results.map(function (r) {
        var fam = String(r.authors || "").split(",")[0].trim().split(" ")[0];
        return { key: (fam || "Harvested") + (r.year ? " " + r.year : ""), year: r.year || "", doi: r.doi,
          title: r.title, subject: a, db: r.db || "", grade: r.grade || "", cites: r.cites || 0,
          match: terms.concat(scope).filter(function (k) { return String(r.title).toLowerCase().indexOf(k.split(" ")[0]) >= 0; }).length };
      });
      dbs = { ready: data.searched || [], needKey: data.needKey || [], noApi: data.noApi || [] };
      foot = "<p>Papers you add join this session's reference list, marked Maybe until you screen them in Claudito.</p>";
    } else {
      /* No bridge: the mockup's example results, so the pop-up can still be tried. */
      var b = terms[1] || scope[0] || a, ready = CW.QH_DATABASES.ready;
      var seed = (U.norm(section).length * 7 + a.length) % 97;
      S.qhResults = CW.QH_PATTERNS.slice(0, 10).map(function (p, i) {
        var db = ready[(i + seed) % ready.length];
        return { key: "Harvest " + String.fromCharCode(65 + i), year: 2025 - (i % 6), doi: "10.0000/qh." + seed + "." + (i + 1),
          title: "Example: " + cap(p.replace("{a}", a).replace("{b}", b)), subject: a, db: db[0], grade: db[1],
          cites: 212 - i * 17, match: Math.max(1, 3 - Math.floor(i / 4)) };
      }).sort(function (x, y) { return (x.grade < y.grade ? -1 : x.grade > y.grade ? 1 : 0) || y.cites - x.cites; });
      dbs = CW.QH_DATABASES;
      foot = "<p>Example results: open this page through <code>clt write</code> to search for real. Papers would go to <code>references/" + U.esc(U.slug(a)) + "/</code>, marked Maybe until you screen them.</p>";
    }
    busy.outerHTML = (S.qhResults.length ? "<h4>" + S.qhResults.length + " good papers, best first</h4><ol>" + S.qhResults.map(function (r, i) {
      var have = !!CW.refByDoi(r.doi);
      return '<li><span class="qt">' + U.esc(r.title) + '</span><span class="qm"><span>' + r.year + "</span><span>" + U.esc(r.db) + "</span>" +
        (r.grade ? '<span class="badge grade">grade ' + r.grade + "</span>" : "") + "<span>" + r.cites + " citations</span><span>matches " + r.match + " term" + (r.match === 1 ? "" : "s") + "</span></span>" +
        '<span class="qa"><button class="mini" type="button" data-qh-cite="' + i + '">Cite</button><button class="mini" type="button" data-qh-add="' + i + '"' +
        (have ? " disabled>In your references" : ">Add to references") + "</button></span></li>";
    }).join("") + "</ol>" : '<p class="none">Nothing found for these terms. Try a different paragraph.</p>') +
      dbLists(dbs) + foot;
  }
  function adoptHarvest(i) {
    var r = S.qhResults && S.qhResults[i];
    if (!r) return null;
    if (!CW.refByDoi(r.doi)) {
      CW.REFS.push({ key: r.key, year: r.year, doi: r.doi, subject: r.subject, screen: "Maybe", title: r.title, harvested: true });
      var key = U.norm(String(S.citeSection || "").replace(/^[\d.\s]+/, ""));
      S.qhRules = S.qhRules || {};
      if (key) {
        CW.SECTION_RULES[r.subject] = (CW.SECTION_RULES[r.subject] || []).concat([key]);
        S.qhRules[r.subject] = CW.SECTION_RULES[r.subject];
      }
      saveHarvested();
    }
    return r;
  }

  /* ── quick commands: "/" with fuzzy matching ── */
  var slash = { open: false, node: null, start: 0, end: 0, items: [], sel: 0 };
  function closeSlash() { slash.open = false; var m = $("#slashMenu"); if (m) m.hidden = true; }
  function drawSlash() {
    $("#slashMenu").innerHTML = slash.items.length
      ? slash.items.map(function (c, i) { return '<button type="button" role="option" data-id="' + c.id + '" aria-selected="' + (i === slash.sel) + '"><span>' + U.esc(c.label) + "</span></button>"; }).join("")
      : '<p class="none">No command matches “/' + U.esc(slash.q) + "”</p>";
  }
  function checkSlash() {
    var s = window.getSelection();
    if (!s.rangeCount || !s.isCollapsed) return closeSlash();
    var r = s.getRangeAt(0), node = r.startContainer;
    if (node.nodeType !== 3 || !S.sheet.contains(node) || node.parentNode.closest(".blk, h1, h2, h3")) return closeSlash();
    var m = node.nodeValue.slice(0, r.startOffset).match(/(?:^|\s)\/([A-Za-z0-9-]{0,24})$/);
    if (!m) return closeSlash();
    slash.node = node; slash.end = r.startOffset; slash.start = r.startOffset - m[1].length - 1; slash.q = m[1];
    slash.items = CW.COMMANDS.map(function (c) { return { c: c, s: slash.q ? U.fuzzy(slash.q, c.label + " " + c.words) : 1 }; })
      .filter(function (x) { return x.s > 0; }).sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.c; });
    slash.sel = 0; slash.open = true;
    var menu = $("#slashMenu"), app = $("#app");
    drawSlash(); menu.hidden = false;
    var rect = r.getBoundingClientRect();
    if (!rect.height) rect = node.parentNode.getBoundingClientRect();
    var pr = app.getBoundingClientRect();
    menu.style.top = (rect.bottom - pr.top + 6) + "px";
    menu.style.left = Math.max(12, Math.min(rect.left - pr.left, app.clientWidth - menu.offsetWidth - 12)) + "px";
  }
  function pickSlash(id) {
    var node = slash.node, anchor = node && node.parentNode;
    if (node && node.isConnected) {
      var rg = document.createRange();
      rg.setStart(node, Math.max(0, slash.start)); rg.setEnd(node, Math.min(node.nodeValue.length, slash.end));
      rg.deleteContents();
      var s = window.getSelection(); s.removeAllRanges(); s.addRange(rg);
      S.lastRange = rg.cloneRange();
    }
    closeSlash();
    CW.normalizeGuides();
    CW.runCommand(id, anchor && anchor.isConnected ? anchor : undefined);
  }

  /* ── wiring ── */
  CW.initEditor = function () {
    S.sheet = $("#sheet");
    var sheet = S.sheet, toolbar = $("#toolbar");
    /* papers kept from earlier quick harvests, and the section rules they added */
    (U.get("cw2.qhrefs", []) || []).forEach(function (r) { if (r && r.doi && !CW.refByDoi(r.doi)) CW.REFS.push(r); });
    S.qhRules = U.get("cw2.qhrules", {}) || {};
    Object.keys(S.qhRules).forEach(function (k) { CW.SECTION_RULES[k] = S.qhRules[k]; });
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}

    document.addEventListener("selectionchange", function () {
      var s = window.getSelection();
      if (s.rangeCount && sheet.contains(s.getRangeAt(0).startContainer)) {
        S.lastRange = s.getRangeAt(0).cloneRange();
        if (typeof CW.sectionMaybeChanged === "function") CW.sectionMaybeChanged();
      }
    });

    toolbar.addEventListener("mousedown", function (e) { if (e.target.closest(".tool")) e.preventDefault(); });
    toolbar.addEventListener("click", function (e) {
      var t = e.target.closest(".tool");
      if (t) CW.runCommand(t.getAttribute("data-cmd"), t);
    });

    sheet.addEventListener("input", function (e) {
      var el = U.elOf(anchorNode());
      var p = el && el.closest ? el.closest("p") : null;
      if (p) p.classList.toggle("is-empty", !p.textContent.trim() && !p.querySelector(".cite, .ieq"));
      checkSlash();
      changed();
    });

    sheet.addEventListener("click", function (e) {
      var t = e.target, hit;
      if ((hit = t.closest(".ico"))) {
        var fig = hit.closest(".tbl"), act = hit.getAttribute("data-t"), nf = mutateTable(fig, act, +hit.getAttribute("data-i"));
        if (act === "addrow") focusCell(dataCells($("tbody tr:last-child", nf))[0]);
        if (act === "addcol") { var ths = $$("thead tr:not(.ctl-row) th", nf); focusCell(ths[ths.length - 1]); }
      } else if ((hit = t.closest(".blk-tools .mini"))) {
        var blk = hit.closest(".blk"), a = hit.getAttribute("data-t");
        if (a === "rm") { blk.remove(); CW.renumber(); changed(); }
        else if (a === "csv") { S.csvTarget = blk; $("#csvPick").click(); }
        else if (/^n[123]$/.test(a)) setPanels(blk, +a.charAt(1));
      } else if ((hit = t.closest(".drop"))) {
        S.pick = { fig: hit.closest(".fig"), index: +hit.getAttribute("data-i") || 0 };
        $("#figPick").click();
      } else if ((hit = t.closest(".eq"))) {
        S.editingEq = hit; CW.openEq(hit, hit.getAttribute("data-src") || "");
      }
    });

    sheet.addEventListener("keydown", function (e) {
      if (slash.open) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          e.preventDefault();
          if (slash.items.length) { slash.sel = (slash.sel + (e.key === "ArrowDown" ? 1 : -1) + slash.items.length) % slash.items.length; drawSlash(); }
          return;
        }
        if ((e.key === "Enter" || e.key === "Tab") && slash.items.length) { e.preventDefault(); pickSlash(slash.items[slash.sel].id); return; }
        if (e.key === "Escape") { e.preventDefault(); closeSlash(); return; }
      }
      var t = e.target;
      if ((e.key === "Enter" || e.key === " ") && t !== sheet && t.classList) {
        if (t.classList.contains("eq")) { e.preventDefault(); S.editingEq = t; CW.openEq(t, t.getAttribute("data-src") || ""); return; }
        if (t.classList.contains("drop")) { e.preventDefault(); S.pick = { fig: t.closest(".fig"), index: +t.getAttribute("data-i") || 0 }; $("#figPick").click(); return; }
      }
      if (e.key !== "Enter" && e.key !== "Tab") return;
      var el = U.elOf(anchorNode());
      if (!el || el === sheet) return;
      if (e.key === "Enter" && el.closest(".cap")) { e.preventDefault(); return; }
      var cell = el.closest("td, th");
      if (!cell || cell.classList.contains("ctl")) return;
      var table = cell.closest("table"), fig = cell.closest(".tbl"), cells = dataCells(table), next = null;
      if (e.key === "Tab") {
        var i = cells.indexOf(cell);
        next = cells[i + (e.shiftKey ? -1 : 1)] || null;
        if (!next && !e.shiftKey) { var nf = mutateTable(fig, "addrow"); next = dataCells($("tbody tr:last-child", nf))[0]; }
      } else {
        var rows = $$("tr", table).filter(function (r) { return !r.classList.contains("ctl-row"); });
        var ri = rows.indexOf(cell.parentNode), ci = dataCells(cell.parentNode).indexOf(cell);
        if (ri === rows.length - 1) { var nf2 = mutateTable(fig, "addrow"); next = dataCells($("tbody tr:last-child", nf2))[ci] || null; }
        else next = dataCells(rows[ri + 1])[ci] || null;
      }
      e.preventDefault();
      if (next) focusCell(next);
      changed();
    });

    $("#slashMenu").addEventListener("mousedown", function (e) { e.preventDefault(); });
    $("#slashMenu").addEventListener("click", function (e) { var b = e.target.closest("[data-id]"); if (b) pickSlash(b.getAttribute("data-id")); });

    $("#figPick").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (f && S.pick && S.pick.fig && S.pick.fig.isConnected) putImage(S.pick.fig, S.pick.index, f);
    });
    $("#csvPick").addEventListener("change", function (e) {
      var f = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!f || !S.csvTarget || !S.csvTarget.isConnected) return;
      var fr = new FileReader();
      fr.onload = function () {
        var rows = U.parseCSV(fr.result);
        if (!rows.length || !S.csvTarget.isConnected) return;
        var m = CW.readTable(S.csvTarget), stem = f.name.replace(/\.csv$/i, "");
        m.rows = rows.slice(0, 200);
        m.name = "tables/" + U.slug(stem) + ".csv";
        if (!m.caption) m.caption = stem;
        S.csvTarget.replaceWith(fromHTML(CW.tableHTML(m)));
        CW.renumber(); changed();
      };
      fr.readAsText(f);
    });

    sheet.addEventListener("dragover", function (e) {
      if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") < 0) return;
      e.preventDefault();
      var d = e.target.closest(".drop");
      $$(".drop.over", sheet).forEach(function (x) { if (x !== d) x.classList.remove("over"); });
      if (d) d.classList.add("over");
    });
    sheet.addEventListener("drop", function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation();
      $$(".drop.over", sheet).forEach(function (x) { x.classList.remove("over"); });
      var f = Array.prototype.filter.call(e.dataTransfer.files, function (x) { return /^image\//.test(x.type); })[0];
      if (!f) return;
      var d = e.target.closest(".drop");
      if (d) { putImage(d.closest(".fig"), +d.getAttribute("data-i") || 0, f); return; }
      putImage(CW.insertBlockHTML(CW.figureHTML({ images: [""], caption: "" }, S.doc.images), topOf(e.target)), 0, f);
    });
    sheet.addEventListener("paste", function (e) {
      var cd = e.clipboardData;
      if (!cd) return;
      e.preventDefault();
      var img = Array.prototype.filter.call(cd.files || [], function (x) { return /^image\//.test(x.type); })[0];
      if (img) { putImage(CW.insertBlockHTML(CW.figureHTML({ images: [""], caption: "" }, S.doc.images)), 0, img); return; }
      var text = cd.getData("text/plain");
      if (text) document.execCommand("insertText", false, text);
    });

    /* equation pop-up */
    $("#eqInput").addEventListener("input", function () { $("#eqPreview").innerHTML = CW.renderEq(this.value); });
    $("#eqInput").addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); $("#eqOk").click(); } });
    $("#eqAsk").addEventListener("input", function () { renderEqSugg(this.value); });
    $("#eqSugg").addEventListener("click", function (e) {
      var b = e.target.closest("button[data-src]");
      if (!b) return;
      $("#eqInput").value = b.getAttribute("data-src");
      $("#eqPreview").innerHTML = CW.renderEq($("#eqInput").value);
      $("#eqInput").focus({ preventScroll: true });
    });
    $("#eqCancel").addEventListener("click", CW.closePops);
    $("#eqRemove").addEventListener("click", function () {
      if (S.editingEq) { S.editingEq.remove(); S.editingEq = null; CW.renumber(); changed(); }
      CW.closePops();
    });
    $("#eqOk").addEventListener("click", function () {
      var src = $("#eqInput").value.trim();
      if (src && S.editingEq) {
        S.editingEq.setAttribute("data-src", src);
        $(".eq-body", S.editingEq).innerHTML = CW.renderEq(src);
        changed();
      } else if (src) CW.insertBlockHTML(CW.eqHTML({ src: src }));
      CW.closePops();
    });

    /* cite pop-up */
    $("#citeSearch").addEventListener("input", function () { renderRefs(this.value); });
    $("#qhBtn").addEventListener("click", CW.quickHarvest);
    $("#qhPanel").addEventListener("click", function (e) {
      var b = e.target.closest("[data-qh-cite], [data-qh-add]");
      if (!b) return;
      if (b.hasAttribute("data-qh-cite")) {
        var r = adoptHarvest(+b.getAttribute("data-qh-cite"));
        if (r) { CW.closePops(); CW.insertCite(r.doi); }
      } else {
        var added = adoptHarvest(+b.getAttribute("data-qh-add"));
        b.disabled = true;
        b.textContent = added ? "Added to references/" + U.slug(added.subject) + "/" : "In your references";
        renderRefs($("#citeSearch").value);
      }
    });
    $("#citePop").addEventListener("click", function (e) {
      if (e.target.closest("#toggleExcluded")) { S.showExcluded = !S.showExcluded; renderRefs($("#citeSearch").value); return; }
      var b = e.target.closest(".ref[data-doi]");
      if (b) { CW.closePops(); CW.insertCite(b.getAttribute("data-doi")); }
    });

    document.addEventListener("keydown", function (e) { if (e.key === "Escape") CW.closePops(); });
    document.addEventListener("mousedown", function (e) {
      if ($("#eqPop").hidden && $("#citePop").hidden && !slash.open) return;
      if (e.target.closest("#eqPop, #citePop, #slashMenu, .tool, .eq, .as-card")) return;
      CW.closePops();
    });
  };
})();
