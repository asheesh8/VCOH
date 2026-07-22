/* Vermont Comforts of Home — interactions */
(function () {
  "use strict";

  /* ---- Sticky nav state ---- */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---- Mobile menu ---- */
  const toggle = document.querySelector(".nav-toggle");
  const links = document.querySelector(".nav-links");
  toggle.addEventListener("click", () => {
    const open = links.classList.toggle("open");
    toggle.classList.toggle("open", open);
    toggle.setAttribute("aria-expanded", String(open));
  });
  links.querySelectorAll("a").forEach((a) =>
    a.addEventListener("click", () => {
      links.classList.remove("open");
      toggle.classList.remove("open");
    })
  );

  /* ---- Active section highlighting ---- */
  const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);
  const spy = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const id = "#" + e.target.id;
          navLinks.forEach((a) =>
            a.classList.toggle("active", a.getAttribute("href") === id)
          );
        }
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  sections.forEach((s) => spy.observe(s));

  /* ---- Reveal on scroll ---- */
  const revealer = new IntersectionObserver(
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
  document.querySelectorAll(".reveal").forEach((el) => revealer.observe(el));

  /* ---- Count-up stats ---- */
  const nums = document.querySelectorAll("[data-count]");
  const counter = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        const end = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || "";
        const dec = (el.dataset.dec | 0);
        const dur = 1400;
        let start = null;
        const step = (t) => {
          if (!start) start = t;
          const p = Math.min((t - start) / dur, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          el.textContent = (end * eased).toFixed(dec) + suffix;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = end.toFixed(dec) + suffix;
        };
        requestAnimationFrame(step);
        obs.unobserve(el);
      });
    },
    { threshold: 0.6 }
  );
  nums.forEach((n) => counter.observe(n));

  /* ---- Program tabs ---- */
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach((btn) =>
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".tab-panel").forEach((p) =>
        p.classList.toggle("active", p.id === target)
      );
      // keep the tab strip in view when switching
      document.getElementById("programs").scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );

  /* ---- Deep-link a program from CTA buttons ---- */
  document.querySelectorAll("[data-open-tab]").forEach((el) =>
    el.addEventListener("click", (ev) => {
      const t = el.dataset.openTab;
      const btn = document.querySelector(`.tab-btn[data-tab="${t}"]`);
      if (btn) setTimeout(() => btn.click(), 10);
    })
  );

  /* ---- Contact form (demo only, no network) ---- */
  const form = document.getElementById("contact-form");
  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ok = form.querySelector(".form-success");
      ok.style.display = "block";
      form.querySelectorAll("input, textarea").forEach((f) => (f.value = ""));
      ok.scrollIntoView({ behavior: "smooth", block: "nearest" });
      setTimeout(() => (ok.style.display = "none"), 6000);
    });
  }

  /* ---- Ensure background video autoplays muted ---- */
  const vid = document.querySelector(".hero-video video");
  if (vid) {
    vid.muted = true;
    vid.play().catch(() => {}); // some browsers need an explicit call
  }

  /* ---- Footer year ---- */
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
