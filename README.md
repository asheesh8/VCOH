# Vermont Comforts of Home — Website Redesign

A modern, immersive redesign of [vtcomfortsofhome.org](https://vtcomfortsofhome.org) — a Vermont non-profit that helps Vermonters live with dignity and choice through shared living, care coordination, and skilled home care providers.

## Highlights

- **Immersive video hero** — a muted, auto-looping ambient background video (no audio).
- **Brand-matched palette** — Vermont forest green, warm coffee-brown, and cream, drawn straight from the VCOH logo.
- **All original content preserved** — every page (Home, Participants, Home Care Providers, About, Contact), all copy, photos, staff names, office details, and partner logos.
- **Compact single-page layout** — the two program pages are folded into a tabbed section; a horizontal photo marquee showcases many images without extra scrolling.
- **Fully responsive** — mobile slide-in menu, fluid type, and layout down to small screens.
- **Nice touches** — scroll-reveal animations, count-up stats, sticky glass nav with active-section highlighting, and a demo contact form.

## Project structure

```
.
├── index.html            # Single-page site
├── css/styles.css        # Design system + all styles
├── js/main.js            # Nav, tabs, reveal animations, form
└── assets/
    ├── images/           # All photos + logos (hosted locally)
    └── video/            # Ambient hero background video
```

## Running locally

Any static file server works. For example:

```bash
python3 -m http.server 8080
# then open http://127.0.0.1:8080
```

Or deploy straight to GitHub Pages / Netlify / Vercel — it's a static site with relative paths.

## Notes

- Fonts (Fraunces + Nunito Sans) load from Google Fonts, so viewing needs an internet connection. They can be self-hosted for a fully offline build.
- The contact form is a front-end demo — it shows a success message but does not send anything yet.
- The hero video is the original 4K source (~21 MB). For production it's worth compressing to ~1080p and generating a matching poster frame.
