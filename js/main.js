/* Vermont Comforts of Home — shared interactions (multi-page) */
(function () {
  "use strict";

  /* Mobile nav toggle */
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".mainnav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = nav.classList.toggle("open");
      toggle.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });
  }

  /* Background videos: force muted autoplay (no audio) */
  document.querySelectorAll(".hero video").forEach((v) => {
    v.muted = true;
    v.play().catch(() => {});
  });

  /* Subtle reveal on scroll */
  const els = document.querySelectorAll(".reveal");
  if (els.length) {
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
    els.forEach((el) => io.observe(el));
  }

  /* Click-to-play YouTube facade */
  document.querySelectorAll(".yt-facade").forEach((facade) => {
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

  /* Contact form (demo only) */
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

  /* Vermont map — hover / focus tooltip */
  const vmap = document.querySelector(".vt-map");
  if (vmap) {
    const tip = vmap.querySelector(".vt-tooltip");
    const tCounty = tip.querySelector(".vt-tt-county");
    const tOrg = tip.querySelector(".vt-tt-org");
    vmap.querySelectorAll(".vt-county").forEach((path) => {
      const show = (e) => {
        tCounty.textContent = path.dataset.name + " County";
        tOrg.textContent = path.dataset.org;
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
  const y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
})();
