# SAUC AMS — Antimicrobial Guide

Sabah Al Ahmad Urology Centre antimicrobial stewardship app. Single-page PWA,
no build step: the whole app is one HTML file.

Live: `https://drhussainmicro-debug.github.io/SAUCAMS/`

## Files

| File | Purpose |
|---|---|
| `index.html` | The entire app — markup, styles, data and logic |
| `manifest.json` | PWA metadata (name, icons, colours, standalone display) |
| `sw.js` | Service worker: offline cache + update prompt |
| `icon-192.png`, `icon-512.png` | App icons |
| `icon-maskable-512.png` | Android adaptive icon (extra padding for the safe zone) |
| `apple-touch-icon.png` | iOS home-screen icon (180×180) |
| `admin.html` | Team console — content editing + live request inbox |
| `firestore.rules` | Firestore security rules (**deploy these**) |
| `FIREBASE-SETUP.md` | Step-by-step Firebase setup |

Drop all of these in the repository root and enable GitHub Pages on that branch.

## What changed from the previous deploy

- Six sections (Calculators, Antibiotic Allergy, Alerts & Updates, IV→Oral
  Switch, TDM & Dosing, Sepsis) now use the Kuwait Hospital design and logic.
- Added **MRSA & MDR-GN Screening**.
- Home screen rebuilt: brand header, search, grouped tiles.
- Fonts: Inter now loads from Google Fonts. The previous build pointed at
  `./SAUC APP_files/css2`, a "save page as" artefact that does not exist in the
  repo, so Inter silently fell back to a system font. Poppins (used by the
  imported sections) is embedded in the HTML and needs no network.
- `manifest.json` and `apple-touch-icon.png` are referenced **relatively**
  instead of by absolute `github.io` URL, so the app also works when opened
  from disk or served from a different path.

## Firebase

Optional and additive — the app works fully without it. See `FIREBASE-SETUP.md`.
Two things it adds: live content updates from Firestore, and live in-app
notification of restricted-approval / consult requests for the AMS team.

⚠️ Approval requests contain patient data. `firestore.rules` is the only thing
keeping them private — deploy it before announcing the app.

## Updating the app

`sw.js` deliberately does **not** call `skipWaiting()` by itself. When a new
version is deployed the app shows an "update ready" prompt and applies it only
when the user accepts.

**Bump `CACHE` in `sw.js` on every deploy** (`sauc-ams-v1` → `v2` → …).
Without that, browsers may keep serving the old cached assets.

## Editing content

Clinical content lives in data structures near the top of the `<script>` block
in `index.html`:

- `DB.CONDITIONS` — guidelines by condition, including the treatment tiers
- `DRUGS` — antimicrobial monographs
- `CALCULATORS` — calculator groups and definitions
- `ABG` / `abgsites` — local antibiogram (organisms, susceptibilities, sites)
- `STD` — STD screening and testing module

The app also has a built-in editor (pencil button) that writes changes to
`localStorage` — useful for trying wording out, but those edits live only in
that browser. Anything permanent has to go into `index.html` and be committed.
