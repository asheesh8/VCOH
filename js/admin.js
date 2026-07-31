/* Vermont Comforts of Home — site editor.
   Edits a draft copy of data/content.json in the browser, then hands it back
   as a file to publish. Page text is edited inside the preview frame by
   js/editor.js; staff are edited here. */
(function () {
  "use strict";

  var DATA_URL = "data/content.json";
  var DRAFT_KEY = "vcoh:draft";

  var PAGES = [
    { file: "index.html", name: "Home" },
    { file: "participants.html", name: "Participants" },
    { file: "home-care-providers.html", name: "Home Care Providers" },
    { file: "about.html", name: "About" },
    { file: "contact.html", name: "Contact" }
  ];

  var published = null;     /* what is live */
  var draft = null;         /* unpublished changes, or null */
  var current = PAGES[0].file;
  var frameStale = false;
  var loadError = false;
  var saveTimer = null;
  var dirtyLocal = false;   /* in-memory edits not yet written to storage */

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var clone = function (o) { return JSON.parse(JSON.stringify(o)); };

  var els = {
    status: $("#status"), tabs: $("#tabs"), pagelist: $("#pagelist"), pagesel: $("#pagesel"),
    frame: $("#frame"), stage: $("#stage"), widths: $("#widths"), teamlist: $("#teamlist"),
    changes: $("#changes"), badge: $("#tabbadge"), pagenav: $("#pagenav")
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function initials(name) {
    var w = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!w.length) return "?";
    return ((w[0][0] || "") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
  }

  var ICON = {
    up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'
  };

  /* =========================================================
     Draft storage
     ========================================================= */
  function readDraft() {
    try {
      var raw = localStorage.getItem(DRAFT_KEY);
      draft = raw ? JSON.parse(raw) : null;
    } catch (e) { draft = null; }
    return draft;
  }

  function working() {
    return draft || published || { version: 1, pages: {}, team: [] };
  }

  /* Pick up whatever the preview frame wrote — but never on top of typing that
     has not been flushed yet, or the pending keystrokes are lost. */
  function editable() {
    if (!dirtyLocal) readDraft();
    if (!draft) draft = clone(published || { version: 1, pages: {}, team: [] });
    draft.pages = draft.pages || {};
    draft.team = draft.team || [];
    return draft;
  }

  function commit(rerender) {
    clearTimeout(saveTimer);
    saveTimer = null;
    draft.updated = new Date().toISOString();
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      dirtyLocal = false;
    } catch (e) {
      alert("Could not save — browser storage is full. Try removing large replacement photos.");
      return;
    }
    if (current === "about.html") frameStale = true;
    refresh();
    if (rerender) renderTeam();
  }

  function commitSoon() {
    dirtyLocal = true;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { commit(false); }, 400);
  }

  function flush() {
    if (saveTimer && draft) commit(false);
  }

  function dropDraft() {
    /* Stop the preview frame writing first — an edit still in progress there
       would save itself back over the draft we are about to delete. */
    try {
      els.frame.contentWindow.postMessage({ source: "vcoh-admin", type: "discard" }, location.origin);
    } catch (e) {}
    try { localStorage.removeItem(DRAFT_KEY); } catch (e) {}
    draft = null;
    clearTimeout(saveTimer);
    saveTimer = null;
    dirtyLocal = false;
    load().then(function () {
      renderTeam();
      reloadFrame();
    });
  }

  /* =========================================================
     Status / changes
     ========================================================= */
  function countPeople(team) {
    return (team || []).reduce(function (n, o) {
      return n + (o.tiers || []).reduce(function (m, t) { return m + (t.people || []).length; }, 0);
    }, 0);
  }

  function pageEdits(file) {
    var a = (working().pages || {})[file];
    a = (a && a.sections) || {};
    var b = ((published || {}).pages || {})[file];
    b = (b && b.sections) || {};
    var n = 0;
    Object.keys(a).forEach(function (k) { if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) n++; });
    Object.keys(b).forEach(function (k) { if (!(k in a)) n++; });
    return n;
  }

  function changeList() {
    var out = [];
    PAGES.forEach(function (p) {
      var n = pageEdits(p.file);
      if (n) out.push({ k: p.name, v: n === 1 ? "1 block edited" : n + " blocks edited", n: n });
    });
    var a = working().team || [], b = (published || {}).team || [];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      var na = countPeople(a), nb = countPeople(b), v;
      if (na > nb) v = (na - nb) + " added · " + na + " people listed";
      else if (na < nb) v = (nb - na) + " removed · " + na + " people listed";
      else v = "details updated · " + na + " people listed";
      out.push({ k: "Staff", v: v, n: Math.abs(na - nb) || "•" });
    }
    return out;
  }

  function refresh() {
    var list = changeList();
    var total = list.reduce(function (n, c) { return n + (typeof c.n === "number" ? c.n : 1); }, 0);
    var dot = $(".dot", els.status), txt = $(".txt", els.status);

    if (loadError) {
      els.status.classList.add("dirty");
      txt.textContent = "Could not load content.json";
      dot.style.background = "#d8564f";
    } else if (total) {
      els.status.classList.add("dirty");
      txt.textContent = total === 1 ? "1 unpublished change" : total + " unpublished changes";
      dot.style.background = "";
    } else {
      els.status.classList.remove("dirty");
      txt.textContent = "Everything is published";
      dot.style.background = "";
    }

    els.badge.hidden = !total;
    els.badge.textContent = total;
    $("#discard").disabled = !draft;

    els.changes.innerHTML = list.length
      ? list.map(function (c) {
          return '<div class="change"><span class="k">' + esc(c.k) + '</span>' +
            '<span class="v">' + esc(c.v) + '</span><span class="n">' + esc(c.n) + "</span></div>";
        }).join("")
      : '<p class="empty">No unpublished changes — the live site matches what you see here.</p>';

    $$(".ad-pages button").forEach(function (b) {
      var n = pageEdits(b.dataset.page);
      var tag = $(".n", b);
      if (n && !tag) {
        tag = document.createElement("span");
        tag.className = "n";
        b.appendChild(tag);
      }
      if (tag) { tag.textContent = n; tag.hidden = !n; }
    });
  }

  /* =========================================================
     Pages
     ========================================================= */
  function renderPageList() {
    els.pagelist.innerHTML = PAGES.map(function (p) {
      return '<button type="button" data-page="' + p.file + '"' + (p.file === current ? ' class="on"' : "") +
        ">" + esc(p.name) + "</button>";
    }).join("");
    els.pagesel.innerHTML = PAGES.map(function (p) {
      return '<option value="' + p.file + '"' + (p.file === current ? " selected" : "") + ">" + esc(p.name) + "</option>";
    }).join("");
  }

  function reloadFrame() {
    frameStale = false;
    els.pagesel.value = current;
    els.frame.src = current + "?vcohedit=1&t=" + Date.now();
  }

  function goToPage(file) {
    if (file === current && !frameStale) return;
    try { els.frame.contentWindow.postMessage({ source: "vcoh-admin", type: "blur" }, location.origin); } catch (e) {}
    current = file;
    $$(".ad-pages button").forEach(function (b) { b.classList.toggle("on", b.dataset.page === file); });
    els.pagesel.value = file;
    setTimeout(reloadFrame, 30);
  }

  els.pagelist.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-page]");
    if (b) { showTab("pages"); goToPage(b.dataset.page); }
  });
  els.pagesel.addEventListener("change", function () { goToPage(els.pagesel.value); });

  els.widths.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-w]");
    if (!b) return;
    $$("button", els.widths).forEach(function (x) { x.classList.toggle("on", x === b); });
    els.stage.dataset.w = b.dataset.w;
  });

  /* =========================================================
     Tabs
     ========================================================= */
  function showTab(name) {
    flush();
    $$("#tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.tab === name); });
    $$(".ad-panel").forEach(function (p) { p.classList.toggle("on", p.dataset.panel === name); });
    els.pagenav.hidden = name !== "pages";
    if (name === "pages" && frameStale) reloadFrame();
    if (name === "team") renderTeam();
  }

  els.tabs.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-tab]");
    if (b) showTab(b.dataset.tab);
  });
  $("#gopublish").addEventListener("click", function () { showTab("publish"); });

  /* =========================================================
     Staff editor
     ========================================================= */
  function personRow(o, t, i, p, lead) {
    return '<div class="prow' + (lead ? " lead" : "") + '" data-org="' + o + '" data-tier="' + t + '" data-person="' + i + '">' +
      '<span class="av">' + esc(initials(p.name)) + "</span>" +
      '<input type="text" class="nm" data-field="name" value="' + esc(p.name || "") + '" placeholder="Full name" />' +
      '<input type="text" data-field="role" value="' + esc(p.role || "") + '" placeholder="Job title" />' +
      '<button type="button" class="icon-btn" data-act="pup" title="Move up">' + ICON.up + "</button>" +
      '<button type="button" class="icon-btn" data-act="pdown" title="Move down">' + ICON.down + "</button>" +
      '<button type="button" class="icon-btn rm" data-act="pdel" title="Remove">' + ICON.x + "</button>" +
      "</div>";
  }

  function tierBox(o, t, tier) {
    return '<div class="tier-box" data-org="' + o + '" data-tier="' + t + '">' +
      '<div class="tier-top">' +
        '<input type="text" data-field="label" value="' + esc(tier.label || "") + '" placeholder="Group name (e.g. Supervisors)" />' +
        '<label class="chk"><input type="checkbox" data-field="lead"' + (tier.lead ? " checked" : "") + " /> Highlight</label>" +
        '<button type="button" class="icon-btn" data-act="tup" title="Move group up">' + ICON.up + "</button>" +
        '<button type="button" class="icon-btn" data-act="tdown" title="Move group down">' + ICON.down + "</button>" +
        '<button type="button" class="icon-btn rm" data-act="tdel" title="Remove group">' + ICON.x + "</button>" +
      "</div>" +
      '<div class="people-rows">' +
        (tier.people || []).map(function (p, i) { return personRow(o, t, i, p, tier.lead); }).join("") +
      "</div>" +
      '<div class="row-actions"><button type="button" class="ad-btn light" data-act="padd">' + ICON.plus + "Add person</button></div>" +
      "</div>";
  }

  function orgCard(org, o) {
    return '<div class="card" data-org="' + o + '">' +
      "<header>" +
        (org.logo ? '<img src="' + esc(org.logo) + '" alt="" />' : "") +
        "<h3>" + esc(org.name || "Untitled organisation") + "</h3>" +
        '<div class="sp">' +
          '<button type="button" class="icon-btn" data-act="oup" title="Move up">' + ICON.up + "</button>" +
          '<button type="button" class="icon-btn" data-act="odown" title="Move down">' + ICON.down + "</button>" +
          '<button type="button" class="icon-btn rm" data-act="odel" title="Remove organisation">' + ICON.x + "</button>" +
        "</div>" +
      "</header>" +
      '<div class="body">' +
        '<div class="grid2">' +
          '<div class="f"><label>Organisation name</label><input type="text" data-field="name" value="' + esc(org.name || "") + '" /></div>' +
          '<div class="f"><label>Phone</label><input type="text" data-field="phone" value="' + esc(org.phone || "") + '" /></div>' +
          '<div class="f"><label>Address</label><input type="text" data-field="address" value="' + esc(org.address || "") + '" /></div>' +
          '<div class="f"><label>Website address</label><input type="text" data-field="url" value="' + esc(org.url || "") + '" placeholder="https://example.org" /></div>' +
          '<div class="f"><label>Website shown as</label><input type="text" data-field="urlLabel" value="' + esc(org.urlLabel || "") + '" placeholder="example.org" /></div>' +
          '<div class="f"><label>Logo file</label><input type="text" data-field="logo" value="' + esc(org.logo || "") + '" placeholder="assets/images/logo.jpg" /></div>' +
        "</div>" +
        (org.tiers || []).map(function (t, i) { return tierBox(o, i, t); }).join("") +
        '<div style="margin-top:16px"><button type="button" class="ad-btn light" data-act="tadd">' + ICON.plus + "Add a role group</button></div>" +
      "</div></div>";
  }

  function renderTeam() {
    var team = working().team || [];
    els.teamlist.innerHTML = team.length
      ? team.map(orgCard).join("")
      : '<p class="empty">No organisations yet — add one below.</p>';
  }

  function ctx(node) {
    var card = node.closest("[data-org]");
    var box = node.closest(".tier-box");
    var row = node.closest(".prow");
    var d = editable();
    var o = card ? +card.dataset.org : -1;
    var org = d.team[o];
    if (org) org.tiers = org.tiers || [];
    var t = box ? +box.dataset.tier : -1;
    var tier = org && t > -1 ? org.tiers[t] : null;
    if (tier) tier.people = tier.people || [];
    return { d: d, o: o, org: org, t: t, tier: tier, i: row ? +row.dataset.person : -1 };
  }

  function move(arr, from, to) {
    if (to < 0 || to >= arr.length) return false;
    arr.splice(to, 0, arr.splice(from, 1)[0]);
    return true;
  }

  els.teamlist.addEventListener("input", function (e) {
    var f = e.target.dataset.field;
    if (!f) return;
    var c = ctx(e.target);
    if (c.i > -1 && c.tier) {
      c.tier.people[c.i][f] = e.target.value;
      var av = $(".av", e.target.closest(".prow"));
      if (f === "name" && av) av.textContent = initials(e.target.value);
    } else if (c.tier && (f === "label" || f === "lead")) {
      c.tier[f] = f === "lead" ? e.target.checked : e.target.value;
    } else if (c.org) {
      c.org[f] = e.target.value;
      if (f === "name") {
        var h = $("h3", e.target.closest(".card"));
        if (h) h.textContent = e.target.value || "Untitled organisation";
      }
    }
    commitSoon();
  });

  els.teamlist.addEventListener("change", function (e) {
    if (e.target.dataset.field === "lead") {
      var c = ctx(e.target);
      if (c.tier) { c.tier.lead = e.target.checked; commit(true); }
    }
  });

  els.teamlist.addEventListener("click", function (e) {
    var b = e.target.closest("button[data-act]");
    if (!b) return;
    var c = ctx(b);
    var act = b.dataset.act;

    if (act === "padd" && c.tier) {
      c.tier.people.push({ name: "", role: "" });
      commit(true);
      var rows = $$('.tier-box[data-org="' + c.o + '"][data-tier="' + c.t + '"] .prow input.nm');
      if (rows.length) rows[rows.length - 1].focus();
      return;
    }
    if (act === "pdel" && c.tier) {
      var p = c.tier.people[c.i];
      if (!p.name || confirm("Remove " + p.name + " from the list?")) {
        c.tier.people.splice(c.i, 1);
        commit(true);
      }
      return;
    }
    if (act === "pup" && c.tier) { if (move(c.tier.people, c.i, c.i - 1)) commit(true); return; }
    if (act === "pdown" && c.tier) { if (move(c.tier.people, c.i, c.i + 1)) commit(true); return; }

    if (act === "tadd" && c.org) {
      c.org.tiers.push({ label: "New group", lead: false, people: [{ name: "", role: "" }] });
      commit(true);
      return;
    }
    if (act === "tdel" && c.org) {
      if (confirm('Remove the "' + (c.tier.label || "untitled") + '" group and everyone in it?')) {
        c.org.tiers.splice(c.t, 1);
        commit(true);
      }
      return;
    }
    if (act === "tup" && c.org) { if (move(c.org.tiers, c.t, c.t - 1)) commit(true); return; }
    if (act === "tdown" && c.org) { if (move(c.org.tiers, c.t, c.t + 1)) commit(true); return; }

    if (act === "odel") {
      if (confirm('Remove "' + (c.org.name || "this organisation") + '" and all of its staff?')) {
        c.d.team.splice(c.o, 1);
        commit(true);
      }
      return;
    }
    if (act === "oup") { if (move(c.d.team, c.o, c.o - 1)) commit(true); return; }
    if (act === "odown") { if (move(c.d.team, c.o, c.o + 1)) commit(true); return; }
  });

  $("#addorg").addEventListener("click", function () {
    var d = editable();
    d.team.push({
      name: "New organisation", logo: "", url: "", urlLabel: "", address: "", phone: "",
      tiers: [{ label: "Leadership", lead: true, people: [{ name: "", role: "" }] }]
    });
    commit(true);
    var cards = $$(".card", els.teamlist);
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
  });

  /* =========================================================
     Publish
     ========================================================= */
  function payload() {
    var doc = clone(working());
    doc.version = doc.version || 1;
    doc.updated = new Date().toISOString();
    return JSON.stringify(doc, null, 2);
  }

  $("#download").addEventListener("click", function () {
    var blob = new Blob([payload()], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "content.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  });

  $("#copy").addEventListener("click", function () {
    var btn = this, text = payload();
    var done = function (ok) {
      btn.textContent = ok ? "Copied" : "Press Ctrl/Cmd+C";
      setTimeout(function () { btn.textContent = "Copy to clipboard"; }, 2200);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
    } else {
      var ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { done(document.execCommand("copy")); } catch (e) { done(false); }
      ta.remove();
    }
  });

  $("#discard").addEventListener("click", function () {
    if (!draft) return;
    if (confirm("Throw away every unpublished change and go back to what is live?")) dropDraft();
  });

  $("#clear").addEventListener("click", function () {
    if (confirm("Only do this once the new content.json is live on the site.\n\nClear the local draft now?")) dropDraft();
  });

  /* =========================================================
     Messages from the preview frame
     ========================================================= */
  addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.source !== "vcoh-editor") return;
    if (e.data.type === "change") { if (!dirtyLocal) readDraft(); refresh(); }
    if (e.data.type === "team-click") { showTab("team"); }
  });

  /* Another tab (or the frame) touched the draft */
  addEventListener("storage", function (e) {
    if (e.key === DRAFT_KEY && !dirtyLocal) { readDraft(); refresh(); }
  });

  /* Never leave a debounced edit unwritten */
  addEventListener("beforeunload", flush);
  els.teamlist.addEventListener("focusout", flush);

  /* =========================================================
     Boot
     ========================================================= */
  function load() {
    return fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) {
        if (!r.ok) throw new Error("http " + r.status);
        return r.json();
      })
      .then(function (json) {
        published = json;
        loadError = false;
      })
      .catch(function () {
        published = { version: 1, pages: {}, team: [] };
        loadError = true;
      })
      .then(function () {
        readDraft();
        refresh();
      });
  }

  renderPageList();
  load().then(function () {
    renderTeam();
    reloadFrame();
    if (loadError) {
      els.changes.insertAdjacentHTML("afterbegin",
        '<div class="change"><span class="k">Heads up</span><span class="v">' +
        "data/content.json could not be loaded. If you opened this file directly from your computer, " +
        "run it through a web server instead (or use the deployed site).</span></div>");
    }
  });
})();
