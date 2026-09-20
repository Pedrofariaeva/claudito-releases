/* Claudito Writer bridge: when the page is served by `clt write` (the local
   bridge server injects window.CW_TOKEN), load/save go to the real
   "Project plan/Project.txt" via /api/files and the assistant asks the local
   AI via /api/ask. Opened as a plain file (the online sample), this script
   only defines boot and the localStorage behavior stays. */
(function () {
  "use strict";
  var CW = window.CW, U = CW.util, $ = U.$;
  var S = CW.state = CW.state || {};
  var TOKEN = window.CW_TOKEN || "";

  function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ "X-CW-Token": TOKEN }, opts.headers || {});
    var sep = path.indexOf("?") < 0 ? "?" : "&";
    return fetch(path + sep + "token=" + encodeURIComponent(TOKEN), opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
        return j;
      });
    });
  }
  function saveLine(text, warn) {
    var state = $("#saveState");
    if (!state) return;
    state.classList.remove("busy");
    state.classList.toggle("warn", !!warn);
    $("#saveText").textContent = text;
    if (!warn) {
      var d = new Date();
      $("#rebuild").textContent = "Project.txt saved at " + d.toTimeString().slice(0, 8);
    }
  }

  if (TOKEN) {
    /* ── bridge mode: the real project ── */
    if (window.CW_PROJECT) {
      var crumb = $("#crumbProject");
      if (crumb) crumb.textContent = window.CW_PROJECT;
    }

    CW.saveDoc = function () {
      var files = CW.docToFiles(S.doc);
      S.files = files;
      api("/api/files", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(files)
      }).then(function () {
        saveLine("Saved to Project.txt", false);
      }, function (err) {
        saveLine("Not saved: " + (err && err.message ? err.message : "the bridge is not answering"), true);
      });
    };

    /* The assistant's ask box goes to the local AI (assistant.js falls back
       to its built-in helpers when this errors). */
    CW.askAI = function (prompt, context, cb) {
      api("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt, context: context || "" })
      }).then(function (j) {
        if (j && j.answer) cb(null, j.answer);
        else cb(new Error((j && j.error) || "no answer"));
      }, function (e) { cb(e); });
    };

    /* Quick harvest (the Cite pop-up) searches the databases whose API is
       ready on this machine, through the bridge. Without the bridge the
       editor falls back to its example results. */
    CW.searchPapers = function (terms, cb) {
      api("/api/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms: terms })
      }).then(function (j) {
        if (j && j.error) cb(new Error(j.error));
        else cb(null, j);
      }, function (e) { cb(e); });
    };

    /* Templates: the real list is built from the project's
       templates/latex/papers/*.tex (data.js keeps only the offline-sample
       fallback). Existing entries keep their labels; the class line always
       follows the template file. */
    CW.fetchTemplates = function () { return api("/api/templates"); };
    function mergeTemplates(list) {
      (list || []).forEach(function (t) {
        if (!t || !t.id) return;
        if (CW.TEMPLATES[t.id]) {
          if (t.cls) CW.TEMPLATES[t.id].cls = t.cls;
        } else {
          CW.TEMPLATES[t.id] = { label: t.label || t.id, cls: t.cls || "\\documentclass{article}",
            types: ["plan", "paper"], needs: ["Abstract", "Keywords"] };
        }
      });
    }

    /* The Cite pop-up reads the project's own references/<subject>/ folders,
       with screening decisions (Exclude hidden) and section suggestions. */
    CW.fetchReferences = function (section, q, cb) {
      api("/api/references?section=" + encodeURIComponent(section || "") +
          "&q=" + encodeURIComponent(q || "")).then(function (j) {
        if (j && j.error) cb(new Error(j.error));
        else cb(null, j);
      }, function (e) { cb(e); });
    };

    /* Adopting a citation records it in the project (applied note +
       regenerated citations.bib), so it is real work, not session decoration. */
    CW.recordCite = function (doi, section) {
      api("/api/cite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doi: doi, section: section || "" })
      }).then(function () {}, function (err) {
        saveLine("Citation kept in the text, but recording it in the project failed: " +
          (err && err.message ? err.message : "the bridge is not answering"), true);
      });
    };

    /* Urgent pending harvests — the 'missing cite confirmation' markers. */
    CW.fetchPending = function (cb) {
      api("/api/pending").then(function (j) { cb(null, j); }, function (e) { cb(e); });
    };
    CW.savePending = function (item, cb) {
      api("/api/pending", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
      }).then(function (j) {
        if (j && j.error) cb(new Error(j.error));
        else cb(null, j);
      }, function (e) { cb(e); });
    };

    /* "Start again" would replace the real file with the example, so in
       bridge mode the button reloads from disk instead (wired in boot). */
    function reloadFromDisk() {
      api("/api/files").then(function (files) {
        S.files = files;
        S.doc = CW.filesToDoc(files, S.doc);
        CW.refreshDocbar();
        CW.renderSheet();
        CW.showSide(S.side);
        saveLine("Reloaded from Project.txt", false);
      }, function () {
        saveLine("Reload failed: the bridge is not answering", true);
      });
    }
    function patchReset() {
      var btn = $("#resetDoc");
      if (!btn) return;
      var fresh = btn.cloneNode(true);   /* drops the localStorage listener */
      btn.parentNode.replaceChild(fresh, btn);
      fresh.addEventListener("click", reloadFromDisk);
    }
  }

  function initApp() {
    CW.initEditor();
    CW.refreshDocbar();
    CW.renderSheet();
    CW.initViews();
    CW.initAssistant();
    if (TOKEN) patchReset();
  }

  CW.boot = function () {
    if (!TOKEN) {
      /* plain file / online sample: localStorage, no review sheet */
      S.doc = CW.loadDoc();
      initApp();
      return;
    }
    /* Bridge mode: the real template list (templates/latex/papers/*.tex) is
       merged over the offline-sample fallback before the docbar is drawn. */
    api("/api/templates").then(function (j) {
      mergeTemplates(j && j.templates);
    }, function () {}).then(function () {
      api("/api/files").then(function (files) {
        S.files = files;
        S.doc = CW.filesToDoc(files, null);
        initApp();
        saveLine("Loaded from Project.txt", false);
      }, function () {
        S.doc = CW.sampleDoc();
        initApp();
        saveLine("Bridge unreachable: showing an example, changes are NOT saved", true);
      });
    });
  };
})();
