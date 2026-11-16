/* Vermont Comforts of Home — content runtime.
   Loads saved content (data/content.json, or the unpublished draft when
   previewing) and lays it over the static markup, so the pages can be edited
   from admin.html without touching the HTML. Loaded on every public page. */
(function () {
  "use strict";

  var DATA_URL = "data/content.json";
  var DRAFT_KEY = "vcoh:draft";
  var PREVIEW_KEY = "vcoh:preview";
  var LANG_KEY = "vcoh:lang";
  var SB = window.VCOH_SUPABASE || {};

  var params = new URLSearchParams(location.search);
  var EDIT = params.get("vcohedit") === "1";
  var PREVIEW_PARAM = params.has("preview");

  /* Language: ?lang=ne / ?lang=en wins and is remembered; otherwise the
     visitor's last choice. The editor frame only follows the URL. */
  /* Nepali pages live under /ne/ (vercel.json rewrites /ne/* to the same
     files). ?lang=ne still works for local previews and the editor. */
  var NE_PATH = /^\/ne(\/|$)/.test(location.pathname);

  var LOCAL = location.protocol === "file:" || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);

  var LANG = (function () {
    if (NE_PATH) {
      if (!EDIT) store(LANG_KEY, "ne");
      return "ne";
    }
    var q = params.get("lang");
    if (q === "ne" || q === "en") {
      if (!EDIT) store(LANG_KEY, q);
      return q;
    }
    if (EDIT) return "en";
    if (read(LANG_KEY) === "ne") {
      /* Remembered Nepali choice: go to the /ne/ address of this page. */
      if (!LOCAL && !PREVIEW_PARAM) location.replace("/ne" + location.pathname + location.search + location.hash);
      return "ne";
    }
    return "en";
  })();
  var NE = LANG === "ne" && !!window.VCOH_NE;

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

  /* English value, or its Nepali version when the page is in Nepali. */
  function pick(en, ne) {
    if (!NE) return en || "";
    return ne || tText(en || "");
  }

  function personHtml(p) {
    return '<div class="person"><span class="avatar">' + esc(p.initials || initials(p.name)) + "</span>" +
      "<div><strong>" + esc(p.name) + "</strong><span>" + esc(pick(p.role, p.role_ne)) + "</span></div></div>";
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
        '<div class="tier-label">' + esc(pick(t.label, t.label_ne)) + "</div>" +
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
     Nepali translation. js/i18n-ne.js maps each block's English HTML
     (whitespace collapsed, icons left out) to its Nepali HTML. Blocks
     with no entry stay in English, so an English edit made in the
     editor shows in English until someone adds the Nepali for it.
     --------------------------------------------------------------- */
  var DICT = window.VCOH_NE || {};
  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, IFRAME: 1, VIDEO: 1, svg: 1, SVG: 1, TEMPLATE: 1 };
  var ATTRS = ["alt", "aria-label", "placeholder", "title"];

  function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }

  function unesc(s) {
    var t = document.createElement("textarea");
    t.innerHTML = s;
    return t.value;
  }

  /* Plain text → Nepali plain text (for attributes, titles, tooltips). */
  function tText(s) {
    var k = esc(norm(s));
    return Object.prototype.hasOwnProperty.call(DICT, k) ? unesc(DICT[k]) : s;
  }

  function keyOf(el) {
    var c = el.cloneNode(true);
    each(c.querySelectorAll("svg"), function (n) { n.remove(); });
    each([c].concat(Array.prototype.slice.call(c.querySelectorAll("*"))), function (n) {
      for (var i = n.attributes.length - 1; i >= 0; i--) {
        if (/^data-vcoh-/.test(n.attributes[i].name)) n.removeAttribute(n.attributes[i].name);
      }
    });
    var y = c.querySelector("#year");
    if (y) y.textContent = "";
    return norm(c.innerHTML);
  }

  function hasDirectText(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    }
    return false;
  }

  function swap(el, html) {
    var lead = [], trail = [], seenText = false;
    each(el.childNodes, function (n) {
      if (n.nodeType === 3 && n.nodeValue.trim()) seenText = true;
      else if (n.nodeType === 1 && n.tagName.toLowerCase() === "svg") (seenText ? trail : lead).push(n);
    });
    var year = el.querySelector("#year");
    el.innerHTML = html;
    var y2 = el.querySelector("#year");
    if (year && y2) y2.textContent = year.textContent;
    lead.reverse().forEach(function (n) {
      el.insertBefore(document.createTextNode(" "), el.firstChild);
      el.insertBefore(n, el.firstChild);
    });
    trail.forEach(function (n) {
      el.appendChild(document.createTextNode(" "));
      el.appendChild(n);
    });
  }

  function translate(root) {
    if (!NE || !root || root.nodeType !== 1) return;
    if (SKIP_TAGS[root.tagName] || root.hasAttribute("data-no-translate")) return;
    ATTRS.forEach(function (a) {
      if (root.hasAttribute(a)) root.setAttribute(a, tText(root.getAttribute(a)));
    });
    if (root !== document.body && hasDirectText(root)) {
      var k = keyOf(root);
      if (Object.prototype.hasOwnProperty.call(DICT, k)) {
        swap(root, DICT[k]);
        return;
      }
    }
    each(Array.prototype.slice.call(root.children), translate);
  }

  function translateHead() {
    if (!NE) return;
    document.title = tText(document.title);
    each(document.querySelectorAll('meta[name="description"],meta[property="og:title"],meta[property="og:description"],meta[name="twitter:title"],meta[name="twitter:description"]'), function (m) {
      m.setAttribute("content", tText(m.getAttribute("content") || ""));
    });
    var c = document.querySelector('link[rel="canonical"]');
    var ne = document.querySelector('link[rel="alternate"][hreflang="ne"]');
    if (c && ne) c.setAttribute("href", ne.getAttribute("href"));
    var og = document.querySelector('meta[property="og:url"]');
    if (og && ne) og.setAttribute("content", ne.getAttribute("href"));
    var loc = document.querySelector('meta[property="og:locale"]');
    var alt = document.querySelector('meta[property="og:locale:alternate"]');
    if (loc) loc.setAttribute("content", "ne_NP");
    if (alt) alt.setAttribute("content", "en_US");
  }

  /* Keep visitors in Nepali as they click around (and let crawlers find
     the Nepali pages). */
  function localiseLinks() {
    if (!NE || EDIT || NE_PATH) return;
    each(document.querySelectorAll("a[href]"), function (a) {
      var h = a.getAttribute("href");
      if (!/^[a-z0-9-]+\.html(#.*)?$/i.test(h)) return;
      var parts = h.split("#");
      a.setAttribute("href", parts[0] + "?lang=ne" + (parts[1] ? "#" + parts[1] : ""));
    });
  }

  function langUrl(lang) {
    var path = location.pathname.replace(/^\/ne(\/|$)/, "/");
    var u = new URLSearchParams(location.search);
    u.delete("lang");
    var q = u.toString();
    if (LOCAL) {
      /* No rewrites on a plain local server: use the query string. */
      u.set("lang", lang);
      return path + "?" + u.toString() + location.hash;
    }
    return (lang === "ne" ? "/ne" + path : path) + (q ? "?" + q : "") + location.hash;
  }

  function langSwitch() {
    if (EDIT || document.querySelector(".lang-switch")) return;
    var host = document.querySelector(".site-header");
    if (!host) return;
    var box = document.createElement("div");
    box.className = "lang-switch";
    box.setAttribute("role", "group");
    box.setAttribute("aria-label", NE ? "भाषा" : "Language");
    box.setAttribute("data-no-translate", "");
    box.innerHTML =
      '<a href="' + esc(langUrl("en")) + '" lang="en" hreflang="en"' + (NE ? "" : ' aria-current="true"') + ">English</a>" +
      '<a href="' + esc(langUrl("ne")) + '" lang="ne" hreflang="ne"' + (NE ? ' aria-current="true"' : "") + ">नेपाली</a>";
    each(box.querySelectorAll("a"), function (a) {
      a.addEventListener("click", function () { store(LANG_KEY, a.getAttribute("lang")); });
    });
    /* Remembered choice: someone who picked Nepali before lands on /ne/. */
    host.appendChild(box);
  }

  function nepaliFonts() {
    if (!NE || document.getElementById("vcoh-ne-fonts")) return;
    var l = document.createElement("link");
    l.id = "vcoh-ne-fonts";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Serif+Devanagari:wght@500;600&display=swap";
    document.head.appendChild(l);
  }

  function translatePage() {
    if (!NE) return;
    translate(document.body);
    translateHead();
    localiseLinks();
  }

  if (NE) {
    document.documentElement.setAttribute("lang", "ne");
    document.documentElement.classList.add("lang-ne");
    nepaliFonts();
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
    if (NE) {
      translatePage();
      if (content && content.ne) applyPage(content.ne);
    }
    document.documentElement.classList.remove("lang-pending");
    langSwitch();
    document.dispatchEvent(new CustomEvent("vcoh:content-applied"));
    previewBanner();
    if (EDIT) {
      var s = document.createElement("script");
      s.src = "js/editor.js?v=20261116";
      document.body.appendChild(s);
    }
  }

  function draft() {
    var raw = read(DRAFT_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function fromFile() {
    return fetch(DATA_URL, { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; });
  }

  /* Live content from Supabase when it is set up; the bundled file is the
     fallback if Supabase is unreachable or nothing has been saved yet. */
  function fromSupabase() {
    var url = String(SB.url || "").replace(/\/+$/, "");
    if (!url || !SB.anonKey) return Promise.resolve(null);
    var ctl = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctl) ctl.abort(); }, 4000);
    return fetch(url + "/rest/v1/site_content?id=eq.live&select=data", {
      headers: { apikey: SB.anonKey, Authorization: "Bearer " + SB.anonKey, Accept: "application/json" },
      cache: "no-store",
      signal: ctl ? ctl.signal : undefined
    })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rows) { return rows && rows[0] && rows[0].data ? rows[0].data : null; })
      .catch(function () { return null; })
      .then(function (d) { clearTimeout(timer); return d; });
  }

  function boot() {
    /* Translate the static page straight away so Nepali visitors do not
       see English first; saved content is laid over it when it arrives. */
    translatePage();
    document.documentElement.classList.remove("lang-pending");
    var d = PREVIEW ? draft() : null;
    if (d) return apply(d);
    fromSupabase()
      .then(function (live) { return live || fromFile(); })
      .then(apply);
  }

  window.VCOH = {
    page: PAGE,
    lang: LANG,
    nepali: NE,
    t: function (s) { return NE ? tText(s) : s; },
    translate: translate,
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
