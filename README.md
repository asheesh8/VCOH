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
| `admin.html` | Site editor (not linked from anywhere) |

## Site editor

There is a built-in visual editor so the site's text, photos and staff list can
be changed without touching code.

**Getting in:** triple-click the logo/banner in the **footer** of any page (the
header logo is a normal link home). That opens `admin.html`. There is no password —
the gesture is the only thing keeping it quiet, so it is not suitable for
anything sensitive.

**What it does**

- **Pages** — every page loads in a live frame. Click any text to edit it in
  place; a floating toolbar gives bold, italic, underline, links, text size,
  alignment and the brand colours. Repeated things (bullet points, cards,
  office boxes) get duplicate and delete buttons. Click a photo to swap it.
- **Staff** — a proper form for the About-page team: organisations, role
  groups and people. Avatar initials are derived from each name.
- **Publish** — lists what changed and exports the content file.

**How it stores things.** The site is static, so there is no server to save to.
Edits go into a draft in the browser's local storage; nobody else sees them.
Publishing means downloading `data/content.json`, dropping it into the `data`
folder and redeploying — then it is live for everyone.

Every page loads `js/content.js`, which lays the saved content over the static
markup. Nothing is edited on disk, so the HTML files stay readable and the
original copy is always the fallback if `content.json` goes missing.

## Project structure

```
.
├── index.html / participants.html / home-care-providers.html / about.html / contact.html
├── admin.html            # Site editor (triple-click the footer logo/banner)
├── data/content.json     # Published text edits + the staff list
├── css/
│   ├── styles.css        # Design system + all styles
│   └── admin.css         # Site editor chrome
├── js/
│   ├── main.js           # Shared: mobile nav, video, reveal, video facade, form
│   ├── content.js        # Applies saved content over the pages (all pages)
│   ├── editor.js         # In-page click-to-edit (loads only inside the editor)
│   └── admin.js          # The editor app itself
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
