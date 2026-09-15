/* Claudito Writer mockup, round 2: review sheet (Faction Wars pattern) and start-up. */
(function () {
  "use strict";
  var CW = window.CW, U = CW.util, $ = U.$, $$ = U.$$;
  var S = CW.state = CW.state || {};

  var ITEMS = [
    { n: 1, title: "Research type and template", tryit: "Change Research type to Journal paper and accept the outline, then change the Template. Is the outline what you expected?",
      hint: "Outlines come from Claudito's plan.txt and paper_structure.txt. The conference and thesis outlines are proposals." },
    { n: 2, title: "Table controls", tryit: "In the participants table, use a bin to remove a row or a column and ⊕ to add one. Try Import a CSV file.",
      hint: "Same pattern as Astrolaby's table editor: a bin on each, add on the last." },
    { n: 3, title: "Figures with 1, 2 or 3 images", tryit: "Figure 1 has two images. Switch it to 3 and fill the new panel, or insert a new figure.",
      hint: "Claudito's [FIGURE:] takes one image today, so several images is a proposal." },
    { n: 4, title: "Equation helper", tryit: "Click Equation and, under “Or describe it”, type cronbach alpha or u-value." },
    { n: 5, title: "Smart citations", tryit: "Click inside 1.2 State of Art, press Cite and look at the suggestions. Then search with a typo." },
    { n: 6, title: "The assistant", tryit: "Open the Assistant, click in different sections and try each card.",
      hint: "We read “auto editor” as Claudito's live auto-rebuild: main.pdf and main.docx are rebuilt when Project.txt is saved (the line next to “Saved”). If you meant something else, say so here." },
    { n: 7, title: "Quick commands", tryit: "On an empty line type /tab, /fig or /cite. Try a typo like /tabel." },
    { n: 8, title: "The text file, both ways", tryit: "Show the Text file and change a heading or a table cell in it: the page follows. Then change the page and watch the file.",
      hint: "Why it exists: Claudito builds the PDF, Word and LaTeX from Project.txt. The page is a friendlier way to write that same file." },
    { n: 9, title: "LaTeX", tryit: "Show LaTeX, then switch templates: the class line at the top changes to that publisher's." },
    { n: 10, title: "The abstract prepares the research", tryit: "Rewrite the Abstract (20 words or more) and open the Assistant: it lists the terms it would harvest." },
    { n: 11, title: "Show me how", tryit: "Press Show me how at the top and follow the steps." },
    { n: 12, title: "Overall", tryit: "Could your colleagues write a paper or a thesis with this instead of the text file?" }
  ];
  var CHANGES = [
    ["Toolbar: LaTeX and template choice", "Research type and Template at the top; LaTeX beside the page (parts 1 and 9)."],
    ["Table: remove row, Astrolaby logic", "A bin on every row and column, ⊕ on the last one, and CSV import (part 2)."],
    ["Figure: 1, 2 or 3 images", "1 to 3 images side by side, labelled (a), (b), (c) (part 3)."],
    ["Equation: an assistant", "A “describe it” helper inside the equation pop-up (part 4)."],
    ["Cite: intelligent", "Suggestions for the section you are in, from harvest subjects, screening and section rules; search allows typos (part 5)."],
    ["Autosave: what technology?", "Here, the browser's storage. In Claudito it would save Project.txt, and the live auto-rebuild makes the PDF and Word file."],
    ["Text file: what is it for?", "Explained on screen, and editable both ways (part 8)."],
    ["Overall: demo, template, research types, abstract", "Research types with their outlines, Show me how, and the abstract preparing the research (parts 1, 10 and 11)."],
    ["New idea: LLM helper, auto editor and fuzzy logic in sync", "The Assistant panel, and quick commands that allow typos (parts 6 and 7)."]
  ];
  var MAX_SHOTS = 4;
  var CLIP = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M10.5 4.5l-5 5a1.6 1.6 0 0 0 2.3 2.3l5.4-5.4a3 3 0 0 0-4.3-4.3L3.4 7.6a4.4 4.4 0 0 0 6.3 6.3l4.1-4.1"/></svg>';
  var STORE_TEXT = {
    local: "Kept on this device, even if you close the page.",
    volatile: "This device has no room left, so your marks last only until you close the page. Finish the review before closing.",
    shots: "Your screenshots are too big to keep on this device. Finish the review before you close the page.",
    badImage: "That file isn't an image this page can read. Try a PNG or JPEG screenshot.",
    off: "This browser isn't keeping your marks here, so finish the review before you close the page."
  };

  var review = U.get("cw2.review", null);
  if (!review || typeof review !== "object") review = {};
  if (!review.items || typeof review.items !== "object") review.items = {};
  var shots = U.get("cw2.shots", null);
  if (!shots || typeof shots !== "object") shots = {};

  function setStore(kind) { var el = $("#storeState"); if (!el) return; el.textContent = STORE_TEXT[kind]; el.classList.toggle("warn", kind !== "local"); }
  function item(n) { return review.items[n] || (review.items[n] = {}); }
  function saveReview() { if (!U.set("cw2.review", review)) setStore(U.canStore ? "volatile" : "off"); renderCounts(); CW.markReviewMarkers(); }
  function saveShots() { setStore(U.set("cw2.shots", shots) ? "local" : (U.canStore ? "shots" : "off")); }

  function verdictBtn(v, label, cur) { return '<button type="button" class="v ' + v + '" data-v="' + v + '" aria-pressed="' + (cur === v) + '">' + label + "</button>"; }
  function cardHTML(it) {
    var s = review.items[it.n] || {};
    return '<section class="card' + (s.v ? " v-" + s.v : "") + '" id="card-' + it.n + '" data-n="' + it.n + '">' +
      '<div class="card-h"><button class="pm' + (s.v ? " done" : "") + '" type="button" data-show="' + it.n + '" aria-label="Show part ' + it.n + '">' + it.n + "</button><h3>" + U.esc(it.title) + "</h3></div>" +
      '<p class="try">' + U.esc(it.tryit) + "</p>" + (it.hint ? '<p class="hint">' + U.esc(it.hint) + "</p>" : "") +
      '<div class="verdict" role="group" aria-label="' + U.esc(it.title) + '">' + verdictBtn("ok", "Confirm", s.v) + verdictBtn("no", "Not", s.v) + verdictBtn("inc", "Incomplete", s.v) + "</div>" +
      '<label class="sr" for="note-' + it.n + '">Note on ' + U.esc(it.title) + "</label>" +
      '<textarea id="note-' + it.n + '" rows="2" placeholder="What did you notice?">' + U.esc(s.note || "") + "</textarea>" +
      '<div class="att"><button type="button" class="attach" data-attach="' + it.n + '">' + CLIP + "<span>Attach a screenshot</span></button>" +
      '<div class="thumbs" id="thumbs-' + it.n + '"></div></div></section>';
  }
  function renderThumbs(n) {
    var list = shots[n] || [], box = $("#thumbs-" + n), btn = $('[data-attach="' + n + '"]');
    if (!box || !btn) return;
    box.innerHTML = list.map(function (im, i) {
      return '<span class="thumb"><img src="' + U.esc(im.data) + '" alt="' + U.esc(im.name) + '"><button type="button" data-rm="' + n + ":" + i + '" aria-label="Remove ' + U.esc(im.name) + '">×</button></span>';
    }).join("");
    btn.disabled = list.length >= MAX_SHOTS;
    $("span", btn).textContent = list.length >= MAX_SHOTS ? "Up to " + MAX_SHOTS + " screenshots" : (list.length ? "Attach another" : "Attach a screenshot");
  }
  function tally() {
    var c = { ok: 0, no: 0, inc: 0, left: 0 };
    ITEMS.forEach(function (it) { var v = (review.items[it.n] || {}).v; if (v === "ok" || v === "no" || v === "inc") c[v]++; else c.left++; });
    return c;
  }
  function renderCounts() {
    var c = tally();
    $("#counts").innerHTML = '<span class="c-ok">Confirm <b>' + c.ok + '</b></span><span class="c-no">Not <b>' + c.no + '</b></span><span class="c-inc">Incomplete <b>' + c.inc + "</b></span><span>" +
      (c.left ? c.left + " still to mark" : "All " + ITEMS.length + " parts marked") + "</span>";
  }
  CW.markReviewMarkers = function () {
    $$(".pm[data-card]").forEach(function (b) { b.classList.toggle("done", !!(review.items[b.getAttribute("data-card")] || {}).v); });
  };

  function showPart(n) {
    var target;
    if (n === "12") target = $("#sheet");
    else {
      if (n === "10" && S.side !== "assistant") CW.showSide("assistant");
      target = $$(".pm[data-card='" + n + "']").filter(function (b) { return !b.closest("#review"); })[0];
    }
    if (!target) return;
    target.scrollIntoView({ behavior: U.motion(), block: "center" });
    target.classList.add("ping");
    setTimeout(function () { target.classList.remove("ping"); }, 1300);
  }

  function attachFiles(n, files) {
    var bad = false;
    files.reduce(function (chain, f) {
      return chain.then(function () {
        if ((shots[n] || []).length >= MAX_SHOTS) return;
        return CW.shrink(f, 1200, 0.78).then(function (data) {
          (shots[n] = shots[n] || []).push({ name: f.name || "screenshot.png", data: data });
        }, function () { bad = true; });
      });
    }, Promise.resolve()).then(function () { renderThumbs(n); saveShots(); if (bad) setStore("badImage"); });
  }

  function pad(x) { return (x < 10 ? "0" : "") + x; }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function buildReport() {
    var c = tally(), lines = [], shotLines = [], TAG = { ok: "CONFIRM", no: "NOT", inc: "INCOMPLETE" };
    ITEMS.forEach(function (it) {
      var s = review.items[it.n] || {}, note = (s.note || "").trim();
      if (s.v || note) lines.push("[" + (TAG[s.v] || "NOTE") + "] " + it.n + ". " + it.title + (note ? " — " + note.replace(/\n+/g, "\n    ") : ""));
      (shots[it.n] || []).forEach(function (im) { shotLines.push(" - " + it.n + ". " + it.title + ": " + im.name); });
    });
    var idea = (review.idea || "").trim(), out = [
      "CLAUDITO WRITER — MOCKUP REVIEW (ROUND 2)",
      "Date: " + today() + "   Reviewer: " + ((review.reviewer || "").trim() || "(no name)"),
      "Summary: Confirm " + c.ok + " · Not " + c.no + " · Incomplete " + c.inc + " · Not marked " + c.left, ""];
    if (idea) out.push("NEW IDEA: " + idea.replace(/\n+/g, "\n    "), "");
    out.push("PARTS (marked or noted):", lines.length ? lines.join("\n") : "(nothing marked yet)", "",
      "SCREENSHOTS (" + shotLines.length + "):", shotLines.length ? shotLines.join("\n") : "(none)");
    return out.join("\n") + "\n";
  }
  function reviewFile() {
    var figs = [];
    ITEMS.forEach(function (it) {
      (shots[it.n] || []).forEach(function (im) {
        figs.push('<figure><img src="' + U.esc(im.data) + '" alt=""><figcaption>' + it.n + ". " + U.esc(it.title) + " · " + U.esc(im.name) + "</figcaption></figure>");
      });
    });
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Claudito Writer review, round 2</title><style>' +
      "body{font:15px/1.5 system-ui,sans-serif;color:#1B2126;background:#fff;max-width:780px;margin:0 auto;padding:24px 16px}h1{font-size:22px;margin:0 0 12px}h2{font-size:17px;margin:28px 0 10px}" +
      "pre{white-space:pre-wrap;background:#F1F4F5;border-radius:4px;padding:14px;font:13px/1.55 ui-monospace,Menlo,monospace}figure{margin:0 0 22px}img{max-width:100%;border:1px solid #D6DCE0}figcaption{font-size:13px;color:#56616A;margin-top:4px}" +
      "</style></head><body><h1>Claudito Writer review, round 2</h1><pre>" + U.esc(buildReport()) + "</pre>" + (figs.length ? "<h2>Screenshots</h2>" + figs.join("") : "") + "</body></html>";
  }
  function fileName() {
    var who = (review.reviewer || "").trim().toLowerCase();
    try { who = who.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) {}
    who = who.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
    return "claudito-writer-review-round2-" + (who ? who + "-" : "") + today() + ".html";
  }

  function initReview() {
    var rv = $("#review");
    rv.innerHTML =
      '<div class="rev-head"><h2>Review sheet</h2><p>One card per numbered part. Add a note or a screenshot wherever something is unclear.</p>' +
      '<label class="field-l" for="reviewer">Your name</label><input id="reviewer" autocomplete="name" placeholder="So Pedro knows who wrote it">' +
      '<p class="store" id="storeState">' + STORE_TEXT.local + "</p></div>" +
      '<details class="changes" open><summary>What changed since Pedro’s review</summary><ol>' +
      CHANGES.map(function (c) { return '<li><span class="was">' + U.esc(c[0]) + "</span>" + U.esc(c[1]) + "</li>"; }).join("") + "</ol></details>" +
      '<div class="cards" id="cards">' + ITEMS.map(cardHTML).join("") + "</div>" +
      '<div class="idea"><label for="idea">A new idea</label><p>Something this editor should do that isn\'t here?</p><textarea id="idea" rows="3" placeholder="Anything at all"></textarea></div>';
    ITEMS.forEach(function (it) { renderThumbs(it.n); });
    $("#reviewer").value = review.reviewer || "";
    $("#idea").value = review.idea || "";
    renderCounts();
    CW.markReviewMarkers();

    rv.addEventListener("click", function (e) {
      var t = e.target, hit;
      if ((hit = t.closest(".v"))) {
        var card = hit.closest(".card"), n = card.getAttribute("data-n"), s = item(n), val = hit.getAttribute("data-v");
        s.v = s.v === val ? "" : val;
        $$(".v", card).forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-v") === s.v)); });
        card.classList.remove("v-ok", "v-no", "v-inc");
        if (s.v) card.classList.add("v-" + s.v);
        saveReview();
      } else if ((hit = t.closest("[data-attach]"))) {
        S.attachFor = hit.getAttribute("data-attach"); $("#attachPick").click();
      } else if ((hit = t.closest("[data-rm]"))) {
        var p = hit.getAttribute("data-rm").split(":");
        (shots[p[0]] || []).splice(+p[1], 1);
        renderThumbs(p[0]); saveShots();
      } else if ((hit = t.closest("[data-show]"))) showPart(hit.getAttribute("data-show"));
    });
    rv.addEventListener("input", function (e) {
      var id = e.target.id || "";
      if (id === "reviewer") review.reviewer = e.target.value;
      else if (id === "idea") review.idea = e.target.value;
      else if (id.indexOf("note-") === 0) item(id.slice(5)).note = e.target.value;
      else return;
      saveReview();
    });
    $("#attachPick").addEventListener("change", function (e) {
      var files = Array.prototype.slice.call(e.target.files || []), n = S.attachFor;
      e.target.value = "";
      if (n && files.length) attachFiles(n, files);
    });
    document.addEventListener("click", function (e) {
      var b = e.target.closest(".pm[data-card]");
      if (!b || b.closest("#review")) return;
      var card = $("#card-" + b.getAttribute("data-card"));
      if (!card) return;
      card.scrollIntoView({ behavior: U.motion(), block: "nearest" });
      card.classList.add("flash");
      setTimeout(function () { card.classList.remove("flash"); }, 1300);
    });
    window.addEventListener("dragover", function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], "Files") >= 0) e.preventDefault(); });
    window.addEventListener("drop", function (e) {
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault();
      var card = e.target.closest && e.target.closest(".card");
      if (card) attachFiles(card.getAttribute("data-n"), Array.prototype.filter.call(e.dataTransfer.files, function (f) { return /^image\//.test(f.type); }));
    });

    var dlg = $("#reportDlg"), downloads = null;
    $("#finish").addEventListener("click", function () {
      $("#reportText").value = buildReport();
      $("#copyReport").textContent = "Copy report";
      $("#saveFile").textContent = "Save review file";
      $("#reportWhere").textContent = downloads
        ? "Save it as one file, with your screenshots inside, and send that file to Pedro. Or copy the text."
        : "Copy it and send it to Pedro, with any screenshots you attached.";
      if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    });
    $("#closeReport").addEventListener("click", function () { if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); });
    $("#copyReport").addEventListener("click", function () {
      var ta = $("#reportText"), btn = this;
      function selectIt() { ta.focus(); ta.select(); btn.textContent = "Selected: press ⌘C or Ctrl+C"; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(ta.value).then(function () { btn.textContent = "Copied"; }, selectIt);
      else selectIt();
    });
    $("#saveFile").addEventListener("click", function () {
      if (!downloads) return;
      var btn = this, msg = $("#reportWhere");
      downloads.save({ filename: fileName(), data: new Blob([reviewFile()], { type: "text/html" }) }).then(function () {
        btn.textContent = "Saved";
        msg.textContent = "Saved. Send that file to Pedro: the report and your screenshots are inside.";
      }, function (err) {
        var code = err && err.code;
        if (code === "declined") return;
        if (code === "rate_limited") { msg.textContent = "A save prompt is already open. Answer that one first."; return; }
        btn.hidden = true; $("#copyReport").className = "primary";
        msg.textContent = "Files can't be saved from this page here. Copy the report and send your screenshots with it.";
      });
    });
    if (window.claude && typeof window.claude.use === "function") {
      window.claude.use("downloads").then(function (ns) {
        if (!ns) return;
        downloads = ns; $("#saveFile").hidden = false; $("#copyReport").className = "ghost";
      }, function () {});
    }
  }

  CW.boot = function () {
    S.doc = CW.loadDoc();
    CW.initEditor();
    CW.refreshDocbar();
    CW.renderSheet();
    CW.initViews();
    CW.initAssistant();
    initReview();
    if (!U.canStore) setStore("off");
  };
})();
