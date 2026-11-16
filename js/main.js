/* Vermont Comforts of Home — shared interactions (multi-page) */
(function () {
  "use strict";

  /* Saved content can replace chunks of the page after load, so anything that
     attaches to page elements runs again afterwards. Bound nodes are flagged
     so re-running is harmless. */
  var EDITING = new URLSearchParams(location.search).get("vcohedit") === "1";

  function once(el, flag) {
    var attr = "data-vcoh-" + flag;
    if (el.hasAttribute(attr)) return false;
    el.setAttribute(attr, "1");
    return true;
  }

  /* Mobile nav toggle */
  function nav() {
    const toggle = document.querySelector(".nav-toggle");
    const menu = document.querySelector(".mainnav");
    if (!toggle || !menu || !once(toggle, "bound")) return;
    toggle.addEventListener("click", () => {
      const open = menu.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  /* Background videos: force muted autoplay (no audio) */
  function videos() {
    document.querySelectorAll(".hero video").forEach((v) => {
      v.muted = true;
      v.play().catch(() => {});
    });
  }

  /* Subtle reveal on scroll */
  function reveals() {
    const els = document.querySelectorAll(".reveal:not([data-vcoh-revealed])");
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => {
      el.setAttribute("data-vcoh-revealed", "1");
      io.observe(el);
    });
  }

  /* Click-to-play YouTube facade */
  function facades() {
    document.querySelectorAll(".yt-facade").forEach((facade) => {
      if (!once(facade, "bound")) return;
      facade.addEventListener("click", () => {
        const id = facade.dataset.yt;
        const frame = document.createElement("div");
        frame.className = "video-frame";
        const iframe = document.createElement("iframe");
        iframe.src =
          "https://www.youtube.com/embed/" + id + "?autoplay=1&rel=0";
        iframe.title = "Vermont Comforts of Home on ‘Across the Fence’";
        iframe.allow =
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
        iframe.allowFullscreen = true;
        frame.appendChild(iframe);
        facade.replaceWith(frame);
      });
    });
  }

  /* Contact form — posts to /api/contact (Vercel function), which emails
     the intake team. */
  function t(s) { return window.VCOH && window.VCOH.t ? window.VCOH.t(s) : s; }

  function contactForm() {
    const form = document.getElementById("contact-form");
    if (!form || !once(form, "bound")) return;
    const box = form.querySelector(".form-success");
    const btn = form.querySelector('button[type="submit"]');
    const say = (msg, ok) => {
      box.textContent = msg;
      box.classList.toggle("is-error", !ok);
      box.style.display = "block";
      box.scrollIntoView({ behavior: "smooth", block: "nearest" });
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      if (EDITING) return;
      const data = Object.fromEntries(new FormData(form).entries());
      Object.keys(data).forEach((k) => (data[k] = String(data[k]).trim()));
      if (!data.name || !data.message || (!data.email && !data.phone)) {
        say(t("Please fill in your name, and an email or phone number so we can reply."), false);
        return;
      }
      data.page = location.pathname;
      data.lang = (window.VCOH && window.VCOH.lang) || "en";
      const label = btn.textContent;
      btn.disabled = true;
      btn.textContent = t("Sending…");
      fetch(form.getAttribute("action") || "/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
        .then((r) => {
          if (!r.ok) throw new Error("HTTP " + r.status);
          form.reset();
          say(t("Thank you — your message has been sent. We'll be in touch soon."), true);
        })
        .catch(() => {
          say(t("Sorry, your message could not be sent. Please call us at 802-662-5978."), false);
        })
        .then(() => {
          btn.disabled = false;
          btn.textContent = label;
        });
    });
  }

  /* Vermont map — hover / focus tooltip */
  function map() {
    const vmap = document.querySelector(".vt-map");
    if (!vmap) return;
    const tip = vmap.querySelector(".vt-tooltip");
    if (!tip) return;
    const tCounty = tip.querySelector(".vt-tt-county");
    const tOrg = tip.querySelector(".vt-tt-org");
    vmap.querySelectorAll(".vt-county").forEach((path) => {
      if (!once(path, "bound")) return;
      const show = (e) => {
        tCounty.textContent = path.dataset.name + " " + t("County");
        tOrg.textContent = t(path.dataset.org);
        tip.hidden = false;
        const rect = vmap.getBoundingClientRect();
        let x, y;
        if (e.type === "focus") {
          const b = path.getBoundingClientRect();
          x = b.left + b.width / 2 - rect.left;
          y = b.top - rect.top;
        } else {
          x = e.clientX - rect.left;
          y = e.clientY - rect.top;
        }
        tip.style.left = x + "px";
        tip.style.top = y + "px";
      };
      const hide = () => { tip.hidden = true; };
      path.addEventListener("mouseenter", show);
      path.addEventListener("mousemove", show);
      path.addEventListener("mouseleave", hide);
      path.addEventListener("focus", show);
      path.addEventListener("blur", hide);
    });
  }

  /* Footer year */
  function year() {
    const y = document.getElementById("year");
    if (y) y.textContent = new Date().getFullYear();
  }

  /* Site editor: triple-click the footer brand. The editor itself asks for
     the passcode. */
  function adminTrigger() {
    if (EDITING) return;
    const brand = document.querySelector(".footer .footer-brand");
    if (!brand || !once(brand, "bound")) return;
    brand.style.userSelect = "none";
    brand.style.webkitUserSelect = "none";
    brand.style.cursor = "pointer";
    let taps = 0, timer = null;
    brand.addEventListener("click", (e) => {
      taps = Math.max(taps + 1, e.detail || 0);
      clearTimeout(timer);
      if (taps >= 3) {
        taps = 0;
        window.location.href = "admin.html";
        return;
      }
      timer = setTimeout(() => { taps = 0; }, 4000);
    });
  }

  function init() {
    nav();
    videos();
    reveals();
    facades();
    contactForm();
    map();
    year();
    adminTrigger();
  }

  init();
  document.addEventListener("vcoh:content-applied", init);
})();
