/* Claudito Writer mockup, round 2: the assistant and the "Show me how" demo. */
(function () {
  "use strict";
  var CW = window.CW, U = CW.util, $ = U.$, $$ = U.$$;
  var S = CW.state = CW.state || {};
  var STOP = ("a an and are as at be been by can could do does for from had has have how in into is it its may more most much of on or our over than that the their them "
    + "these this those to under use used uses using was we were what when which who why will with within without own often also add adds new one two three "
    + "project study paper research measures measure tends tend asks ask replaces replace tested test designed support supports adding "
    + "becomes become make makes made get gets give gives show shows shown find found need needs stop stops").split(" ");

  function titleKey(t) { return U.norm(String(t).replace(/^(chapter\s+\d+|[\d.]+|（[一二三四五六七八九十]+）)\s*/i, "")); }
  function sectionBlocks(title) {
    var out = [], on = false;
    S.doc.blocks.forEach(function (b) {
      if (b.t === "h") { on = b.text === title; return; }
      if (on) out.push(b);
    });
    return out;
  }
  function plain(text) { return String(text || "").replace(/\[CITE:[^\]]*\]/g, "").replace(/\[EQ:[^\]]*\]/g, "").replace(/\*\*/g, ""); }

  /* ── abstract -> keywords -> the research pipeline ── */
  function abstractText() {
    var h = S.doc.blocks.filter(function (b) { return b.t === "h" && /abstract/i.test(b.text); })[0];
    return h ? sectionBlocks(h.text).filter(function (b) { return b.t === "p"; }).map(function (b) { return plain(b.text); }).join(" ").trim() : "";
  }
  CW.keywords = function (text) {
    var tokens = String(text).toLowerCase().match(/[a-z][a-z-]*[a-z]|[a-z]/g) || [], freq = {}, runs = [], run = [];
    tokens.forEach(function (t) { if (STOP.indexOf(t) < 0 && t.length > 2) freq[t] = (freq[t] || 0) + 1; });
    tokens.forEach(function (t) {
      if (STOP.indexOf(t) < 0 && t.length > 2) run.push(t);
      else { if (run.length) runs.push(run); run = []; }
    });
    if (run.length) runs.push(run);
    var phrases = [];
    runs.forEach(function (r) {
      for (var i = 0; i < r.length; i += 3) {
        var p = r.slice(i, i + 3);
        phrases.push({ text: p.join(" "), score: p.reduce(function (s, w) { return s + freq[w]; }, 0) + (p.length > 1 ? 1 : 0) });
      }
    });
    var seen = {};
    return phrases.sort(function (a, b) { return b.score - a.score; })
      .filter(function (p) { if (seen[p.text]) return false; seen[p.text] = true; return true; })
      .slice(0, 5).map(function (p) { return p.text; });
  };

  /* ── tidy: a proposal only, never an edit (Claudito's plan organise) ── */
  function tidyProposal(title) {
    var text = sectionBlocks(title).filter(function (b) { return b.t === "p" && b.text; }).map(function (b) { return b.text; }).join(" ");
    if (!text.trim()) return null;
    var sentences = text.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [text];
    return sentences.map(function (s) {
      s = s.trim();
      var words = plain(s).split(/\s+/).filter(Boolean).length, notes = [];
      if (s.indexOf("[CITE:") < 0 && /\b(most|often|tends?|shows?|increase[sd]?|decrease[sd]?|always|never|usually|studies)\b|\d+%/i.test(s)) notes.push("a claim with no citation");
      if (words > 30) notes.push("long: consider splitting");
      return { s: plain(s), notes: notes };
    });
  }

  /* ── template check ── */
  function templateCheck() {
    var tpl = CW.TEMPLATES[S.doc.template] || CW.TEMPLATES.claudito, heads = S.doc.blocks.filter(function (b) { return b.t === "h" && b.level > 1; }).map(function (b) { return titleKey(b.text); });
    var items = tpl.needs.map(function (n) {
      var k = U.norm(n);
      return { label: n, ok: heads.some(function (h) { return (" " + h + " ").indexOf(" " + k + " ") >= 0; }), section: true };
    });
    var h1 = S.doc.blocks.filter(function (b) { return b.t === "h" && b.level === 1; })[0];
    items.unshift({ label: "Title", ok: !!(h1 && h1.text && h1.text !== "Untitled") });
    items.push({ label: "At least one citation", ok: S.doc.blocks.some(function (b) { return JSON.stringify(b).indexOf("[CITE:") >= 0; }) });
    return { tpl: tpl, items: items };
  }
  function addMissing() {
    CW.syncFromSheet();
    var missing = templateCheck().items.filter(function (i) { return i.section && !i.ok; });
    if (!missing.length) return;
    var blocks = S.doc.blocks, absIdx = -1;
    blocks.forEach(function (b, i) { if (absIdx < 0 && b.t === "h" && /abstract/i.test(b.text)) absIdx = i; });
    var insertAt = absIdx;
    if (absIdx >= 0) { insertAt = absIdx + 1; while (insertAt < blocks.length && blocks[insertAt].t !== "h") insertAt++; }
    missing.forEach(function (m) {
      var early = /keywords|highlights|abstract/i.test(m.label), pair = [{ t: "h", level: 2, text: m.label }, { t: "p", text: "", guide: "Needed by " + CW.TEMPLATES[S.doc.template].label + "." }];
      if (early && insertAt >= 0) { blocks.splice.apply(blocks, [insertAt, 0].concat(pair)); insertAt += 2; }
      else blocks.push.apply(blocks, pair);
    });
    CW.renderSheet();
    CW.pageChanged();
    CW.renderAssistant();
  }

  /* ── ask box: fuzzy commands and prepared equations (the local AI answers via bridge.js) ── */
  function answer(q) {
    var tokens = U.norm(q).split(" ").filter(function (t) { return t.length > 2 && STOP.indexOf(t) < 0; });
    if (!tokens.length) return "";
    var need = tokens.length === 1 ? 0.6 : 0.78;
    var eq = CW.EQ_SUGGESTIONS.map(function (s) { return { s: s, v: U.fuzzy(tokens.join(" "), s.name + " " + s.words) }; }).filter(function (x) { return x.v > 0; }).sort(function (a, b) { return b.v - a.v; })[0];
    if (eq && (/equation|formula/i.test(q) || tokens.length <= 3)) {
      return 'Prepared example: <b>' + U.esc(eq.s.name) + '</b> <span class="ieq">' + CW.renderEq(eq.s.src) + '</span> <button class="mini" type="button" data-as-eq="' + U.esc(eq.s.src) + '">Insert it</button>';
    }
    var best = null;
    CW.COMMANDS.forEach(function (c) {
      var v = Math.max.apply(null, tokens.map(function (t) { return U.fuzzy(t, c.label + " " + c.words); }));
      if (v >= need && (!best || v > best.v)) best = { c: c, v: v };
    });
    if (best) return 'Did you mean <b>' + U.esc(best.c.label) + '</b>? <button class="mini" type="button" data-as-cmd="' + best.c.id + '">Do it</button>';
    return "No AI answered this one. Is Ollama running? Type 'ai status' in clt to check. The built-in helpers still work: try a command ('tabel' finds Table) or an equation ('cronbach alpha').";
  }

  /* ── rendering ── */
  function refsHTML(sec) {
    var refs = CW.refsForSection(sec);
    return refs.length ? refs.slice(0, 4).map(CW.refButton).join("") : '<p class="none">No harvested subject is mapped to “' + U.esc(sec || "this part") + '” yet.</p>';
  }
  function abstractHTML() {
    var text = abstractText(), words = text ? text.split(/\s+/).length : 0;
    if (words < 20) {
      return '<h3>Prepare the research from your abstract</h3>' +
        "<p>Write at least 20 words in the Abstract (" + words + " so far). The assistant then offers to find and sort the papers you need.</p>";
    }
    var kw = CW.keywords(text);
    return '<h3>Prepare the research from your abstract</h3>' +
      '<p>Your abstract is ready (' + words + ' words). Terms found:</p><div class="as-row">' + kw.map(function (k) { return '<span class="kw">' + U.esc(k) + "</span>"; }).join("") + "</div>" +
      "<ul><li>Harvest papers on these terms into <code>references/&lt;subject&gt;/</code></li><li>Screen them: Include, Maybe or Exclude</li><li>Map subjects to your sections in <code>section_rules.txt</code></li><li>Suggest citations while you write</li></ul>" +
      '<div class="as-row"><button class="primary" type="button" data-as="prepare">Prepare my research</button></div><p id="asPrepared" hidden></p>';
  }
  function checkHTML() {
    var c = templateCheck(), missing = c.items.filter(function (i) { return i.section && !i.ok; }).length;
    return "<h3>Check against " + U.esc(c.tpl.label) + "</h3>" +
      '<ul class="check">' + c.items.map(function (i) { return '<li class="' + (i.ok ? "yes" : "no") + '">' + U.esc(i.label) + "</li>"; }).join("") + "</ul>" +
      (missing ? '<div class="as-row"><button class="mini" type="button" data-as="missing">Add the ' + missing + " missing section" + (missing > 1 ? "s" : "") + "</button></div>" : "");
  }
  CW.renderAssistant = function () {
    var sec = CW.currentSection() || S.asSection || "";
    S.asSection = sec;
    $("#sideAssistant").innerHTML =
      '<div class="as-head"><h2>Assistant</h2><p>Runs on your local AI (Ollama first, offline). It organises and suggests; it never writes your claims.</p>' +
      '<p class="as-where">You are in: <b id="asSection">' + U.esc(sec || "click somewhere in your text") + "</b></p></div>" +
      '<div class="as-body">' +
      '<div class="as-card"><h3>Citations for this section</h3><div class="refs" id="asRefs">' + refsHTML(sec) + '</div><p>From harvest subjects, screening and section_rules.txt. Click one to cite it where your cursor was.</p></div>' +
      '<div class="as-card" id="asAbstract">' + abstractHTML() + "</div>" +
      '<div class="as-card"><h3>Tidy this section</h3><p>Suggests a clearer order and flags claims without a citation. It saves a proposal; your text stays as you wrote it.</p>' +
      '<div class="as-row"><button class="mini" type="button" data-as="tidy">Suggest for “' + U.esc(sec || "this section") + '”</button></div><div class="proposal-box" id="asTidy" hidden></div></div>' +
      '<div class="as-card" id="asCheck">' + checkHTML() + "</div>" +
      '<div class="as-card"><h3>Ask, or tell it what to do</h3><div class="as-ask"><label class="sr" for="asAsk">Ask the assistant</label>' +
      '<input id="asAsk" autocomplete="off" placeholder="e.g. tabel, cronbach alpha, which papers?" value="' + U.esc(S.asQuestion || "") + '"><button class="primary" type="button" data-as="ask">Ask</button></div>' +
      '<p class="as-reply" id="asReply" hidden></p></div>' +
      "</div>";
    if (typeof CW.markReviewMarkers === "function") CW.markReviewMarkers();
  };
  CW.assistantRefresh = function () {
    if (S.side !== "assistant" || !$("#asRefs")) return;
    var sec = CW.currentSection() || S.asSection;
    S.asSection = sec;
    $("#asSection").textContent = sec || "click somewhere in your text";
    $("#asRefs").innerHTML = refsHTML(sec);
    if (!$("#asAbstract").contains(document.activeElement)) $("#asAbstract").innerHTML = abstractHTML();
    $("#asCheck").innerHTML = checkHTML();
    if (typeof CW.markReviewMarkers === "function") CW.markReviewMarkers();
  };
  var secTimer = null;
  CW.sectionMaybeChanged = function () {
    if (S.side !== "assistant") return;
    clearTimeout(secTimer);
    secTimer = setTimeout(function () { if (CW.currentSection() && CW.currentSection() !== S.asSection) CW.assistantRefresh(); }, 150);
  };

  /* ── "Show me how" ── */
  var STEPS = [
    ["#typeSel", "Pick what you are writing", "Research plan, journal paper, thesis or proposal. The outline comes from Claudito's own templates, and the grey questions say what goes where."],
    ["#tplSel", "Pick the template", "Elsevier, IEEE, Springer and the other templates Claudito already has. Change it any time: your text stays."],
    ["#sheet h2", "Write where the grey question is", "Each section starts with the question from the outline. Start typing and it disappears. It never goes into the PDF."],
    [".slash-hint", "Type / for anything", "On an empty line, type / and a word: /table, /figure, /cite. Typos are fine: /tabel still finds Table."],
    [".tbl", "Tables grow and shrink", "The bin removes a row or a column and ⊕ adds one, as in Astrolaby's tables. You can also import a CSV file."],
    ['.tool[data-cmd="cite"]', "Cite with suggestions", "Put the cursor in a section and press Cite. Papers harvested and screened for that section come first."],
    ['.tool[data-cmd="assistant"]', "Ask the assistant", "It suggests citations and equations, checks the template and proposes a tidier order. It never writes your claims."],
    ['.seg-btn[data-side="txt"]', "The text file is still there", "Project.txt is what Claudito builds the PDF from. Edit the file or the page: each one updates the other."],
    ['.seg-btn[data-side="tex"]', "LaTeX when you need it", "See the main.tex Claudito sends to LaTeX for your template, like Overleaf's source view."],
    ["#saveState", "It saves by itself", "Every pause writes Project plan/Project.txt, and Claudito rebuilds the PDF and Word file from it. Nothing else to press."]
  ];
  var tourAt = -1, pinged = null;
  function tourShow(i) {
    tourAt = i;
    if (pinged) pinged.classList.remove("ping");
    /* the online "Try it" page (CW_MODE = "try") ends the tour on Get Claudito */
    var step = i === STEPS.length - 1 && window.CW_MODE === "try"
      ? ["#getBtn", "Get Claudito", "Install it and write your own research this way. The getting-started guide takes about 30 minutes."]
      : STEPS[i];
    var target = $(step[0]) || $("#sheet"), card = $("#tour");
    $("#tourStep").textContent = "STEP " + (i + 1) + " OF " + STEPS.length;
    $("#tourTitle").textContent = step[1];
    $("#tourText").textContent = step[2];
    $("#tourBack").disabled = i === 0;
    $("#tourNext").textContent = i === STEPS.length - 1 ? "Done" : "Next";
    card.hidden = false;
    target.scrollIntoView({ behavior: U.motion(), block: "center" });
    target.classList.add("ping"); pinged = target;
    setTimeout(function () {
      var r = target.getBoundingClientRect(), h = card.offsetHeight, w = card.offsetWidth;
      var top = r.bottom + 10 + h > window.innerHeight - 70 ? r.top - h - 10 : r.bottom + 10;
      card.style.top = Math.max(8, top + window.scrollY) + "px";
      card.style.left = Math.max(16, Math.min(r.left + window.scrollX, document.documentElement.clientWidth - w - 16)) + "px";
      $("#tourNext").focus({ preventScroll: true });
    }, U.motion() === "smooth" ? 380 : 30);
  }
  function tourEnd() { $("#tour").hidden = true; if (pinged) pinged.classList.remove("ping"); pinged = null; tourAt = -1; }

  CW.initAssistant = function () {
    $("#sideAssistant").addEventListener("click", function (e) {
      var t = e.target, b;
      if ((b = t.closest(".ref[data-doi]"))) { CW.insertCite(b.getAttribute("data-doi")); return; }
      if ((b = t.closest("[data-as-cmd]"))) { CW.runCommand(b.getAttribute("data-as-cmd"), b); return; }
      if ((b = t.closest("[data-as-eq]"))) { CW.insertBlockHTML(CW.eqHTML({ src: b.getAttribute("data-as-eq") })); return; }
      if (!(b = t.closest("[data-as]"))) return;
      var act = b.getAttribute("data-as");
      if (act === "ask") {
        S.asQuestion = $("#asAsk").value;
        var replyBox = $("#asReply");
        if (typeof CW.askAI === "function") {
          /* bridge mode: the local AI answers first, heuristics if it can't */
          replyBox.textContent = "Asking your local AI…";
          replyBox.hidden = false;
          var asked = S.asQuestion;
          CW.askAI(asked, "", function (err, text) {
            if (S.asQuestion !== asked) return;
            if (err || !text) replyBox.innerHTML = answer(asked);
            else replyBox.textContent = text;
            replyBox.hidden = false;
          });
        } else {
          var reply = answer(S.asQuestion);
          replyBox.innerHTML = reply;
          replyBox.hidden = !reply;
        }
      } else if (act === "tidy") {
        var sec = S.asSection, list = sec ? tidyProposal(sec) : null, box = $("#asTidy");
        box.hidden = false;
        box.innerHTML = !list ? "Nothing written in this section yet."
          : "<ol>" + list.map(function (x) { return "<li>" + U.esc(x.s) + (x.notes.length ? ' <span class="badge Maybe">' + U.esc(x.notes.join(", ")) + "</span>" : "") + "</li>"; }).join("") + "</ol>" +
            "<p>Your text on the page is unchanged. Run <code>plan organise</code> in clt to save a tidy proposal to <code>Documents/organise-" + U.esc(U.slug(sec)) + ".txt</code>.</p>";
      } else if (act === "missing") addMissing();
      else if (act === "prepare") {
        var p = $("#asPrepared");
        p.hidden = false;
        p.textContent = "Run harvest in clt with these terms, then screen the results. This page does not search by itself.";
      }
    });
    $("#sideAssistant").addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.id === "asAsk") { e.preventDefault(); $('[data-as="ask"]').click(); }
    });
    $("#tourBtn").addEventListener("click", function () { tourShow(0); });
    $("#tourNext").addEventListener("click", function () { if (tourAt >= STEPS.length - 1) tourEnd(); else tourShow(tourAt + 1); });
    $("#tourBack").addEventListener("click", function () { if (tourAt > 0) tourShow(tourAt - 1); });
    $("#tourClose").addEventListener("click", tourEnd);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && tourAt >= 0) tourEnd(); });
  };
})();
