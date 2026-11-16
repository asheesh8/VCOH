# Vermont Comforts of Home — Website Redesign

A modern, immersive redesign of [vtcomfortsofhome.org](https://vtcomfortsofhome.org) — a Vermont non-profit that helps Vermonters live with dignity and choice through shared living, care coordination, and skilled home care providers.

The redesign keeps the original site's **simple, multi-page structure** (Home / Participants / Home Care Providers / About / Contact — not one long scroll) while refreshing it with the brand colors, an ambient video hero, and cleaner typography.

**Live:** https://www.vtcomfortsofhome.org (also https://vcoh.vercel.app). It's static HTML/CSS/JS on Vercel with no build step, one serverless function for the contact form, and Supabase for content edited in the site editor.

## Highlights

- **Faithful to the original layout** — centered logo, a green nav bar with the plum active-tab accent, and simple content pages, exactly as before — just modernized.
- **Brand-matched palette** — taken straight from the live site: nav green `#517E02`, plum accent `#613246`, plus the logo's coffee-brown and cream.
- **Immersive video hero** — a muted, auto-looping ambient background video (no audio) on the home page, with a slim version banner on interior pages.
- **All original content preserved** — every page, all copy, photos, staff names, office details, partner logos, and the "Across the Fence" YouTube segment (loaded via a click-to-play thumbnail so the page stays fast).
- **Fully responsive** — mobile menu, fluid type, and layout down to small screens.
- **English and Nepali** — every page in both languages, switchable from the header.
- **Edit, save, live** — a passcode-protected visual editor backed by Supabase.
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
Cmd/Ctrl+S). That writes them to Supabase, and every visitor sees them
straight away. Every save also keeps the previous version in
`site_content_history`.

### How content is stored

- Every page loads `js/content.js`. It fetches the `live` row from the
  Supabase table `site_content` (public read) and lays it over the static
  markup. The HTML files are never rewritten, so the original copy is always
  the fallback.
- If Supabase is not configured, can't be reached, or is empty, the site uses
  `data/content.json` instead. While `js/supabase-config.js` is blank, the
  editor still works, but publishing means exporting `content.json` and
  redeploying.
- English edits go in `pages`, Nepali edits in `ne.pages`, and staff in `team`.
- Photos uploaded in the editor go to the public Supabase Storage bucket
  `site-media`.

### Setting up Supabase (one time)

1. Create a project at supabase.com.
2. In **SQL Editor**, paste and run `supabase/setup.sql`. Before you run it,
   replace `REPLACE-WITH-EDITOR-EMAIL@example.org` at the bottom with the
   editor login email.
3. Go to **Authentication → Users → Add user → Create new user**. Enter that
   email, use the editor passcode as the password, and tick *Auto Confirm User*.
4. In **Authentication → Sign In / Providers**, turn off *Allow new users to
   sign up*.
5. In **Project Settings → API**, copy the Project URL and the `anon` public
   key into `js/supabase-config.js`, along with the editor email. Commit and
   deploy.
6. Open the editor, sign in, and press **Save & publish** once. That copies
   the current content into Supabase.

Row Level Security only lets emails listed in `site_editors` write, so the
public anon key in the page source can't change anything. To change the
passcode, change that user's password in Supabase.

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
team through [Resend](https://resend.com): VCOH.Intake@uvs-vt.org,
John.hooley@uvs-vt.org, Desireah.Ladieu@uvs-vt.org and Mary.Mougey@uvs-vt.org.
Set these in Vercel → Settings → Environment Variables:

| Variable | Value |
|----------|-------|
| `RESEND_API_KEY` | Resend API key |
| `CONTACT_FROM` | Sender on a Resend-verified domain, e.g. `VCOH Website <website@vtcomfortsofhome.org>` |
| `CONTACT_DELIVERY_ENABLED` | `true` once a test message arrives |
| `CONTACT_TO` | Optional override, comma-separated |

Until delivery is switched on, the form tells visitors their message could not
be sent and asks them to call 802-662-5978. It never pretends a message went
through.

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
├── supabase/setup.sql    # Tables, security rules and storage for the editor
├── scripts/              # Nepali translation table + generator
├── data/content.json     # Fallback content when Supabase is unavailable
├── css/
│   ├── styles.css        # Design system + all styles
│   └── admin.css         # Site editor chrome
├── js/
│   ├── main.js           # Shared: mobile nav, video, reveal, video facade, form
│   ├── content.js        # Applies saved content + Nepali over the pages (all pages)
│   ├── i18n-ne.js        # Generated Nepali translation table
│   ├── supabase-config.js# Supabase URL / anon key / editor email
│   ├── backend.js        # Editor sign-in, save and photo upload (Supabase REST)
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
