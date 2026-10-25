# Edward's Style File

A personal style guide built on an earth tone, gray and navy palette. It includes 18 outfits with links to buy every piece, a store directory, and AI try-ons that show each outfit on you, generated with Gemini 3 Pro Image.

## What's inside

- **Guide:** three color families (core neutrals, earth accents, navy in place of black), fit rules, styling rules, and an 18-piece capsule checklist.
- **Outfits:** 18 looks filterable by occasion and season. Each lists its pieces with fabric notes, why the look works, store links, and Google Shopping and Amazon searches.
- **Shops:** 16 retailers grouped by price tier.
- **Try-on setup:** your Gemini API key, model, image size, reference image, and a batch generator.

## Run it

Everything lives in one file, `index.html`. No build step and no dependencies.

- **Locally:** open `index.html` in Chrome.
- **GitHub Pages:** Settings > Pages > Deploy from branch > `main` / root. Try-ons work there too.

## Try-ons

1. Get an API key at https://aistudio.google.com/apikey.
2. Open **Try-on setup**, paste the key, and save.
3. Open any outfit and click **Try it on**, or click **Generate all missing** to do all 18.

Details:

- Model: `gemini-3-pro-image-preview` (Gemini 3 Pro Image). You can change it in settings if Google renames it.
- The reference sheet in `assets/reference-sheet.jpg` is embedded in `index.html` and sent with every request. You can replace it from the settings page.
- Your API key and generated images are saved only in your browser (localStorage and IndexedDB). They are never written to this repo.
- Each image is billed to your Google account.

## Editing outfits

Outfits are defined in the `OUTFITS` array in `index.html`. Each piece is:

```
[item, color name, hex swatch, fabric note, shopping search query, [store ids]]
```

Store ids map to the `STORES` object in the same file.

## Style File app (local)

The `app/` folder holds the multi-person version. Drop one photo, answer 12 questions, and approve a Gemini character sheet. Claude then writes a personal guide (palette, fit and styling rules, capsule, 12 outfits with shop links), and the dressing room puts any outfit on you with Gemini. Every image downloads, and Download all saves the newest try-on of each outfit as a zip. It runs locally in Docker.

1. Copy `.env.example` to `.env` and add your keys:
   - `GEMINI_API_KEY` from https://aistudio.google.com/apikey (character sheets and try-ons, about $0.15 each)
   - `ANTHROPIC_API_KEY` from https://console.anthropic.com/settings/keys (reads coloring from the photo and writes the guide)
2. Run `docker compose up --build` in the repo root.
3. Open http://localhost:4321.

Without a key, that feature runs in demo mode: sheets and try-ons are plain gray placeholders, the coloring questions start blank, and the guide is a fixed demo guide.

Data lives in two Docker volumes: `pgdata` (profiles and answers) and `photos` (uploads, sheets and try-ons). `docker compose down` keeps them; `docker compose down -v` deletes everything.

Tests: start the database with `docker compose up -d db`, then run `npm test` in `app/`. Tests use a separate `style_test` database.

Design spec: `docs/superpowers/specs/2026-10-25-style-file-app-design.md`. Design system: `app/DESIGN.md`.
