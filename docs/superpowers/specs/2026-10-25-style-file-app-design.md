# Style File App: Design

Date: 2026-10-25
Status: Draft for approval

## Intent

Edward's Style File (`index.html` in this repo) is a one-person style guide: a palette chosen for his coloring, fit rules for his frame, 18 outfits with shopping links, and Gemini try-ons made from a character sheet of him. It works well, but every word of it is hand-written for one person.

This project turns it into an app anyone can use. A person uploads one photo and answers a short questionnaire. The app builds them a character sheet, then their own version of the guide: a personal palette, fit and styling rules, a capsule list, outfits with places to buy, and a virtual dressing room that shows the outfits on them.

The why: picking clothes that suit your body, coloring and taste is hard, and generic advice ignores all three. The existing guide proved that a personal guide plus seeing yourself in the clothes makes the decision easy. The app gives that experience to anyone in a few minutes.

## Goals

- From start to a personal guide in about 5 minutes: one photo, 12 questions.
- Recommendations clearly reflect *their* photo and answers, not generic advice.
- Try-on images look like the person, consistently, across every outfit.
- Runs with one `docker compose up` on Edward's machine.

## Non-goals

- Public hosting. The app runs locally only and is never deployed to the internet.
- Security hardening, accounts, sign-in, rate limits, spending caps. Not needed for a local app.
- SEO. No search traffic reaches a local app, so `compact-keywords-seo` has no job here (see "Skills used").
- Payments, social features, native mobile apps.
- Live store inventory or prices. Shopping links are searches and store homepages, as in the current guide.

## Anti-goals (failure even if it technically works)

- Advice that would be the same for anyone. If two very different people get near-identical palettes and rules, it has failed.
- Try-ons that don't look like the person (wrong face, body shape or skin tone).
- A questionnaire long or confusing enough that people quit.
- An interface that looks like a generic app template instead of a fashion brand (see "Look and feel").

## Constraints

- Runs in Docker on Edward's Windows PC. One `docker-compose.yml` at the repo root brings up everything; the app is reached at `http://localhost:<port>`.
- Repo: https://github.com/the-edward-exe/website-edward-style-guide
- API keys (Anthropic, Google Gemini) live in a `.env` file read by the server, never committed. Provide `.env.example`.
- The existing `index.html` and `assets/reference-sheet.jpg` stay in the repo as references.

## Skills used (Claude's call, per Edward's request to use them)

- **site-builder:** runs its Phase 1 design pass to lock a `DESIGN.md` (tokens, type, layout, components) from the Fear of God reference, and its Astro starter is the base of the codebase. Its Cloudflare deploy phase is skipped: the app runs in Docker locally.
- **site-engine:** plans each screen (section order, what the person is asking at each step) and writes the interface copy in the tone below. Its trades CRO and local-SEO rules don't apply.
- **compact-keywords-seo:** not used. It picks search keywords to rank for, and a local-only app has no search traffic. It comes back into play only if the app is ever published.

## Decided

### Stack (Claude's call)

- **App:** Astro with the Node adapter (server mode), TypeScript. One codebase for pages and server endpoints, built on site-builder's starter. Interactive parts (questionnaire, upload, dressing room) are small client-side islands.
- **Database:** Postgres, in its own container.
- **Photo storage:** a Docker volume mounted into the app container, served through app routes.
- **Profile analysis and recommendations:** the Claude API (vision). Default model `claude-sonnet-5-5`, configurable via env var.
- **Image generation:** Google Gemini, model `gemini-3-pro-image-preview` (Gemini 3 Pro Image), configurable via env var.

### Profiles: private links (Edward's decision)

No login. Each profile gets a random URL-safe ID and lives at `/p/<id>`. A home screen lists existing profiles on this machine so Edward can switch between people; since the app is local, there's no need to hide them. Profiles and photos are kept **until someone deletes them** (Edward's decision). Each profile has "Delete profile," which removes the row and every image on disk.

### The flow

