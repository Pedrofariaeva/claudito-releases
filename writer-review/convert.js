/* Claudito Writer mockup, round 2: utilities and converters.
   One document model; the page, Project.txt (+ CSV files) and main.tex are all views of it. */
(function () {
  "use strict";
  var CW = window.CW = window.CW || {};
  var U = CW.util = {};

  U.$ = function (s, r) { return (r || document).querySelector(s); };
  U.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  U.esc = function (s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); };
  U.canStore = (function () { try { localStorage.setItem("cw2.probe", "1"); localStorage.removeItem("cw2.probe"); return true; } catch (e) { return false; } })();
  U.get = function (k, d) { try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  U.set = function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  U.del = function (k) { try { localStorage.removeItem(k); } catch (e) {} };
  U.motion = function () { try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"; } catch (e) { return "auto"; } };
  U.elOf = function (n) { return n ? (n.nodeType === 1 ? n : n.parentNode) : null; };
  U.trim = function (s) { return String(s).trim(); };

  /* ── fuzzy matching, in the spirit of Claudito's utils.fuzzy_ratio ── */
  U.norm = function (s) {
    s = String(s || "").toLowerCase();
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
    return s.replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").trim();
  };
  function lev(a, b) {
    var prev = [], cur, i, j;
    for (j = 0; j <= b.length; j++) prev[j] = j;
    for (i = 1; i <= a.length; i++) {
      cur = [i];
      for (j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[b.length];
  }
  U.ratio = function (a, b) { return a && b ? 1 - lev(a, b) / Math.max(a.length, b.length) : 0; };
  /* 0 = no match; otherwise higher is better. Every query word must match something. */
  U.fuzzy = function (query, text) {
    var q = U.norm(query).split(" ").filter(Boolean), words = U.norm(text).split(" ").filter(Boolean);
    if (!q.length) return 1;
    if (!words.length) return 0;
    var sum = 0, min = 1;
    q.forEach(function (t) {
      var best = 0;
      words.forEach(function (w) {
        var s = 0;
        if (w === t) s = 1;
        else if (w.indexOf(t) === 0) s = 0.95;
        else if (t.length >= 3 && w.indexOf(t) > 0) s = 0.85;
        else if (t.length >= 3) s = Math.max(U.ratio(t, w), U.ratio(t, w.slice(0, t.length)) - 0.05);
        if (s > best) best = s;
      });
      sum += best;
      if (best < min) min = best;
    });
    return min < 0.6 ? 0 : sum / q.length;
  };

  /* ── CSV ── */
  U.csvCell = function (v) { v = String(v).replace(/\u00a0/g, " ").trim(); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  U.toCSV = function (rows) { return rows.map(function (r) { return r.map(U.csvCell).join(","); }).join("\n") + "\n"; };
  U.parseCSV = function (text) {
    var rows = [], row = [], cell = "", q = false, i, c;
    text = String(text || "").replace(/\r\n?/g, "\n");
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (q) {
        if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += c;
      } else if (c === '"') q = true;
      else if (c === ",") { row.push(cell); cell = ""; }
      else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += c;
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
    rows = rows.filter(function (r) { return r.some(function (x) { return x.trim() !== ""; }); });
    var w = rows.reduce(function (m, r) { return Math.max(m, r.length); }, 0);
    return rows.map(function (r) { while (r.length < w) r.push(""); return r.map(U.trim); });
  };
  U.slug = function (name) {
    var s = String(name || "").toLowerCase();
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
    return s.replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  };

  /* ── references ── */
  CW.refByDoi = function (doi) { return CW.REFS.filter(function (r) { return r.doi === doi; })[0] || null; };
  CW.citeLabel = function (dois) {
    return "(" + dois.map(function (d) { var r = CW.refByDoi(d); return r ? r.key + ", " + r.year : d; }).join("; ") + ")";
  };
  CW.citeKey = function (doi) {
    var r = CW.refByDoi(doi);
    return r ? r.key.replace(/\s+/g, "") + r.year : String(doi).replace(/[^A-Za-z0-9]+/g, "");
  };

  /* ── equations: typed text -> HTML preview, and -> LaTeX ── */
  var GREEK = ["alpha", "beta", "gamma", "delta", "epsilon", "sigma", "mu", "pi", "theta", "lambda"];
  var GREEK_CH = { alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", sigma: "σ", mu: "μ", pi: "π", theta: "θ", lambda: "λ" };
  CW.renderEq = function (src) {
    var s = U.esc(src).replace(/sqrt\(/g, "√(").replace(/\bsum\b/g, "Σ").replace(/\bprod\b/g, "Π");
    /* (?![A-Za-z]) instead of \b so "lambda_j" and "beta_0" still turn into symbols */
    GREEK.forEach(function (g) { s = s.replace(new RegExp("\\b" + g + "(?![A-Za-z])", "g"), GREEK_CH[g]); });
    s = s.replace(/&lt;=/g, "≤").replace(/&gt;=/g, "≥").replace(/!=/g, "≠").replace(/\+-/g, "±").replace(/\binfinity\b/g, "∞")
      .replace(/\s*\*\s*/g, " × ");
    s = s.replace(/\^\{([^}]*)\}/g, "<sup>$1</sup>").replace(/\^([A-Za-z0-9α-ω]+)/g, "<sup>$1</sup>")
      .replace(/_\{([^}]*)\}/g, "<sub>$1</sub>").replace(/_([A-Za-z0-9α-ω]+)/g, "<sub>$1</sub>");
    s = s.replace(/ ([=+\-×≤≥≠±]) /g, function (m, op) { return ' <span class="op">' + (op === "-" ? "−" : op) + "</span> "; });
    return s || '<span class="eq-empty">Preview</span>';
  };
  CW.eqToLatex = function (src) {
    var s = String(src || "");
    for (var k = 0; k < 3 && /sqrt\(/.test(s); k++) s = s.replace(/sqrt\(([^()]*)\)/g, "\\sqrt{$1}");
    s = s.replace(/\bsum\b/g, "\\sum").replace(/\bprod\b/g, "\\prod");
    GREEK.forEach(function (g) { s = s.replace(new RegExp("(^|[^\\\\A-Za-z])" + g + "(?![A-Za-z])", "g"), "$1\\" + g); });
    s = s.replace(/<=/g, "\\leq ").replace(/>=/g, "\\geq ").replace(/!=/g, "\\neq ").replace(/\+-/g, "\\pm ").replace(/\binfinity\b/g, "\\infty")
      .replace(/\s*\*\s*/g, " \\times ")
      .replace(/_([A-Za-z0-9]{2,})/g, "_{$1}").replace(/\^([A-Za-z0-9]{2,})/g, "^{$1}");
    return s;
  };

  /* ── inline markup: **bold**, [CITE: doi, doi], [EQ: src] ── */
  var INLINE = /(\*\*[^*]+?\*\*|\[CITE:[^\]]*\]|\[EQ:[^\]]*\])/g;
  function dois(part) { return part.slice(6, -1).split(",").map(U.trim).filter(Boolean); }
  CW.inlineToHTML = function (text) {
    return String(text || "").split(INLINE).map(function (part, i) {
      if (i % 2 === 0) return U.esc(part);
      if (part.indexOf("**") === 0) return "<b>" + U.esc(part.slice(2, -2)) + "</b>";
      if (part.indexOf("[CITE:") === 0) {
        var d = dois(part);
        return '<span class="cite" contenteditable="false" data-doi="' + U.esc(d.join(", ")) + '">' + U.esc(CW.citeLabel(d)) + "</span>";
      }
      var src = part.slice(4, -1).trim();
      return '<span class="ieq" contenteditable="false" data-src="' + U.esc(src) + '">' + CW.renderEq(src) + "</span>";
    }).join("");
  };
  CW.htmlToInline = function (node) {
    var out = "";
    Array.prototype.forEach.call(node.childNodes, function (c) {
      if (c.nodeType === 3) out += c.nodeValue;
      else if (c.nodeType !== 1) return;
      else if (c.classList.contains("cite")) out += "[CITE: " + (c.getAttribute("data-doi") || "") + "]";
      else if (c.classList.contains("ieq")) out += "[EQ: " + (c.getAttribute("data-src") || "") + "]";
      else if (c.tagName === "B" || c.tagName === "STRONG") {
        var m = CW.htmlToInline(c).match(/^(\s*)([\s\S]*?)(\s*)$/);
        out += m[2] ? m[1] + "**" + m[2] + "**" + m[3] : m[1] + m[3];
      } else if (c.tagName === "BR") out += " ";
      else out += CW.htmlToInline(c);
    });
    return out.replace(/\u00a0/g, " ").replace(/[ \t\n]+/g, " ");
  };
  function texEsc(s) {
    return String(s || "").replace(/[\\&%$#_{}~^]/g, function (c) {
      return { "\\": "\\textbackslash{}", "~": "\\textasciitilde{}", "^": "\\textasciicircum{}" }[c] || "\\" + c;
    });
  }
  CW.inlineToLatex = function (text) {
    return String(text || "").split(INLINE).map(function (part, i) {
      if (i % 2 === 0) return texEsc(part);
      if (part.indexOf("**") === 0) return "\\textbf{" + texEsc(part.slice(2, -2)) + "}";
      if (part.indexOf("[CITE:") === 0) return "\\cite{" + dois(part).map(CW.citeKey).join(",") + "}";
      return "$" + CW.eqToLatex(part.slice(4, -1).trim()) + "$";
    }).join("");
  };

  /* ── model -> page HTML ── */
  var ICON_TRASH = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.6 4.5l.7 8.5h5.4l.7-8.5M7 7v4M9 7v4"/></svg>';
  var ICON_ADD = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5.3v5.4M5.3 8h5.4"/></svg>';
  CW.ICONS = { trash: ICON_TRASH, add: ICON_ADD };

  CW.tableHTML = function (b) {
    var rows = (b.rows && b.rows.length ? b.rows : [["Column 1", "Column 2"]]).map(function (r) { return r.slice(); });
    if (rows.length < 2) rows.push(rows[0].map(function () { return ""; }));
    var cols = rows[0].length, body = rows.length - 1;
    var top = '<tr class="ctl-row" contenteditable="false">' + rows[0].map(function (x, c) {
      return '<td class="ctl">' +
        (cols > 1 ? '<button type="button" class="ico" data-t="delcol" data-i="' + c + '" aria-label="Remove column ' + (c + 1) + '">' + ICON_TRASH + "</button>" : "") +
        (c === cols - 1 ? '<button type="button" class="ico add" data-t="addcol" aria-label="Add a column">' + ICON_ADD + "</button>" : "") + "</td>";
    }).join("") + '<td class="ctl"></td></tr>';
    var head = "<tr>" + rows[0].map(function (c) { return "<th>" + U.esc(c) + "</th>"; }).join("") + '<td class="ctl" contenteditable="false"></td></tr>';
    var bodyRows = rows.slice(1).map(function (r, ri) {
      return "<tr>" + r.map(function (c) { return "<td>" + U.esc(c) + "</td>"; }).join("") +
        '<td class="ctl" contenteditable="false">' +
        (body > 1 ? '<button type="button" class="ico" data-t="delrow" data-i="' + (ri + 1) + '" aria-label="Remove row ' + (ri + 1) + '">' + ICON_TRASH + "</button>" : "") +
        (ri === body - 1 ? '<button type="button" class="ico add" data-t="addrow" aria-label="Add a row">' + ICON_ADD + "</button>" : "") + "</td></tr>";
    }).join("");
    return '<figure class="blk tbl" contenteditable="false" data-name="' + U.esc(b.name || "") + '">' +
      '<figcaption><span class="lbl">Table.</span> <span class="cap" contenteditable="true">' + U.esc(b.caption || "") + "</span></figcaption>" +
      '<div class="tbl-scroll"><table contenteditable="true"><thead>' + top + head + "</thead><tbody>" + bodyRows + "</tbody></table></div>" +
      '<div class="blk-tools"><button class="mini" type="button" data-t="csv">Import a CSV file</button><button class="mini rm" type="button" data-t="rm">Remove table</button></div></figure>';
  };

  CW.figureHTML = function (b, images) {
    var paths = (b.images && b.images.length ? b.images : [""]).slice(0, 3), n = paths.length;
    var panels = paths.map(function (p, i) {
      var data = p && images ? images[p] : "";
      var inner = data
        ? (data.indexOf("<svg") === 0 ? data : '<img alt="" src="' + U.esc(data) + '">')
        : '<span class="ph">' + (p ? "No image loaded for " + U.esc(p) : "Drop an image here, or click to choose one") + "</span>";
      return '<div class="panel"><div class="drop' + (data ? " filled" : "") + '" role="button" tabindex="0" data-i="' + i + '" data-path="' + U.esc(p || "") + '" aria-label="Image ' + (i + 1) + ': choose or drop a file">' + inner + "</div>" +
        (n > 1 ? '<span class="sub">(' + "abc".charAt(i) + ")</span>" : "") + "</div>";
    }).join("");
    var seg = [1, 2, 3].map(function (k) {
      return '<button class="mini seg" type="button" data-t="n' + k + '" aria-pressed="' + (k === n) + '">' + k + "</button>";
    }).join("");
    return '<figure class="blk fig" contenteditable="false"><div class="panels n' + n + '">' + panels + "</div>" +
      '<figcaption><span class="lbl">Figure.</span> <span class="cap" contenteditable="true">' + U.esc(b.caption || "") + "</span></figcaption>" +
      '<div class="blk-tools"><span class="seg-l">Images side by side</span>' + seg + '<button class="mini rm" type="button" data-t="rm">Remove figure</button></div></figure>';
  };

  CW.eqHTML = function (b) {
    return '<div class="blk eq" contenteditable="false" data-src="' + U.esc(b.src) + '" role="button" tabindex="0" aria-label="Equation. Click to change it.">' +
      '<span class="eq-body">' + CW.renderEq(b.src) + '</span><span class="eq-no">(1)</span></div>';
  };

  CW.docToHTML = function (doc) {
    return doc.blocks.map(function (b) {
      if (b.t === "h") return "<h" + b.level + ">" + (CW.inlineToHTML(b.text) || "<br>") + "</h" + b.level + ">";
      if (b.t === "p") return "<p" + (b.guide ? ' data-guide="' + U.esc(b.guide) + '"' : "") + (b.text ? "" : ' class="is-empty"') + ">" + (CW.inlineToHTML(b.text) || "<br>") + "</p>";
      if (b.t === "ul" || b.t === "ol") return "<" + b.t + ">" + b.items.map(function (it) { return "<li>" + (CW.inlineToHTML(it) || "<br>") + "</li>"; }).join("") + "</" + b.t + ">";
      if (b.t === "table") return CW.tableHTML(b);
      if (b.t === "figure") return CW.figureHTML(b, doc.images);
      if (b.t === "eq") return CW.eqHTML(b);
      return "";
    }).join("");
  };

  /* ── page -> model ── */
  CW.readTable = function (fig) {
    var rows = U.$$("tr", fig).filter(function (tr) { return !tr.classList.contains("ctl-row"); }).map(function (tr) {
      return U.$$("th, td", tr).filter(function (c) { return !c.classList.contains("ctl"); })
        .map(function (c) { return c.textContent.replace(/\u00a0/g, " ").trim(); });
    }).filter(function (r) { return r.length; });
    var cap = U.$(".cap", fig);
    return { t: "table", name: fig.getAttribute("data-name") || "", caption: cap ? cap.textContent.trim() : "", rows: rows };
  };
  CW.readFigure = function (fig) {
    var cap = U.$(".cap", fig);
    return { t: "figure", images: U.$$(".drop", fig).map(function (d) { return d.getAttribute("data-path") || ""; }), caption: cap ? cap.textContent.trim() : "" };
  };
  CW.domToBlocks = function (sheet) {
    var blocks = [], guided = false;
    Array.prototype.forEach.call(sheet.children, function (el) {
      var tag = el.tagName;
      if (/^H[1-3]$/.test(tag)) { blocks.push({ t: "h", level: +tag.charAt(1), text: CW.htmlToInline(el).trim() }); guided = false; }
      else if (tag === "UL" || tag === "OL") blocks.push({ t: tag.toLowerCase(), items: U.$$("li", el).map(function (li) { return CW.htmlToInline(li).trim(); }) });
      else if (el.classList.contains("tbl")) blocks.push(CW.readTable(el));
      else if (el.classList.contains("fig")) blocks.push(CW.readFigure(el));
      else if (el.classList.contains("eq")) blocks.push({ t: "eq", src: el.getAttribute("data-src") || "" });
      else if (tag === "P" || tag === "DIV" || tag === "BLOCKQUOTE" || tag === "PRE") {
        var g = !guided ? el.getAttribute("data-guide") || "" : "";
        if (g) guided = true;
        blocks.push({ t: "p", text: CW.htmlToInline(el).trim(), guide: g });
      }
    });
    return blocks;
  };

  /* ── model -> Project.txt + CSV files ── */
  CW.docToFiles = function (doc) {
    var out = ["// Project.txt: the file Claudito builds your PDF, Word and LaTeX from.",
      "// Lines starting with // are notes for you. They never appear in the PDF.", ""];
    var files = { "Project.txt": "" }, used = {}, tn = 0;
    doc.blocks.forEach(function (b) {
      if (b.t === "h") out.push("#".repeat(b.level) + " " + b.text, "");
      else if (b.t === "p") {
        if (b.guide) out.push("// " + b.guide);
        if (b.text) out.push(b.text);
        if (b.guide || b.text) out.push("");
      } else if (b.t === "ul") { b.items.forEach(function (it) { out.push("- " + it); }); out.push(""); }
      else if (b.t === "ol") { b.items.forEach(function (it, i) { out.push((i + 1) + ". " + it); }); out.push(""); }
      else if (b.t === "table") {
        tn++;
        var name = b.name || "tables/table-" + tn + ".csv";
        while (used[name]) name = name.replace(/(\.csv)?$/, "-" + tn + ".csv");
        used[name] = true;
        b.name = name;
        out.push("[TABLE: " + name + "]");
        if (b.caption) out.push("Caption: " + b.caption);
        out.push("");
        files[name] = U.toCSV(b.rows);
      } else if (b.t === "figure") {
        var list = b.images.map(function (p) { return p || "(empty)"; }).join(", ");
        out.push("[FIGURE: " + list + "]");
        if (b.caption) out.push("Caption: " + b.caption);
        out.push("");
      } else if (b.t === "eq") out.push("[EQUATION: " + b.src + "]", "");
    });
    while (out.length && out[out.length - 1] === "") out.pop();
    files["Project.txt"] = out.join("\n") + "\n";
    return files;
  };

  /* ── Project.txt + CSV files -> model ── */
  CW.filesToDoc = function (files, prev) {
    var lines = String(files["Project.txt"] || "").replace(/\r\n?/g, "\n").split("\n");
    var blocks = [], para = [], list = null, guide = "", seenHeading = false, prevTables = {};
    ((prev && prev.blocks) || []).forEach(function (b) { if (b.t === "table" && b.name) prevTables[b.name] = b; });
    function flushPara() { if (para.length) { blocks.push({ t: "p", text: para.join(" "), guide: guide }); guide = ""; para = []; } }
    function flushList() { if (list) { blocks.push(list); list = null; } }
    function flushGuide() { if (guide) { blocks.push({ t: "p", text: "", guide: guide }); guide = ""; } }
    function flushAll() { flushPara(); flushList(); flushGuide(); }
    function captionAt(i) {
      var nx = lines[i + 1];
      return nx != null && /^\s*Caption:/i.test(nx) ? nx.replace(/^\s*Caption:\s*/i, "").trim() : null;
    }
    for (var i = 0; i < lines.length; i++) {
      var s = lines[i].trim(), m, cap;
      if (!s) { flushPara(); flushList(); continue; }
      if (s.indexOf("//") === 0) {
        flushPara(); flushList();
        if (seenHeading) { flushGuide(); guide = s.replace(/^\/\/\s?/, ""); }
        continue;
      }
      if ((m = s.match(/^(#{1,3})\s+(.*)$/))) { flushAll(); blocks.push({ t: "h", level: m[1].length, text: m[2].trim() }); seenHeading = true; continue; }
      if ((m = s.match(/^\[TABLE:\s*([^\]]*)\]$/i))) {
        flushAll();
        var name = m[1].trim();
        cap = captionAt(i); if (cap !== null) i++;
        var rows = files[name] != null ? U.parseCSV(files[name]) : (prevTables[name] ? prevTables[name].rows : null);
        if (!rows || !rows.length) rows = [["Column 1", "Column 2"], ["", ""]];
        if (rows.length < 2) rows.push(rows[0].map(function () { return ""; }));
        blocks.push({ t: "table", name: name, caption: cap || "", rows: rows });
        continue;
      }
      if ((m = s.match(/^\[FIGURE:\s*([^\]]*)\]$/i))) {
        flushAll();
        cap = captionAt(i); if (cap !== null) i++;
        var imgs = m[1].split(",").map(function (x) { x = x.trim(); return x === "(empty)" ? "" : x; }).slice(0, 3);
        blocks.push({ t: "figure", images: imgs.length ? imgs : [""], caption: cap || "" });
        continue;
      }
      if ((m = s.match(/^\[EQUATION:\s*(.*)\]$/i))) { flushAll(); blocks.push({ t: "eq", src: m[1].trim() }); continue; }
      if ((m = s.match(/^[-*]\s+(.*)$/))) {
        flushPara();
        if (!list || list.t !== "ul") { flushList(); flushGuide(); list = { t: "ul", items: [] }; }
        list.items.push(m[1]);
        continue;
      }
      if ((m = s.match(/^\d+[.)]\s+(.*)$/))) {
        flushPara();
        if (!list || list.t !== "ol") { flushList(); flushGuide(); list = { t: "ol", items: [] }; }
        list.items.push(m[1]);
        continue;
      }
      flushList();
      para.push(s);
    }
    flushAll();
    if (!blocks.length) blocks.push({ t: "p", text: "", guide: "" });
    return { type: prev ? prev.type : "plan", template: prev ? prev.template : "claudito", blocks: blocks, images: (prev && prev.images) || {} };
  };

  /* ── model -> main.tex ── */
  CW.docToLatex = function (doc) {
    var tpl = CW.TEMPLATES[doc.template] || CW.TEMPLATES.claudito, thesis = doc.type === "thesis";
    var head = ["% main.tex, built by Claudito from Project.txt", "% Template: " + tpl.label + (tpl.proposal ? " (proposal: not in Claudito yet)" : ""),
      tpl.cls, "\\usepackage{graphicx}", "\\usepackage{amsmath}", "\\usepackage{subcaption}", "\\usepackage{booktabs}", ""];
    var title = "", body = [], inAbstract = false, nt = 0, nf = 0, ne = 0;
    function closeAbstract() { if (inAbstract) { body.push("\\end{abstract}", ""); inAbstract = false; } }
    doc.blocks.forEach(function (b) {
      if (b.t === "h" && b.level === 1) { title = b.text; return; }
      if (b.t === "h") {
        closeAbstract();
        var clean = b.text.replace(/^(chapter\s+\d+|[\d.]+|（[一二三四五六七八九十]+）)\s*/i, "").trim() || b.text;
        if (b.level === 2 && /abstract/i.test(clean)) { body.push("\\begin{abstract}"); inAbstract = true; return; }
        body.push((b.level === 2 ? (thesis ? "\\chapter" : "\\section") : (thesis ? "\\section" : "\\subsection")) + "{" + CW.inlineToLatex(clean) + "}");
        return;
      }
      if (b.t === "p") {
        if (b.text) body.push(CW.inlineToLatex(b.text), "");
        else if (b.guide) body.push("% " + b.guide);
        return;
      }
      if (b.t === "ul" || b.t === "ol") {
        var env = b.t === "ul" ? "itemize" : "enumerate";
        body.push("\\begin{" + env + "}");
        b.items.forEach(function (it) { body.push("  \\item " + CW.inlineToLatex(it)); });
        body.push("\\end{" + env + "}", "");
        return;
      }
      closeAbstract();
      if (b.t === "table") {
        nt++;
        body.push("\\begin{table}[htbp]", "  \\centering", "  \\caption{" + CW.inlineToLatex(b.caption) + "}", "  \\label{tab:" + nt + "}",
          "  \\begin{tabular}{" + "l".repeat(b.rows[0].length) + "}", "    \\toprule",
          "    " + b.rows[0].map(CW.inlineToLatex).join(" & ") + " \\\\", "    \\midrule");
        b.rows.slice(1).forEach(function (r) { body.push("    " + r.map(CW.inlineToLatex).join(" & ") + " \\\\"); });
        body.push("    \\bottomrule", "  \\end{tabular}", "\\end{table}", "");
      } else if (b.t === "figure") {
        nf++;
        var n = b.images.length;
        body.push("\\begin{figure}[htbp]", "  \\centering");
        if (n === 1) body.push("  \\includegraphics[width=0.8\\linewidth]{" + (b.images[0] || "figures/missing") + "}");
        else b.images.forEach(function (p, i) {
          body.push("  \\begin{subfigure}{" + (n === 2 ? "0.48" : "0.32") + "\\linewidth}", "    \\includegraphics[width=\\linewidth]{" + (p || "figures/missing") + "}",
            "    \\caption{}", "  \\end{subfigure}" + (i < n - 1 ? "\\hfill" : ""));
        });
        body.push("  \\caption{" + CW.inlineToLatex(b.caption) + "}", "  \\label{fig:" + nf + "}", "\\end{figure}", "");
      } else if (b.t === "eq") {
        ne++;
        body.push("\\begin{equation}", "  " + CW.eqToLatex(b.src), "  \\label{eq:" + ne + "}", "\\end{equation}", "");
      }
    });
    closeAbstract();
    head.push("\\title{" + CW.inlineToLatex(title) + "}", "", "\\begin{document}", "\\maketitle", "");
    return head.concat(body, ["\\bibliographystyle{plain}", "\\bibliography{references}", "\\end{document}"]).join("\n") + "\n";
  };
})();
