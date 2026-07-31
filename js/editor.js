/* Vermont Comforts of Home — in-page visual editor.
   Loaded by content.js only when a page is opened with ?vcohedit=1 (the admin
   preview frame). Click any text to edit it, format it with the floating
   toolbar, swap images, and duplicate or delete repeated items. Everything is
   written to the local draft; admin.html publishes it. */
(function () {
  "use strict";

  var VCOH = window.VCOH;
  if (!VCOH) return;

  var COLORS = [
    ["#303030", "Ink"], ["#6f6a5e", "Muted"], ["#517e02", "Green"], ["#35520a", "Deep green"],
    ["#613246", "Plum"], ["#5b4128", "Brown"], ["#c79a4c", "Gold"], ["#ffffff", "White"]
  ];

  var active = null;      /* element currently being edited */
  var snapshot = null;    /* its content when editing started */
  var saveTimer = null;
  var suppress = false;   /* set when the admin discards — stop writing */

  /* =========================================================
     Draft document
     ========================================================= */
  var doc = VCOH.content
    ? JSON.parse(JSON.stringify(VCOH.content))
    : { version: 1, updated: new Date().toISOString(), pages: {}, team: [] };

  function sections() {
    doc.pages = doc.pages || {};
    doc.pages[VCOH.page] = doc.pages[VCOH.page] || {};
    doc.pages[VCOH.page].sections = doc.pages[VCOH.page].sections || {};
    return doc.pages[VCOH.page].sections;
  }

  function save() {
    if (suppress) return;
    doc.updated = new Date().toISOString();
    try {
      localStorage.setItem(VCOH.keys.draft, JSON.stringify(doc));
    } catch (e) {
      alert("Could not save — browser storage is full. Try removing large replacement images.");
      return;
    }
    post("change");
  }

  function post(type, extra) {
    var msg = { source: "vcoh-editor", type: type, page: VCOH.page };
    if (extra) Object.keys(extra).forEach(function (k) { msg[k] = extra[k]; });
    try { parent.postMessage(msg, location.origin); } catch (e) {}
  }

  function entryFor(key) {
    var s = sections();
    if (!s[key] || typeof s[key] !== "object") s[key] = {};
    return s[key];
  }

  function dropDescendants(key) {
    var s = sections();
    Object.keys(s).forEach(function (k) {
      if (k !== key && k.indexOf(key + ">") === 0) delete s[k];
    });
  }

  function stripRuntime(root) {
    var nodes = [root].concat(Array.prototype.slice.call(root.querySelectorAll("*")));
    nodes.forEach(function (n) {
      n.removeAttribute("contenteditable");
      n.removeAttribute("spellcheck");
      n.removeAttribute("data-bound");
      n.removeAttribute("data-revealed");
      n.removeAttribute("data-vcoh-bound");
      n.removeAttribute("data-vcoh-revealed");
      n.classList.remove("vcoh-active", "vcoh-hl", "vcoh-hl-img");
      if (n.classList.contains("reveal")) n.classList.remove("in");
      if (n.getAttribute("class") === "") n.removeAttribute("class");
    });
  }

  function cleanHtml(el) {
    var clone = el.cloneNode(true);
    stripRuntime(clone);
    return clone.innerHTML;
  }

  function record(el) {
    var key = VCOH.keyFor(el);
    var e = entryFor(key);
    e.html = cleanHtml(el);
    e.style = el.getAttribute("style") || "";
    save();
  }

  function recordContainer(container) {
    if (!container || container === document.body) return;
    var key = VCOH.keyFor(container);
    dropDescendants(key);
    var e = entryFor(key);
    e.html = cleanHtml(container);
    e.style = container.getAttribute("style") || "";
    save();
  }

  function recordAttrs(el, attrs) {
    var e = entryFor(VCOH.keyFor(el));
    e.attrs = e.attrs || {};
    Object.keys(attrs).forEach(function (k) { e.attrs[k] = attrs[k]; });
    save();
  }

  function revert(el) {
    var key = VCOH.keyFor(el);
    var s = sections();
    delete s[key];
    dropDescendants(key);
    save();
    location.reload();
  }

  /* =========================================================
     What can be edited
     ========================================================= */
  var NO_EDIT = { SCRIPT: 1, STYLE: 1, VIDEO: 1, SOURCE: 1, IFRAME: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, BR: 1, IMG: 1, HTML: 1, BODY: 1 };

  function hasText(el) {
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 3 && n.nodeValue.trim()) return true;
    }
    return false;
  }

  /* Nearest sensible edit target: prefer a block-level element with its own
     text (so clicking a <strong> inside a <p> edits the whole paragraph). */
  function targetFrom(node) {
    var el = node && node.nodeType === 3 ? node.parentElement : node;
    if (!el || el.closest(".vcoh-ui")) return null;
    if (el.closest("[data-team]")) return null;
    var fallback = null;
    while (el && el !== document.body) {
      if (el.hasAttribute("data-noedit")) return null;
      if (!NO_EDIT[el.tagName] && el.namespaceURI !== "http://www.w3.org/2000/svg" && hasText(el)) {
        if (getComputedStyle(el).display !== "inline") return el;
        if (!fallback) fallback = el;
      }
      el = el.parentElement;
    }
    return fallback;
  }

  /* A repeated item: same tag and classes as a sibling (list rows, cards, …) */
  function repeatable(el) {
    var p = el && el.parentElement;
    if (!p || p === document.body || el.closest("[data-team]")) return null;
    var sibs = Array.prototype.filter.call(p.children, function (s) {
      return s !== el && s.tagName === el.tagName;
    });
    if (!sibs.length) return null;
    if (el.tagName === "LI") return el;
    var cls = (el.getAttribute("class") || "").split(/\s+/).filter(Boolean);
    if (!cls.length) return null;
    var match = sibs.some(function (s) {
      return cls.every(function (c) { return s.classList.contains(c); });
    });
    return match ? el : null;
  }

  function repeatTarget(el) {
    while (el && el !== document.body) {
      var r = repeatable(el);
      if (r) return r;
      el = el.parentElement;
    }
    return null;
  }

  /* =========================================================
     Chrome
     ========================================================= */
  function icon(d, extra) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' + d + (extra || "") + "</svg>";
  }

  var ICONS = {
    link: icon('<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'),
    unlink: icon('<path d="M18.8 13.6 21 11.4a5 5 0 0 0-7-7l-2.2 2.2"/><path d="M5.2 10.4 3 12.6a5 5 0 0 0 7 7l2.2-2.2"/><line x1="2" y1="2" x2="22" y2="22"/>'),
    left: icon('<line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="14" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/>'),
    center: icon('<line x1="3" y1="6" x2="21" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="5" y1="18" x2="19" y2="18"/>'),
    right: icon('<line x1="3" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/>'),
    dup: icon('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
    del: icon('<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>'),
    undo: icon('<path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.1-6.4L3 9"/>'),
    close: icon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
    image: icon('<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>')
  };

  var css = document.createElement("style");
  css.textContent = [
    ".vcoh-edit, .vcoh-edit * { cursor: default; }",
    ".vcoh-edit a, .vcoh-edit button { pointer-events: auto; }",
    ".vcoh-edit .reveal { opacity: 1 !important; transform: none !important; }",
    ".vcoh-hl { outline: 2px dashed rgba(81,126,2,.85) !important; outline-offset: 3px; cursor: text !important; }",
    ".vcoh-hl-img { outline: 2px dashed rgba(97,50,70,.9) !important; outline-offset: 3px; cursor: pointer !important; }",
    ".vcoh-active { outline: 2px solid #517e02 !important; outline-offset: 3px; background: rgba(255,255,255,.55); border-radius: 3px; cursor: text !important; }",
    ".vcoh-ui { position: fixed; z-index: 2147483000; font-family: Lato, system-ui, -apple-system, sans-serif; }",
    ".vcoh-tb { display: flex; align-items: center; gap: 3px; background: #23281c; color: #fff; padding: 6px; border-radius: 11px; box-shadow: 0 16px 40px rgba(0,0,0,.4); flex-wrap: wrap; max-width: min(780px, 94vw); }",
    ".vcoh-tb button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-width: 30px; height: 30px; padding: 0 8px; border: 0; border-radius: 7px; background: transparent; color: #fff; font: 700 13px/1 Lato, system-ui, sans-serif; cursor: pointer; }",
    ".vcoh-tb button:hover { background: rgba(255,255,255,.16); }",
    ".vcoh-tb button.on { background: #517e02; }",
    ".vcoh-tb button svg { width: 15px; height: 15px; }",
    ".vcoh-tb .sep { width: 1px; height: 20px; background: rgba(255,255,255,.2); margin: 0 3px; }",
    ".vcoh-tb .sw { width: 18px; height: 18px; min-width: 0; padding: 0; border-radius: 50%; box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }",
    ".vcoh-tb .sw:hover { transform: scale(1.15); background: none; }",
    ".vcoh-tb .danger:hover { background: #a33b4e; }",
    ".vcoh-tb .done { background: #517e02; padding: 0 12px; }",
    ".vcoh-tb .done:hover { background: #628f10; }",
    ".vcoh-panel { background: #fffdf8; color: #303030; border-radius: 13px; box-shadow: 0 20px 50px rgba(0,0,0,.35); width: min(330px, 92vw); overflow: hidden; }",
    ".vcoh-panel header { display: flex; align-items: center; gap: 8px; background: #23281c; color: #fff; padding: 10px 12px; font: 800 12px/1 Lato, sans-serif; letter-spacing: .1em; text-transform: uppercase; }",
    ".vcoh-panel header svg { width: 15px; height: 15px; }",
    ".vcoh-panel header button { margin-left: auto; background: transparent; border: 0; color: #fff; cursor: pointer; display: flex; }",
    ".vcoh-panel header button svg { width: 15px; height: 15px; }",
    ".vcoh-panel .body { padding: 13px; display: grid; gap: 10px; }",
    ".vcoh-panel label { font: 800 11px/1 Lato, sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #6f6a5e; display: block; margin-bottom: 5px; }",
    ".vcoh-panel input[type=text] { width: 100%; padding: 8px 10px; border: 1.5px solid rgba(48,48,48,.16); border-radius: 7px; font: 400 13px/1.3 Lato, sans-serif; background: #fff; color: #303030; }",
    ".vcoh-panel input[type=text]:focus { outline: 0; border-color: #517e02; }",
    ".vcoh-panel .row { display: flex; gap: 7px; flex-wrap: wrap; }",
    ".vcoh-panel .b { flex: 1; min-width: 96px; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 9px 10px; border: 0; border-radius: 7px; background: #517e02; color: #fff; font: 800 12px/1 Lato, sans-serif; cursor: pointer; }",
    ".vcoh-panel .b.alt { background: #efe6d4; color: #35520a; }",
    ".vcoh-panel .b.danger { background: #8d3247; }",
    ".vcoh-panel .b svg { width: 14px; height: 14px; }",
    ".vcoh-panel .hint { font: 400 11.5px/1.45 Lato, sans-serif; color: #6f6a5e; margin: 0; }"
  ].join("\n");
  document.head.appendChild(css);

  var tb = document.createElement("div");
  tb.className = "vcoh-ui vcoh-tb";
  tb.style.display = "none";
  tb.innerHTML =
    '<button data-cmd="bold" title="Bold"><b>B</b></button>' +
    '<button data-cmd="italic" title="Italic"><i>I</i></button>' +
    '<button data-cmd="underline" title="Underline"><u>U</u></button>' +
    '<span class="sep"></span>' +
    '<button data-cmd="link" title="Add link">' + ICONS.link + "</button>" +
    '<button data-cmd="unlink" title="Remove link">' + ICONS.unlink + "</button>" +
    '<span class="sep"></span>' +
    '<button data-size="-1" title="Smaller">A−</button>' +
    '<button data-size="1" title="Bigger">A+</button>' +
    '<span class="sep"></span>' +
    '<button data-align="left" title="Align left">' + ICONS.left + "</button>" +
    '<button data-align="center" title="Centre">' + ICONS.center + "</button>" +
    '<button data-align="right" title="Align right">' + ICONS.right + "</button>" +
    '<span class="sep"></span>' +
    COLORS.map(function (c) {
      return '<button class="sw" data-color="' + c[0] + '" title="' + c[1] + '" style="background:' + c[0] + '"></button>';
    }).join("") +
    '<span class="sep"></span>' +
    '<button data-cmd="dup" title="Duplicate this item">' + ICONS.dup + "</button>" +
    '<button class="danger" data-cmd="del" title="Delete this item">' + ICONS.del + "</button>" +
    '<button data-cmd="revert" title="Undo all changes to this text">' + ICONS.undo + "</button>" +
    '<span class="sep"></span>' +
    '<button class="done" data-cmd="done">Done</button>';
  document.body.appendChild(tb);

  var panel = document.createElement("div");
  panel.className = "vcoh-ui vcoh-panel";
  panel.style.display = "none";
  document.body.appendChild(panel);

  /* =========================================================
     Positioning
     ========================================================= */
  function place(box, el) {
    var r = el.getBoundingClientRect();
    var w = box.offsetWidth, h = box.offsetHeight;
    var top = r.top - h - 10;
    if (top < 8) top = Math.min(r.bottom + 10, innerHeight - h - 8);
    var left = r.left + r.width / 2 - w / 2;
    left = Math.max(8, Math.min(left, innerWidth - w - 8));
    box.style.top = Math.max(8, top) + "px";
    box.style.left = left + "px";
  }

  function reposition() {
    if (active && tb.style.display !== "none") place(tb, active);
    if (panel.style.display !== "none" && panel._for) place(panel, panel._for);
  }
  addEventListener("scroll", reposition, true);
  addEventListener("resize", reposition);

  /* =========================================================
     Editing
     ========================================================= */
  function caretAt(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y);
      if (!p) return null;
      var r = document.createRange();
      r.setStart(p.offsetNode, p.offset);
      r.collapse(true);
      return r;
    }
    return null;
  }

  function activate(el, x, y) {
    if (active === el) return;
    deactivate();
    closePanel();
    active = el;
    el.classList.add("vcoh-active");
    el.setAttribute("contenteditable", "true");
    el.setAttribute("spellcheck", "true");
    el.focus({ preventScroll: true });

    snapshot = { html: el.innerHTML, style: el.getAttribute("style") || "" };

    var r = x != null && caretAt(x, y);
    if (r && el.contains(r.startContainer)) {
      var s = getSelection();
      s.removeAllRanges();
      s.addRange(r);
    }

    var canRepeat = !!repeatTarget(el);
    tb.querySelector('[data-cmd="dup"]').style.display = canRepeat ? "" : "none";
    tb.querySelector('[data-cmd="del"]').style.display = canRepeat ? "" : "none";

    tb.style.display = "flex";
    place(tb, el);
    syncState();
  }

  function deactivate() {
    if (!active) return;
    var el = active, was = snapshot;
    active = null;
    snapshot = null;
    el.removeAttribute("contenteditable");
    el.removeAttribute("spellcheck");
    el.classList.remove("vcoh-active");
    clearTimeout(saveTimer);
    /* Only store an override if something actually changed. */
    if (!was || el.innerHTML !== was.html || (el.getAttribute("style") || "") !== was.style) record(el);
    tb.style.display = "none";
  }

  function syncState() {
    if (!active) return;
    ["bold", "italic", "underline"].forEach(function (c) {
      var b = tb.querySelector('[data-cmd="' + c + '"]');
      var on = false;
      try { on = document.queryCommandState(c); } catch (e) {}
      b.classList.toggle("on", on);
    });
    var al = active.style.textAlign || "";
    Array.prototype.forEach.call(tb.querySelectorAll("[data-align]"), function (b) {
      b.classList.toggle("on", b.dataset.align === al);
    });
  }

  function queueSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { if (active) record(active); }, 700);
  }

  /* =========================================================
     Toolbar actions
     ========================================================= */
  tb.addEventListener("mousedown", function (e) { e.preventDefault(); });

  tb.addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || !active) return;
    var el = active;

    if (b.dataset.color) {
      var s = getSelection();
      if (s && !s.isCollapsed && el.contains(s.anchorNode)) document.execCommand("foreColor", false, b.dataset.color);
      else el.style.color = b.dataset.color;
      record(el);
      return;
    }
    if (b.dataset.size) {
      var base = parseFloat(el.style.fontSize) || parseFloat(getComputedStyle(el).fontSize);
      var next = base * (+b.dataset.size > 0 ? 1.1 : 1 / 1.1);
      el.style.fontSize = Math.max(10, Math.min(120, Math.round(next * 10) / 10)) + "px";
      record(el);
      place(tb, el);
      return;
    }
    if (b.dataset.align) {
      el.style.textAlign = el.style.textAlign === b.dataset.align ? "" : b.dataset.align;
      record(el);
      syncState();
      return;
    }

    switch (b.dataset.cmd) {
      case "bold": case "italic": case "underline":
        document.execCommand(b.dataset.cmd);
        record(el); syncState();
        break;
      case "link": {
        var cur = "";
        var a = getSelection().anchorNode;
        a = a && (a.nodeType === 3 ? a.parentElement : a);
        a = a && a.closest("a");
        if (a) cur = a.getAttribute("href") || "";
        var url = prompt("Link address (a page like contact.html, a full https:// address, mailto: or tel:)", cur);
        if (url === null) break;
        if (!url.trim()) { document.execCommand("unlink"); }
        else if (/^\s*(javascript|vbscript):/i.test(url)) { alert("That link type is not allowed."); break; }
        else document.execCommand("createLink", false, url.trim());
        record(el);
        break;
      }
      case "unlink":
        document.execCommand("unlink"); record(el); break;
      case "dup": {
        var item = repeatTarget(el);
        if (item) duplicate(item);
        break;
      }
      case "del": {
        var d = repeatTarget(el);
        if (d && confirm("Delete this item from the page?")) remove(d);
        break;
      }
      case "revert":
        if (confirm("Undo all unpublished changes to this text?")) { deactivate(); revert(el); }
        break;
      case "done":
        deactivate();
        break;
    }
  });

  /* =========================================================
     Duplicate / delete repeated items
     ========================================================= */
  function duplicate(item) {
    var parent = item.parentElement;
    deactivate();
    var clone = item.cloneNode(true);
    clone.removeAttribute("contenteditable");
    clone.classList.remove("vcoh-active", "vcoh-hl");
    Array.prototype.forEach.call(clone.querySelectorAll("[contenteditable]"), function (n) {
      n.removeAttribute("contenteditable");
    });
    parent.insertBefore(clone, item.nextSibling);
    recordContainer(parent);
    clone.scrollIntoView({ block: "center", behavior: "smooth" });
    flash(clone);
  }

  function remove(item) {
    var parent = item.parentElement;
    deactivate();
    closePanel();
    item.remove();
    recordContainer(parent);
  }

  function flash(el) {
    el.classList.add("vcoh-hl");
    setTimeout(function () { el.classList.remove("vcoh-hl"); }, 900);
  }

  /* =========================================================
     Images
     ========================================================= */
  function closePanel() {
    panel.style.display = "none";
    panel._for = null;
    panel.innerHTML = "";
  }

  var filePicker = document.createElement("input");
  filePicker.type = "file";
  filePicker.accept = "image/*";
  filePicker.addEventListener("change", function () {
    var img = panel._for, f = filePicker.files && filePicker.files[0];
    filePicker.value = "";
    if (!img || !f) return;
    if (f.size > 1.5 * 1024 * 1024) {
      alert("That image is " + Math.round(f.size / 1024) + " KB. Please use one under 1.5 MB.");
      return;
    }
    if (f.size > 500 * 1024 && !confirm("That image is " + Math.round(f.size / 1024) +
      " KB, which makes the saved content large. Use it anyway?")) return;
    var fr = new FileReader();
    fr.onload = function () {
      img.setAttribute("src", fr.result);
      recordAttrs(img, { src: fr.result });
      var field = panel.querySelector("[data-src]");
      if (field) field.value = "(uploaded photo)";
      place(panel, img);
    };
    fr.readAsDataURL(f);
  });

  panel.addEventListener("click", function (e) {
    var b = e.target.closest("button"), img = panel._for;
    if (!b || !img) return;
    if (b.hasAttribute("data-x")) return closePanel();
    if (b.hasAttribute("data-pick")) return filePicker.click();
    if (b.hasAttribute("data-apply")) {
      var src = panel.querySelector("[data-src]").value.trim();
      var alt = panel.querySelector("[data-alt]").value.trim();
      var attrs = { alt: alt };
      if (src && src !== "(uploaded photo)") {
        if (/^\s*(javascript|vbscript):/i.test(src)) return alert("That address is not allowed.");
        attrs.src = src;
        img.setAttribute("src", src);
      }
      img.setAttribute("alt", alt);
      recordAttrs(img, attrs);
      return closePanel();
    }
    if (b.hasAttribute("data-revert")) {
      if (confirm("Undo unpublished changes to this image?")) revert(img);
      return;
    }
    if (b.hasAttribute("data-dup")) {
      var t = repeatTarget(img);
      if (t) { closePanel(); duplicate(t); }
      return;
    }
    if (b.hasAttribute("data-del")) {
      var d = repeatTarget(img);
      if (d && confirm("Delete this item from the page?")) remove(d);
    }
  });

  function openImagePanel(img) {
    deactivate();
    var canRepeat = !!repeatTarget(img);
    panel.innerHTML =
      "<header>" + ICONS.image + "<span>Image</span><button data-x>" + ICONS.close + "</button></header>" +
      '<div class="body">' +
      '<div><label>Replace with a file</label><div class="row">' +
      '<button class="b" data-pick>' + ICONS.image + "Choose photo…</button></div></div>" +
      '<div><label>Or use an image address</label><input type="text" data-src value="' +
      (img.getAttribute("src") || "").replace(/"/g, "&quot;").slice(0, 200) + '" /></div>' +
      '<div><label>Description (for screen readers)</label><input type="text" data-alt value="' +
      (img.getAttribute("alt") || "").replace(/"/g, "&quot;") + '" /></div>' +
      '<div class="row"><button class="b" data-apply>Apply</button>' +
      '<button class="b alt" data-revert>' + ICONS.undo + "Reset</button></div>" +
      (canRepeat
        ? '<div class="row"><button class="b alt" data-dup>' + ICONS.dup + "Duplicate</button>" +
          '<button class="b danger" data-del>' + ICONS.del + "Delete</button></div>"
        : "") +
      '<p class="hint">Photos are stored inside the site content, so keep them under about 500&nbsp;KB. Large images are better added to <code>assets/images</code>.</p>' +
      "</div>";
    panel._for = img;
    panel.style.display = "block";
    place(panel, img);
  }

  /* =========================================================
     Page interaction
     ========================================================= */
  document.documentElement.classList.add("vcoh-edit");
  Array.prototype.forEach.call(document.querySelectorAll(".reveal"), function (el) {
    el.classList.add("in");
  });

  var hl = null;
  document.addEventListener("mousemove", function (e) {
    if (e.target.closest(".vcoh-ui")) return;
    var img = e.target.closest("img");
    var next = img && !img.closest("[data-team]") ? img : targetFrom(e.target);
    if (next === hl) return;
    if (hl) hl.classList.remove("vcoh-hl", "vcoh-hl-img");
    hl = next && next !== active ? next : null;
    if (hl) hl.classList.add(hl.tagName === "IMG" ? "vcoh-hl-img" : "vcoh-hl");
  });

  document.addEventListener("click", function (e) {
    if (e.target.closest(".vcoh-ui")) return;
    e.preventDefault();
    e.stopPropagation();

    var img = e.target.closest("img");
    if (img && !img.closest("[data-team]")) return openImagePanel(img);

    if (e.target.closest("[data-team]")) {
      deactivate();
      closePanel();
      post("team-click");
      return;
    }

    var el = targetFrom(e.target);
    if (!el) { deactivate(); closePanel(); return; }
    if (el === active) { syncState(); return; }
    activate(el, e.clientX, e.clientY);
  }, true);

  document.addEventListener("submit", function (e) { e.preventDefault(); }, true);

  document.addEventListener("input", function (e) {
    if (active && active.contains(e.target)) queueSave();
  }, true);

  document.addEventListener("keydown", function (e) {
    if (!active) return;
    if (e.key === "Escape") { e.preventDefault(); deactivate(); return; }
    if (e.key === "Enter" && !e.shiftKey && active.tagName !== "LI") {
      e.preventDefault();
      document.execCommand("insertLineBreak");
      queueSave();
    }
  }, true);

  document.addEventListener("keyup", syncState, true);
  document.addEventListener("mouseup", function () { setTimeout(syncState, 0); }, true);

  document.addEventListener("paste", function (e) {
    if (!active || !active.contains(e.target)) return;
    e.preventDefault();
    var text = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertText", false, text);
    queueSave();
  }, true);

  addEventListener("beforeunload", function () { if (active) record(active); });

  addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.source !== "vcoh-admin") return;
    /* Flush and stand down before the admin switches pages. */
    if (e.data.type === "blur") { deactivate(); closePanel(); }
    /* The draft is being thrown away — let go of it without writing back,
       or an in-progress edit would resurrect the file we just deleted. */
    if (e.data.type === "discard") {
      suppress = true;
      clearTimeout(saveTimer);
      if (active) {
        active.removeAttribute("contenteditable");
        active.classList.remove("vcoh-active");
      }
      active = null;
      snapshot = null;
      tb.style.display = "none";
      closePanel();
    }
  });

  post("ready");
})();
