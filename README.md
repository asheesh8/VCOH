# Vermont Comforts of Home — Website Redesign

A modern, immersive redesign of [vtcomfortsofhome.org](https://vtcomfortsofhome.org) — a Vermont non-profit that helps Vermonters live with dignity and choice through shared living, care coordination, and skilled home care providers.

The redesign keeps the original site's **simple, multi-page structure** (Home / Participants / Home Care Providers / About / Contact — not one long scroll) while refreshing it with the brand colors, an ambient video hero, and cleaner typography.

## Highlights

- **Faithful to the original layout** — centered logo, a green nav bar with the plum active-tab accent, and simple content pages, exactly as before — just modernized.
- **Brand-matched palette** — taken straight from the live site: nav green `#517E02`, plum accent `#613246`, plus the logo's coffee-brown and cream.
- **Immersive video hero** — a muted, auto-looping ambient background video (no audio) on the home page, with a slim version banner on interior pages.
- **All original content preserved** — every page, all copy, photos, staff names, office details, partner logos, and the "Across the Fence" YouTube segment (loaded via a click-to-play thumbnail so the page stays fast).
- **Fully responsive** — mobile menu, fluid type, and layout down to small screens.
- **Nice touches** — subtle scroll-reveal animations and a demo contact form.

## Pages

| File | Page |
|------|------|
| `index.html` | Home |
| `participants.html` | Participants |
| `home-care-providers.html` | Home Care Providers |
| `about.html` | About |
| `contact.html` | Contact |

## Project structure

```
.
├── index.html / participants.html / home-care-providers.html / about.html / contact.html
├── css/styles.css        # Design system + all styles
├── js/main.js            # Shared: mobile nav, video, reveal, video facade, form
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

- Fonts (Fraunces + Lato) load from Google Fonts, so viewing needs an internet connection. They can be self-hosted for a fully offline build.
- The contact form is a front-end demo — it shows a success message but does not send anything yet.
- The hero video is the original 4K source (~21 MB). For production it's worth compressing to ~1080p and generating a matching poster frame.
