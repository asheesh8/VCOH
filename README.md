# Vermont Comforts of Home — Website Redesign

A modern, immersive redesign of [vtcomfortsofhome.org](https://vtcomfortsofhome.org) — a Vermont non-profit that helps Vermonters live with dignity and choice through shared living, care coordination, and skilled home care providers.

The redesign keeps the original site's **simple, multi-page structure** (Home / Participants / Home Care Providers / About / Contact — not one long scroll) while refreshing it with the brand colors, an ambient video hero, and cleaner typography.

**Live:** https://www.vtcomfortsofhome.org (also https://vcoh.vercel.app). It's static HTML/CSS/JS on Vercel with no build step, and two small serverless functions, one for the contact form and one for the site editor, which saves edits to this repo.

## Highlights

- **Faithful to the original layout** — centered logo, a green nav bar with the plum active-tab accent, and simple content pages, exactly as before — just modernized.
- **Brand-matched palette** — taken straight from the live site: nav green `#517E02`, plum accent `#613246`, plus the logo's coffee-brown and cream.
- **Immersive video hero** — a muted, auto-looping ambient background video (no audio) on the home page, with a slim version banner on interior pages.
- **All original content preserved** — every page, all copy, photos, staff names, office details, partner logos, and the "Across the Fence" YouTube segment (loaded via a click-to-play thumbnail so the page stays fast).
- **Fully responsive** — mobile menu, fluid type, and layout down to small screens.
- **English and Nepali** — every page in both languages, switchable from the header.
- **Edit, save, live** — a passcode-protected visual editor that publishes straight from the browser.
- **Nice touches** — subtle scroll-reveal animations and a working contact form.

## Pages

| File | Page |
|------|------|
| `index.html` | Home |
| `participants.html` | Participants |
| `home-care-providers.html` | Home Care Providers |
| `about.html` | About |
| `contact.html` | Contact |
| `admin.html` | Site editor (passcode, not linked from anywhere) |
| `/ne/…` | Nepali versions of every page (same files, see *Nepali*) |

## Site editor

Staff change the site's text, photos and staff list from a visual editor. They
don't need to touch code or files.

**Getting in:** triple-click the logo/banner in the **footer** of any page (the
header logo is a normal link home). That opens `admin.html`, which asks for the
editor passcode.

**Editing:** every page loads in a live frame. Click any text to edit it in
place; a floating toolbar gives bold, italic, underline, links, text size,
alignment and the brand colours. Repeated things (bullet points, cards, office
boxes) get duplicate and delete buttons. Click a photo to swap it. The
**English / नेपाली** switch above the page picks which language you are
editing. The **Staff** tab manages the About-page team, with optional Nepali
group names and job titles.

**Saving:** edits stay in the browser until you press **Save & publish** (or
Cmd/Ctrl+S). That commits them to this GitHub repo through a Vercel function,
and Vercel redeploys the site, so it's live for every visitor in about a
minute. Every save is a git commit, so any earlier version can be restored.

### How content is stored

- All page edits and the staff list live in `data/content.json`. English edits
  go in `pages`, Nepali edits in `ne.pages`, and staff in `team`.
- Every page loads `js/content.js`, which lays that file over the static
  markup. The HTML files are never rewritten, so the original copy is always
  the fallback.
- Photos uploaded in the editor are committed to `assets/uploads/`.
- `api/editor.js` checks the passcode, issues a 12-hour signed session, and
  writes to GitHub with a server-side token. Neither the passcode nor the
  token is ever sent to the browser. If two people publish at the same time,
  the second one is told to reload instead of overwriting the first.

### Setting up online saving (one time)

1. **Create a GitHub token:** go to GitHub → Settings → Developer settings →
   Fine-grained tokens → Generate new token.
   - Repository access: *Only select repositories* → `asheesh8/VCOH`.
   - Permissions: *Contents* → **Read and write**.
   - Expiration: the longest allowed. Set a reminder to renew it.
2. **Add environment variables in Vercel** (vcoh → Settings → Environment
   Variables → Production):
   - `GITHUB_TOKEN`: the token from step 1.
   - `EDITOR_PASSCODE`: the editor passcode.
3. **Redeploy** (Deployments → ⋯ → Redeploy) so the function picks up the
   variables.

While these aren't set (or when you run the site from a plain local server),
the editor still opens with the passcode, but publishing falls back to
downloading `content.json`. To change the passcode, change `EDITOR_PASSCODE`
and redeploy. That also signs everyone out.

## Nepali

Every page has a Nepali version at `/ne/<page>` (for example
`/ne/participants.html`). `vercel.json` rewrites `/ne/*` to the same files.
`js/content.js` sees the `/ne/` prefix (or `?lang=ne` when previewing locally)
and swaps in the Nepali text from `js/i18n-ne.js`. It also loads Devanagari
fonts and lays any Nepali edits from the editor on top. Visitors switch with
the English / नेपाली control at the top right of the header, and the site
remembers their choice.

`js/i18n-ne.js` is generated from `scripts/ne_dict.py`. To change a
translation, edit the table there and run `python3 scripts/build_i18n.py`.
Each entry is keyed by the English block's HTML, so if English copy changes in
the HTML files, update its key too. Blocks without a Nepali entry show in
English.

## Contact form

The form posts to `api/contact.js`, a Vercel function that emails the intake
team through [Brevo](https://www.brevo.com)'s transactional API (free plan:
300 emails a day): VCOH.Intake@uvs-vt.org, John.hooley@uvs-vt.org,
Desireah.Ladieu@uvs-vt.org and Mary.Mougey@uvs-vt.org. Reply-to is set to the
visitor, so staff can just hit Reply. A hidden honeypot field and a
"submitted in under 3 seconds" check quietly drop bots.

Set these in Vercel → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `BREVO_API_KEY` | Brevo API key (SMTP & API → API Keys) |
| `CONTACT_FROM_EMAIL` | A verified Brevo sender, e.g. `studio@sol-arkitech.com` (authenticate the domain in Brevo for good deliverability) |
| `CONTACT_FROM_NAME` | Optional, default `VCOH Website` |
| `CONTACT_TO` | Optional override, comma-separated |

Until the key is set, the form tells visitors their message could not be sent
and asks them to call 802-662-5978. It never pretends a message went through.

## SEO

- Unique titles and descriptions, canonical URLs, `hreflang` for English and
  Nepali (`x-default` = English), and Open Graph / Twitter cards with
  `assets/images/og-image.jpg`.
- JSON-LD: `NGO` + `WebSite` on the home page (both partner agencies, offices
  and counties served), `BreadcrumbList` on inner pages, and `FAQPage` on
  Participants.
- `sitemap.xml` (with hreflang alternates), `robots.txt`, `llms.txt`, a
  branded `404.html`, and square favicons.
- Images have width/height set and lazy-load below the fold.

## Project structure

```
.
├── index.html / participants.html / home-care-providers.html / about.html / contact.html
├── admin.html            # Site editor (triple-click the footer logo/banner)
├── 404.html / sitemap.xml / robots.txt / llms.txt / vercel.json
├── api/contact.js        # Contact form → email (Vercel function)
├── api/editor.js         # Site editor sign-in, save and photo upload (commits to GitHub)
├── scripts/              # Nepali translation table + generator
├── data/content.json     # Everything edited in the site editor
├── css/
│   ├── styles.css        # Design system + all styles
│   └── admin.css         # Site editor chrome
├── js/
│   ├── main.js           # Shared: mobile nav, video, reveal, video facade, form
│   ├── content.js        # Applies saved content + Nepali over the pages (all pages)
│   ├── i18n-ne.js        # Generated Nepali translation table
│   ├── backend.js        # Editor's client for api/editor.js
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
- The hero video (`assets/video/hero.mp4`) is a 1080p, muted, ~1.7 MB encode of the original 4K clip, with a matching poster frame in `assets/images/hero-poster.jpg`. The 4K source is still in git history (commit 03e50ca) if it is ever needed.
