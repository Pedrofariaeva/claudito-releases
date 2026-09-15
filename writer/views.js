/* Claudito Writer mockup, round 2: beside-the-page views, research type and template, autosave. */
(function () {
  "use strict";
  var CW = window.CW, U = CW.util, $ = U.$, $$ = U.$$;
  var S = CW.state = CW.state || {};
  var CRUMB = { plan: "Project plan", paper: "Journal paper", conference: "Conference paper", thesis: "Thesis", proposal: "Research proposal" };

  /* ── storage ── */
  CW.loadDoc = function () {
    var sample = CW.sampleDoc(), saved = U.get("cw2.doc", null);
    if (!saved || !saved.blocks || !saved.blocks.length) return sample;
    var imgs = U.get("cw2.images", null) || {};
    return { type: saved.type || "plan", template: saved.template || "claudito", blocks: saved.blocks, images: Object.assign({}, sample.images, imgs) };
  };
  var saveTimer = null;
  CW.saveDoc = function () {
    var ok = U.set("cw2.doc", { type: S.doc.type, template: S.doc.template, blocks: S.doc.blocks });
    var imgsOk = ok && U.set("cw2.images", S.doc.images);
    var state = $("#saveState");
    state.classList.remove("busy");
    state.classList.toggle("warn", !imgsOk);
    $("#saveText").textContent = !U.canStore ? "Not kept: this browser blocks saving here"
      : !ok ? "Not saved: this browser is out of space"
      : !imgsOk ? "Saved, except the images (too big for this browser)" : "Saved just now";
    var d = new Date();
    $("#rebuild").textContent = "main.pdf and main.docx rebuilt at " + d.toTimeString().slice(0, 8);
  };
  function queueSave() {
    $("#saveState").classList.add("busy");
    $("#saveText").textContent = "Saving…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(CW.saveDoc, 450);
  }

  /* ── the page changed: update the model, the views beside it, and save ── */
  var pageTimer = null;
  CW.pageChanged = function () {
    $("#saveState").classList.add("busy");
    $("#saveText").textContent = "Saving…";
    clearTimeout(pageTimer);
    pageTimer = setTimeout(function () {
      CW.renumber();
      CW.syncFromSheet();
      if (S.side === "txt" && document.activeElement !== $("#txtEdit")) { S.files = CW.docToFiles(S.doc); renderTxt(); }
      if (S.side === "tex") renderTex();
      if (typeof CW.assistantRefresh === "function") CW.assistantRefresh();
      CW.saveDoc();
    }, 350);
  };

  /* ── beside the page ── */
  CW.showSide = function (name) {
    CW.closePops();
    if (S.side === "txt") {
      commitTab();
      if (txtTimer) {   /* apply text typed in the last half second before leaving the view */
        clearTimeout(txtTimer); txtTimer = null;
        try { S.doc = CW.filesToDoc(S.files, S.doc); CW.renderSheet(); } catch (e) {}
      }
    }
    S.side = name || "";
    $$(".beside .seg-btn").forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-side") === S.side)); });
    $("#side").hidden = !S.side;
    $("#panes").classList.toggle("split", !!S.side);
    $("#sideAssistant").hidden = S.side !== "assistant";
    $("#sideTxt").hidden = S.side !== "txt";
    $("#sideTex").hidden = S.side !== "tex";
    CW.syncFromSheet();
    if (S.side === "txt") { S.files = CW.docToFiles(S.doc); if (!S.files[S.txtTab]) S.txtTab = "Project.txt"; renderTxt(); }
    if (S.side === "tex") renderTex();
    if (S.side === "assistant" && typeof CW.renderAssistant === "function") CW.renderAssistant();
    if (S.side) $("#side").scrollIntoView({ behavior: U.motion(), block: "nearest" });
  };

  function renderTxt() {
    if (!S.txtTab || S.files[S.txtTab] == null) S.txtTab = "Project.txt";
    $("#txtTabs").innerHTML = Object.keys(S.files).map(function (n) {
      return '<button class="tab" type="button" role="tab" aria-selected="' + (n === S.txtTab) + '" data-tab="' + U.esc(n) + '">' + U.esc(n) + "</button>";
    }).join("");
    $("#txtEdit").value = S.files[S.txtTab];
    $("#txtFoot").classList.remove("warn");
    $("#txtFoot").textContent = S.txtTab === "Project.txt"
      ? "Tables live in their own CSV files: open their tabs to edit them as text too."
      : "One line per table row, cells separated by commas.";
  }
  function commitTab() { if (S.files && S.txtTab && !$("#sideTxt").hidden) S.files[S.txtTab] = $("#txtEdit").value; }
  function renderTex() { $("#texOut").textContent = CW.docToLatex(S.doc); }

  var txtTimer = null;
  function textChanged() {
    $("#txtFoot").textContent = "Updating the page…";
    clearTimeout(txtTimer);
    txtTimer = setTimeout(function () {
      txtTimer = null;
      commitTab();
      try {
        S.doc = CW.filesToDoc(S.files, S.doc);
        CW.renderSheet();
        $("#txtFoot").classList.remove("warn");
        $("#txtFoot").textContent = "The page is up to date with this file.";
      } catch (e) {
        $("#txtFoot").classList.add("warn");
        $("#txtFoot").textContent = "This line couldn't be read yet. Keep typing; the page updates when it can.";
        return;
      }
      if (typeof CW.assistantRefresh === "function") CW.assistantRefresh();
      queueSave();
    }, 500);
  }

  /* ── research type and template ── */
  function templatesFor(type) {
    return Object.keys(CW.TEMPLATES).filter(function (id) { return CW.TEMPLATES[id].types.indexOf(type) >= 0; });
  }
  CW.refreshDocbar = function () {
    var type = S.doc.type, tpls = templatesFor(type);
    if (tpls.indexOf(S.doc.template) < 0) S.doc.template = CW.DEFAULT_TEMPLATE[type] || tpls[0];
    $("#typeSel").innerHTML = CW.TYPES.map(function (t) { return '<option value="' + t.id + '"' + (t.id === type ? " selected" : "") + ">" + U.esc(t.label) + "</option>"; }).join("");
    $("#tplSel").innerHTML = tpls.map(function (id) { return '<option value="' + id + '"' + (id === S.doc.template ? " selected" : "") + ">" + U.esc(CW.TEMPLATES[id].label) + "</option>"; }).join("");
    var tInfo = CW.TYPES.filter(function (t) { return t.id === type; })[0], tpl = CW.TEMPLATES[S.doc.template];
    var note = (tInfo ? tInfo.note : "") + (tpl && tpl.proposal ? " · this template is a proposal too" : "");
    $("#typeNote").textContent = note;
    $("#typeNote").classList.toggle("proposal", /proposal/i.test(note) && type !== "proposal" || !!(tpl && tpl.proposal));
    $("#crumbDoc").textContent = CRUMB[type] || "Document";
  };

  function titleKey(t) { return U.norm(String(t).replace(/^(chapter\s+\d+|[\d.]+|（[一二三四五六七八九十]+）)\s*/i, "")); }
  function sameSection(a, b) {
    if (!a || !b) return false;
    return a === b || (" " + a + " ").indexOf(" " + b + " ") >= 0 || (" " + b + " ").indexOf(" " + a + " ") >= 0;
  }
  function hasContent(b) { return b.t === "p" ? !!b.text : true; }
  /* Rebuild the outline for a research type. Matching sections keep their text; nothing written is dropped. */
  CW.applyOutline = function (type) {
    CW.syncFromSheet();
    var title = null, pre = [], sections = [], cur = null;
    S.doc.blocks.forEach(function (b) {
      if (b.t === "h" && b.level === 1 && !title) { title = b; return; }
      if (b.t === "h") { cur = { head: b, body: [] }; sections.push(cur); return; }
      (cur ? cur.body : pre).push(b);
    });
    var used = [], out = [title || { t: "h", level: 1, text: "Untitled" }].concat(pre.filter(hasContent));
    CW.OUTLINES[type].forEach(function (o) {
      var k = titleKey(o[1]);
      var match = sections.filter(function (s) { return used.indexOf(s) < 0 && sameSection(titleKey(s.head.text), k); })[0];
      out.push({ t: "h", level: o[0], text: o[1] });
      if (!match) { out.push({ t: "p", text: "", guide: o[2] }); return; }
      used.push(match);
      var body = match.body.map(function (b) { var c = Object.assign({}, b); if (c.t === "p") c.guide = ""; return c; });
      if (body[0] && body[0].t === "p") body[0].guide = o[2]; else body.unshift({ t: "p", text: "", guide: o[2] });
      out = out.concat(body);
    });
    var leftovers = sections.filter(function (s) { return used.indexOf(s) < 0 && s.body.some(hasContent); });
    if (leftovers.length) {
      out.push({ t: "h", level: 2, text: "Kept from your previous outline" },
        { t: "p", text: "", guide: "These sections did not match the new outline. Move them where they belong, or delete them." });
      leftovers.forEach(function (s) { out.push({ t: "h", level: 3, text: s.head.text }); out = out.concat(s.body); });
    }
    S.doc.blocks = out;
    S.doc.type = type;
    CW.refreshDocbar();
    CW.renderSheet();
    CW.pageChanged();
  };

  CW.initViews = function () {
    $(".beside").addEventListener("click", function (e) {
      var b = e.target.closest(".seg-btn");
      if (b) CW.showSide(b.getAttribute("data-side"));
    });
    $("#txtTabs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-tab]");
      if (!b) return;
      commitTab();
      S.txtTab = b.getAttribute("data-tab");
      renderTxt();
    });
    $("#txtEdit").addEventListener("input", textChanged);
    $("#txtEdit").addEventListener("blur", function () {
      if (S.side !== "txt") return;
      clearTimeout(txtTimer);
      commitTab();
      try { S.doc = CW.filesToDoc(S.files, S.doc); CW.renderSheet(); } catch (e) { return; }
      S.files = CW.docToFiles(S.doc);
      var keep = $("#txtEdit").selectionStart;
      renderTxt();
      try { $("#txtEdit").selectionStart = $("#txtEdit").selectionEnd = keep; } catch (e) {}
      CW.saveDoc();
    });

    $("#typeSel").addEventListener("change", function () {
      var type = this.value, info = CW.TYPES.filter(function (t) { return t.id === type; })[0];
      S.pendingType = type;
      $("#outlineAskText").textContent = "Use the " + info.label.toLowerCase() + " outline (" + info.note.replace(/^Proposal: /, "proposal, ") + ")? Sections you already wrote keep their text; sections that don't fit move to the end.";
      $("#outlineAsk").hidden = false;
    });
    $("#outlineYes").addEventListener("click", function () {
      $("#outlineAsk").hidden = true;
      if (S.pendingType) CW.applyOutline(S.pendingType);
      S.pendingType = null;
      if (S.side === "tex") renderTex();
    });
    $("#outlineNo").addEventListener("click", function () {
      $("#outlineAsk").hidden = true;
      if (S.pendingType) { S.doc.type = S.pendingType; CW.refreshDocbar(); CW.pageChanged(); }
      S.pendingType = null;
    });
    $("#tplSel").addEventListener("change", function () {
      S.doc.template = this.value;
      CW.refreshDocbar();
      if (S.side === "tex") renderTex();
      if (typeof CW.assistantRefresh === "function") CW.assistantRefresh();
      CW.saveDoc();
    });

    var armed = null;
    $("#resetDoc").addEventListener("click", function () {
      var btn = this;
      if (!armed) {
        btn.textContent = "Click again to start over";
        armed = setTimeout(function () { armed = null; btn.textContent = "Start again"; }, 3500);
        return;
      }
      clearTimeout(armed); armed = null;
      btn.textContent = "Start again";
      CW.closePops();
      U.del("cw2.doc"); U.del("cw2.images");
      S.doc = CW.sampleDoc();
      $("#outlineAsk").hidden = true;
      CW.refreshDocbar();
      CW.renderSheet();
      CW.showSide(S.side);
      CW.saveDoc();
      $("#saveText").textContent = "Example restored";
    });
  };
})();