1. **Home.** Short statement of what the app does, a "Start" button, and the list of existing profiles. Edward's character sheet appears as the example result.
2. **Photo upload.** One photo, ideally full-body, from the front, in daylight, on a plain background. Edward's character sheet is shown as an example of what will be made. If Gemini or Claude refuses the image, show a plain message asking for a different photo.
3. **Character sheet generation (Gemini).** The server sends the photo to Gemini with a fixed prompt that reproduces the layout of `assets/reference-sheet.jpg`:
   - Top row: FRONT, left side, right side, BACK, waist up.
   - Middle row (PROFILE): four head shots: smiling front, left profile, right profile, neutral front.
   - Bottom row (FULL BODY VIEW): side and front full-body.
   - Plain light-gray studio background, labels as in the example, same simple outfit in every view.
   - Face, glasses, hair, facial hair, skin tone, height, build and visible tattoos kept identical to the photo.
   It generates in the background while the person fills out the questionnaire.
4. **Photo read (Claude).** Also starts at upload. Pre-fills questions 5 to 7. If it hasn't finished or fails by the time the person reaches Step 2, those questions show unselected; a late result never overwrites answers already given.
5. **Questionnaire.** 12 questions in four steps (below).
6. **Sheet approval.** The character sheet appears next to their photo with "This is me" and "Try again". *Claude's call:* this check exists because every later image inherits the sheet. Once approved, the sheet is the identity reference for every dressing room image. The original photo is kept only so the sheet can be rebuilt.
7. **Personal guide.** Claude takes the photo plus answers and returns structured JSON (not prose) that the app renders:
   - three color families of four swatches each, with names, hex values and a one-line purpose each;
   - fit rules for their shape and goals;
   - styling rules (features, color rule, texture, climate);
   - a capsule checklist of about 18 pieces;
   - outfits in the same shape as the current `OUTFITS` array: name, occasion, season, try-on setting, "why it works," and pieces `[item, color name, hex, fabric note, search query, store ids]`;
   - matching stores from a store list kept in the app (seeded from the current `STORES`, expanded to cover women's and more price points).
8. **Virtual dressing room.** On any outfit, "Try it on" sends the approved character sheet plus an outfit prompt (modeled on `buildPrompt` in the current guide) to Gemini and saves the result to the profile. Version thumbnails per outfit, editable prompt, and:
   - **Download (Edward's request):** every rendered try-on image has a Download button that saves the full-resolution PNG, named `<person>-<outfit>-<version>.png`. The approved character sheet has a Download button too. *Claude's call:* "Download all" on the dressing room saves every latest try-on as one zip.

### The questionnaire (approved by Edward)

**Step 0: Photo.** One photo (see flow).

**Step 1: Your body**
1. Which section do you usually shop? Men's / Women's / Both
2. Height and usual sizes: height, top size, bottom size
3. Which shape is closest to yours? Five drawings: shoulders wider than hips / hips wider than shoulders / even with a defined waist / even and straight / fuller through the middle
4. What should your clothes do for you? Pick up to two: look taller / look broader / streamline the middle / balance the hips / show the waist / just feel comfortable

**Step 2: Your coloring** (pre-filled from the photo)

5. Skin tone: swatches from light to deep, photo match pre-selected
6. Undertone check: wrist veins blue/purple, green, or can't tell; silver or gold jewelry looks better
7. Hair and eye color: confirm or change

**Step 3: Your taste**

8. Pick up to three looks you like: photo grid of classic, minimal, rugged/workwear, streetwear, preppy, boho, edgy, smart-casual
9. Colors you love or never wear: optional swatch taps
10. Anything you avoid? tight fits / shorts / bold patterns / sleeveless / shiny fabrics / none

**Step 4: Your life**

11. Work dress code (casual / business casual / formal / uniform / remote) plus occasions to plan for (date night, travel, events, weekends)
12. City or ZIP for climate, and budget per piece ($ / $$ / $$$)

### Look and feel (reference: fearofgod.com/collections/essentials-fall-2026)

Edward picked this page for tone and design. What it does, and what the app takes from it:

- **Quiet, image-first.** Almost no decoration. The photos do the work. In the app, the character sheet, try-on images and outfit cards carry the screens; copy is minimal.
- **Type:** one condensed sans-serif everywhere (the reference uses Helvetica Neue Condensed). Navigation and labels in small uppercase with wide letter-spacing (~0.1em); body and product names in small regular weight with slight tracking. No serif, no display font, no bold headlines shouting. site-builder picks a freely licensed condensed sans to self-host as the stand-in.
- **Color (Edward's decision): the earthy palette from the current guide, not the reference's black and white.** Use the current guide's light tokens as the app's color tokens:

  | Token | Hex | Use |
  |---|---|---|
  | `--bg` | #E6E4DF | page background (warm stone, replaces the reference's white) |
  | `--surface` | #F3F2EE | top bar, panels, image backgrounds behind product shots |
  | `--ink` | #1D2938 | primary text (deep navy-black, replaces pure black) |
  | `--muted` | #5D636A | secondary text, prices, counts |
  | `--line` | #CBC7BF | hairline dividers |
  | `--chip` | #DAD7D0 | filter chips, empty image placeholders |
  | `--accent` | #8A5A3C | tobacco: primary buttons, active states, focus ring |
  | `--accent-ink` | #FFFFFF | text on accent |
  | `--navy` | #24364F | links, store links |
  | `--ok` / `--warn` / `--bad` | #3F6B4A / #9A5B12 / #9B2F2F | status messages |

  Accent stays rare, as in the reference: tobacco on the one primary action per screen and on active states, nowhere decorative. The warm stone ground sits well against the character sheet's light-gray studio background.
- **Layout:** thin top bar with uppercase links left, wordmark centered, utility links right; a thin secondary row of category links; a count line ("18 OUTFITS") with "FILTER & SORT +" on the right. Outfit grid is three tall 3:4 image cards per row with narrow gutters, full width, edge to edge within a small page margin.
- **Cards:** image on top; below it a tiny uppercase label (occasion or season), the outfit name in regular case, and one gray line (the price range or piece count). No borders, no shadows, no rounded corners.
- **Tone of copy:** terse and confident. Short labels, product-style names ("Navy Overshirt Weekday"), no exclamation marks, no "Let's get started!" chatter. Instructions say what to do in as few words as possible: "UPLOAD ONE PHOTO", "FRONT. FULL BODY. DAYLIGHT."
- **Light mode only** to match the reference (*Claude's call*; the reference has no dark mode).

From the current guide, the app keeps the **color palette** and the **content structure** (palette families, rules, capsule, outfit detail with pieces and shop links). From the reference, it takes **type, layout, card style and tone**. The current guide's fonts (Bricolage Grotesque, Source Serif 4, IBM Plex Mono) are not carried over. *Claude's call:* light mode only; the current guide's dark tokens stay unused for now.

## First delivery: the foundation

Build and verify these before anything else:

1. Docker: `docker compose up` starts the app and Postgres with the photo volume; migrations run on start.
2. `DESIGN.md` locked via site-builder Phase 1, and the base layout (top bar, grid, cards, type) built from it.
3. Home screen with profile list; profile creation with private-link IDs; delete profile.
4. Photo upload and storage.
5. Claude photo read pre-filling questions 5 to 7, with the fallback above.
6. The full questionnaire, saved to the database, resumable from the profile link.
7. Character sheet generation with Gemini, approve / try again, and Download.
8. A results screen showing the profile's answers and approved sheet.

**Next, after the foundation works:** guide generation (flow step 7), then the virtual dressing room with downloads (flow step 8).

## Left to the builder

- Database schema, migration tool, ORM or none.
- Folder structure and component breakdown within site-builder's starter conventions.
- Image formats, resizing and max upload size (generous enough for phone photos).
- Exact wording of the Gemini and Claude prompts, within the rules above.
- Retry, timeout and error handling for API calls, including when Gemini returns no image.
- The drawings for question 3 and the photos for question 8 (simple line drawings and placeholder images are fine for the foundation).
- Host port.
- Tests: enough to trust the questionnaire save/resume path, delete, and downloads.
