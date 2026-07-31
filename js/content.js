/* Vermont Comforts of Home — content runtime.
   Loads saved content (data/content.json, or the unpublished draft when
   previewing) and lays it over the static markup, so the pages can be edited
   from admin.html without touching the HTML. Loaded on every public page. */
(function () {
  "use strict";

  var DATA_URL = "data/content.json";
  var DRAFT_KEY = "vcoh:draft";
  var PREVIEW_KEY = "vcoh:preview";

  var params = new URLSearchParams(location.search);
  var EDIT = params.get("vcohedit") === "1";

  if (params.get("preview") === "1") store(PREVIEW_KEY, "1", sessionStorage);
  if (params.get("preview") === "0") remove(PREVIEW_KEY, sessionStorage);
  var PREVIEW = EDIT || read(PREVIEW_KEY, sessionStorage) === "1";

  function read(k, s) { try { return (s || localStorage).getItem(k); } catch (e) { return null; } }
  function store(k, v, s) { try { (s || localStorage).setItem(k, v); } catch (e) {} }
  function remove(k, s) { try { (s || localStorage).removeItem(k); } catch (e) {} }

  /* Which page are we on? Works with or without the .html extension. */
  function pageName() {
    var last = location.pathname.replace(/\/+$/, "").split("/").pop();
    if (!last) return "index.html";
    return last.indexOf(".") === -1 ? last + ".html" : last;
  }
  var PAGE = pageName();

  /* ---------------------------------------------------------------
     Stable keys: a structural path from <body>, e.g.
     "section:nth-of-type(3)>div:nth-of-type(1)>h2:nth-of-type(1)"
     --------------------------------------------------------------- */
  function keyFor(el) {
    var parts = [];
    while (el && el !== document.body && el.parentElement) {
      var parent = el.parentElement;
      var n = 1;
      for (var i = 0; i < parent.children.length; i++) {
        var sib = parent.children[i];
        if (sib === el) break;
        if (sib.tagName === el.tagName) n++;
      }
      parts.unshift(el.tagName.toLowerCase() + ":nth-of-type(" + n + ")");
      el = parent;
    }
    return parts.join(">");
  }

  function resolve(key) {
    try { return document.body.querySelector(":scope>" + key); } catch (e) { return null; }
  }

  /* ---------------------------------------------------------------
     Safety: stored HTML is authored in our own editor, but strip
     anything executable before it goes back into the page.
     --------------------------------------------------------------- */
  function sanitize(html) {
    var t = document.createElement("template");
    t.innerHTML = String(html == null ? "" : html);
    each(t.content.querySelectorAll("script,style,link,meta,object,embed,form"), function (n) { n.remove(); });
    each(t.content.querySelectorAll("*"), function (n) {
      n.removeAttribute("contenteditable");
      n.removeAttribute("spellcheck");
      n.removeAttribute("data-bound");
      n.removeAttribute("data-revealed");
      n.removeAttribute("data-vcoh-bound");
      n.removeAttribute("data-vcoh-revealed");
      n.classList.remove("vcoh-active", "vcoh-hl", "vcoh-hl-img");
      if (n.classList.contains("reveal")) n.classList.remove("in");
      if (n.getAttribute("class") === "") n.removeAttribute("class");
      for (var i = n.attributes.length - 1; i >= 0; i--) {
        var a = n.attributes[i];
        if (/^on/i.test(a.name) || (/^(href|src|xlink:href)$/i.test(a.name) && /^\s*javascript:/i.test(a.value))) {
          n.removeAttribute(a.name);
        }
      }
    });
    return t.innerHTML;
  }

  function safeUrl(v) {
    return /^\s*(javascript|vbscript):/i.test(String(v)) ? "" : String(v);
  }

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  /* ---------------------------------------------------------------
     Apply the saved page edits
     --------------------------------------------------------------- */
  var ALLOWED_ATTRS = { src: 1, href: 1, alt: 1, title: 1, poster: 1 };

  function applyPage(content) {
    var page = content && content.pages && content.pages[PAGE];
    var sections = page && page.sections;
    if (!sections) return;

    /* Shallowest first: a container edit lands before the edits inside it. */
    var keys = Object.keys(sections).sort(function (a, b) {
      return a.split(">").length - b.split(">").length || (a < b ? -1 : 1);
    });

    keys.forEach(function (k) {
      var el = resolve(k);
      if (!el) return;
      var v = sections[k];
      if (typeof v === "string") v = { html: v };
      if (!v || typeof v !== "object") return;

      if (typeof v.html === "string") el.innerHTML = sanitize(v.html);
      if (typeof v.style === "string") {
        if (v.style) el.setAttribute("style", v.style);
        else el.removeAttribute("style");
      }
      if (v.attrs) {
        Object.keys(v.attrs).forEach(function (a) {
          if (!ALLOWED_ATTRS[a]) return;
          var val = v.attrs[a];
          if (val === null || val === "") el.removeAttribute(a);
          else el.setAttribute(a, a === "src" || a === "href" || a === "poster" ? safeUrl(val) : String(val));
        });
      }
    });
  }

  /* ---------------------------------------------------------------
     Team — rendered from data so staff can be managed in the admin
     --------------------------------------------------------------- */
  function initials(name) {
    var w = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!w.length) return "?";
    return ((w[0][0] || "") + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
  }

  function personHtml(p) {
    return '<div class="person"><span class="avatar">' + esc(p.initials || initials(p.name)) + "</span>" +
      "<div><strong>" + esc(p.name) + "</strong><span>" + esc(p.role || "") + "</span></div></div>";
  }

  function orgHtml(org) {
    var head = '<div class="org-head">' +
      (org.logo ? '<img src="' + esc(safeUrl(org.logo)) + '" alt="' + esc(org.name) + '" />' : "") +
      '<div><div class="org-name">' + esc(org.name) + "</div>" +
      (org.url ? '<div class="org-meta"><a href="' + esc(safeUrl(org.url)) + '" target="_blank" rel="noopener">' +
        esc(org.urlLabel || org.url) + "</a></div>" : "") +
      "</div>" +
      '<div class="org-contact">' + esc(org.address || "") +
      (org.phone ? '<br /><a href="tel:' + esc(String(org.phone).replace(/[^0-9+]/g, "")) + '">' + esc(org.phone) + "</a>" : "") +
      "</div></div>";

    var tiers = (org.tiers || []).map(function (t) {
      return '<div class="tier' + (t.lead ? " tier-lead" : "") + '">' +
        '<div class="tier-label">' + esc(t.label) + "</div>" +
        '<div class="people">' + (t.people || []).map(personHtml).join("") + "</div></div>";
    }).join("");

    return '<div class="team-org">' + head + tiers + "</div>";
  }

  function renderTeam(team) {
    var host = document.querySelector("[data-team]");
    if (!host || !Array.isArray(team) || !team.length) return;
    host.innerHTML = team.map(orgHtml).join("");
  }

  /* ---------------------------------------------------------------
     Preview banner (viewing unpublished changes on the real site)
     --------------------------------------------------------------- */
  function previewBanner() {
    if (!PREVIEW || EDIT || document.querySelector(".vcoh-preview-pill")) return;
    var pill = document.createElement("div");
    pill.className = "vcoh-preview-pill";
    pill.innerHTML = '<span>Previewing unpublished changes</span>' +
      '<a href="admin.html">Admin</a><button type="button">Exit</button>';
    pill.setAttribute("style",
      "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:9998;" +
      "display:flex;align-items:center;gap:10px;background:#613246;color:#fff;" +
      "padding:9px 10px 9px 16px;border-radius:100px;font:600 13px/1 Lato,system-ui,sans-serif;" +
      "box-shadow:0 12px 30px rgba(0,0,0,.3)");
    var a = pill.querySelector("a");
    a.setAttribute("style", "color:#ffe9b8;font-weight:800;text-decoration:underline");
    var b = pill.querySelector("button");
    b.setAttribute("style",
      "border:0;cursor:pointer;background:rgba(255,255,255,.18);color:#fff;" +
      "font:800 12px/1 Lato,system-ui,sans-serif;padding:7px 12px;border-radius:100px");
    b.addEventListener("click", function () {
      remove(PREVIEW_KEY, sessionStorage);
      location.href = location.pathname;
    });
    document.body.appendChild(pill);
  }

  /* ---------------------------------------------------------------
     Boot
     --------------------------------------------------------------- */
  function apply(content) {
    window.VCOH.content = content || null;
    if (content) {
      renderTeam(content.team);
      applyPage(content);
    }
    document.dispatchEvent(new CustomEvent("vcoh:content-applied"));
    previewBanner();
    if (EDIT) {
      var s = document.createElement("script");
      s.src = "js/editor.js?v=20260731";
      document.body.appendChild(s);
    }
  }

  function draft() {
    var raw = read(DRAFT_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function boot() {
    var d = PREVIEW ? draft() : null;
    if (d) return apply(d);
    fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(apply);
  }

  window.VCOH = {
    page: PAGE,
    editing: EDIT,
    preview: PREVIEW,
    content: null,
    keys: { draft: DRAFT_KEY, preview: PREVIEW_KEY },
    keyFor: keyFor,
    resolve: resolve,
    sanitize: sanitize,
    initials: initials,
    renderTeam: renderTeam
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
