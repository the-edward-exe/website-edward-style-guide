# Style File Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Dockerized local app where a person creates a profile, uploads one photo, answers the 12-question questionnaire, approves a Gemini character sheet (downloadable), and lands on a results screen.

**Architecture:** One Astro 5 app in server mode (`@astrojs/node`, standalone) with server endpoints under `src/pages/api/`, a Postgres container, and photos on a Docker volume. AI calls (Gemini sheet, Claude photo read) run as in-process background jobs that write their result to the profile row; the browser polls a status endpoint. With no API key set, each AI call runs in demo mode so the app is fully clickable without keys.

**Tech Stack:** Astro 5, `@astrojs/node`, TypeScript, `postgres` (porsager) with plain SQL migrations, `zod`, `sharp`, `@anthropic-ai/sdk`, Gemini REST via `fetch`, `@fontsource/archivo-narrow`, Vitest, Docker Compose, Postgres 17, Node 22.

**Spec:** `docs/superpowers/specs/2026-10-25-style-file-app-design.md`

## Global Constraints

- Runs locally only via `docker compose up` at the repo root; app at `http://localhost:4321`.
- Secrets only in `.env` (gitignored); ship `.env.example` with `ANTHROPIC_API_KEY=`, `GEMINI_API_KEY=`, `CLAUDE_MODEL=claude-sonnet-5-5`, `GEMINI_MODEL=gemini-3-pro-image-preview`.
- Color tokens are exactly the current guide's light palette: `--bg #E6E4DF`, `--surface #F3F2EE`, `--ink #1D2938`, `--muted #5D636A`, `--line #CBC7BF`, `--chip #DAD7D0`, `--accent #8A5A3C`, `--accent-ink #FFFFFF`, `--navy #24364F`, `--ok #3F6B4A`, `--warn #9A5B12`, `--bad #9B2F2F`. Light mode only.
- One condensed sans everywhere (Archivo Narrow, self-hosted via Fontsource). Labels and nav uppercase, letter-spacing ~0.1em. No borders, shadows or rounded corners on cards. Accent only on the one primary action per screen and active states.
- Copy: terse, no exclamation marks, no em dashes. Instructions read like "UPLOAD ONE PHOTO" / "FRONT. FULL BODY. DAYLIGHT."
- Profiles kept until deleted. Delete removes the row and the profile's whole photo directory.
- `index.html` and `assets/reference-sheet.jpg` stay untouched; copy the sheet to `app/public/example-sheet.jpg` for the UI.
- The app lives in `app/` so the existing static guide at the repo root is unaffected.

## Review Focus

1. Phone photos: HEIC, >25 MB, or a non-image file. Expect a plain message ("USE A JPG, PNG OR WEBP PHOTO." / "PHOTO IS OVER 25 MB."), never a 500. Test in Task 4.
2. Re-uploading a photo while the first sheet is still generating: the older result must not overwrite the newer one. Test in Task 5 (attempt counter).
3. Deleting a profile while a job is in flight: the job finishing later must not crash or recreate files. Test in Task 5.
4. A late Claude photo read must never overwrite answers already given (spec rule). Test in Task 6.
5. Opening a deleted or made-up profile link: 404 page, not a 500. Test in Task 8.

---

### Task 1: Scaffold, Docker and health check

**Files:**
- Create: `app/package.json`, `app/astro.config.mjs`, `app/tsconfig.json`, `app/vitest.config.ts`, `app/src/pages/api/health.ts`, `app/Dockerfile`, `app/.dockerignore`, `docker-compose.yml`, `.env.example`
- Modify: `.gitignore` (add `.env`, `app/node_modules`, `app/dist`)
- Test: `app/tests/health.test.ts`

**Interfaces:**
- Produces: `GET /api/health` → `200 {"ok":true}`. npm scripts `dev`, `build`, `start` (`node ./dist/server/entry.mjs`), `migrate` (`node scripts/migrate.mjs`), `test` (`vitest run`).

- [ ] **Step 1:** Write `tests/health.test.ts`: import `GET` from `src/pages/api/health.ts`, call it, assert `res.status === 200` and `await res.json()` deep-equals `{ ok: true }`.
- [ ] **Step 2:** `cd app; npm test` → FAIL (module not found).
- [ ] **Step 3:** Create the Astro project: `output: 'server'`, `adapter: node({ mode: 'standalone' })`, `server: { host: true, port: 4321 }`. Implement the endpoint.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Dockerfile: multi-stage on `node:22-slim`; build stage `npm ci && npm run build`; runtime copies `dist`, `node_modules` (prod), `scripts`, `db`; `CMD ["sh","-c","npm run migrate && npm start"]`. Compose: service `db` (`postgres:17`, user/pass/db `style`, volume `pgdata`, port `5433:5432` for host-side tests, healthcheck `pg_isready`); service `app` (build `./app`, `4321:4321`, `env_file: [{path: .env, required: false}]`, `DATABASE_URL=postgres://style:style@db:5432/style`, `PHOTO_DIR=/data/photos`, volume `photos:/data/photos`, `depends_on: db: condition: service_healthy`).
- [ ] **Step 6:** `docker compose up -d --build` then `curl http://localhost:4321/api/health` → `{"ok":true}`.
- [ ] **Step 7:** Commit `feat: scaffold Astro app with Docker Compose`.

### Task 2: Database and profile repository

**Files:**
- Create: `app/db/migrations/001_profiles.sql`, `app/scripts/migrate.mjs`, `app/src/lib/db.ts`, `app/src/lib/ids.ts`, `app/src/lib/profiles.ts`
- Test: `app/tests/profiles.test.ts` (uses `DATABASE_URL=postgres://style:style@localhost:5433/style`; truncates `profiles` before each test)

**Interfaces:**
- Produces:
  - `newProfileId(): string` (16 random bytes, base64url, 22 chars); `isProfileId(s: string): boolean`
  - `type JobStatus = 'none' | 'pending' | 'ready' | 'failed'`
  - `type Profile = { id: string; name: string; createdAt: Date; answers: Partial<Answers>; photoPath: string | null; photoRead: PhotoRead | null; photoReadStatus: JobStatus; sheetPath: string | null; sheetStatus: JobStatus; sheetError: string | null; sheetApproved: boolean; attempt: number }` (`Answers` from Task 6, `PhotoRead` from Task 5; declare both as type imports)
  - `createProfile(name: string): Promise<Profile>`; `getProfile(id: string): Promise<Profile | null>` (null for invalid ids without querying); `listProfiles(): Promise<Profile[]>` (newest first)
  - `saveAnswers(id: string, patch: Partial<Answers>): Promise<Partial<Answers>>` (JSONB merge `answers || patch`)
  - `setPhoto(id: string, photoPath: string): Promise<number>`: sets photo, increments and returns `attempt`, sets `sheetStatus` and `photoReadStatus` to `'pending'`, clears `sheetPath`, `sheetError`, `sheetApproved`
  - `finishSheet(id: string, attempt: number, r: { path: string } | { error: string }): Promise<boolean>`: writes only `WHERE id = $1 AND attempt = $2`; returns whether a row changed
  - `finishPhotoRead(id: string, attempt: number, read: PhotoRead | null): Promise<boolean>`: same guard; `null` sets status `'failed'`
  - `retrySheet(id: string): Promise<number>`: increments attempt, sheet back to `'pending'`, does not touch photo read
  - `approveSheet(id: string): Promise<void>`; `deleteProfile(id: string): Promise<boolean>`
- Migration columns: `id text primary key, name text not null, created_at timestamptz default now(), answers jsonb not null default '{}', photo_path text, photo_read jsonb, photo_read_status text not null default 'none', sheet_path text, sheet_status text not null default 'none', sheet_error text, sheet_approved boolean not null default false, attempt integer not null default 0`. `migrate.mjs` applies files in `db/migrations` in name order, tracked in a `migrations(name text primary key)` table.

- [ ] **Step 1:** Write tests: `newProfileId` matches `/^[A-Za-z0-9_-]{22}$/`; create then get round-trips `name`; `listProfiles` returns newest first; `saveAnswers(id,{section:'mens'})` then `saveAnswers(id,{height:"5'10\""})` keeps both; `finishSheet` with a stale attempt returns `false` and leaves `sheetStatus` `'pending'`; `getProfile('nope')` is `null`; `deleteProfile` then `getProfile` is `null`.
- [ ] **Step 2:** `docker compose up -d db; npm run migrate; npm test` → FAIL.
- [ ] **Step 3:** Implement migration, runner and repository (snake_case columns mapped to the camelCase `Profile`).
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: profiles table and repository`.

### Task 3: Design system, layout and home screen

**Files:**
- Create: `app/DESIGN.md` (site-builder template, filled from the spec's "Look and feel"), `app/src/styles/tokens.css`, `app/src/styles/global.css`, `app/src/layouts/Base.astro`, `app/src/components/TopBar.astro`, `app/src/components/Button.astro`, `app/src/pages/index.astro`, `app/src/pages/api/profiles.ts`, `app/public/example-sheet.jpg`
- Test: `app/tests/api-profiles.test.ts`

**Interfaces:**
- Consumes: `createProfile`, `listProfiles`.
- Produces: `POST /api/profiles` (form field `name`, trimmed, 1–40 chars) → `303` to `/p/<id>/photo`; empty name → `400` re-rendering home with "ENTER A FIRST NAME.". `Base.astro` props `{ title: string }`. `Button.astro` props `{ variant?: 'primary' | 'plain', type?: string, href?: string }`.
- Home: top bar (left `PROFILES`, centered wordmark `STYLE FILE`, right `NEW`), a count line ("3 PROFILES"), a three-column grid of profile cards (sheet image or `--chip` placeholder at 3:4, tiny uppercase status label, name, gray created date), a Start form (FIRST NAME + primary button `START`), and the example sheet labelled `EXAMPLE RESULT`. Grid collapses to 2 columns under 900px and 1 under 560px.

- [ ] **Step 1:** Test: POST with `name=Ana` → status 303, `Location` matches `/^\/p\/[A-Za-z0-9_-]{22}\/photo$/`; POST with `name=   ` → 400.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement tokens (Global Constraints values, `--radius: 0`), Archivo Narrow 400/500 via Fontsource imports in `global.css`, layout, components, home and endpoint. Fill DESIGN.md: design read, tokens table, type system, motion (Subtle: none beyond hover opacity), anti-slop check.
- [ ] **Step 4:** `npm test` → PASS. `docker compose up -d --build`, open `http://localhost:4321`: home renders in the earthy palette with the condensed font.
- [ ] **Step 5:** Commit `feat: design system and home screen`.

### Task 4: Photo upload and image serving

**Files:**
- Create: `app/src/lib/storage.ts`, `app/src/lib/images.ts`, `app/src/lib/filenames.ts`, `app/src/pages/p/[id]/photo.astro`, `app/src/pages/api/p/[id]/photo.ts`, `app/src/pages/api/p/[id]/image/[kind].ts`
- Test: `app/tests/images.test.ts`, `app/tests/filenames.test.ts`, `app/tests/fixtures/` (small `ok.jpg`, `ok.png`, `not-image.txt`)

**Interfaces:**
- Consumes: `getProfile`, `setPhoto`; `startPhotoJobs(id, attempt)` from Task 5 (call it with the attempt `setPhoto` returns; until Task 5 lands, a no-op stub exported from `src/lib/jobs.ts`).
- Produces:
  - `class PhotoError extends Error`; `normalizePhoto(buf: Buffer): Promise<Buffer>`: rejects > 25 MB with `PhotoError('PHOTO IS OVER 25 MB.')`, rejects anything sharp can't read as jpeg/png/webp with `PhotoError('USE A JPG, PNG OR WEBP PHOTO.')`, auto-rotates from EXIF, resizes to max 2048px on the long edge, outputs JPEG quality 90, strips metadata.
  - `PHOTO_DIR` (env, default `./data/photos`); `saveImage(id: string, kind: 'photo' | 'sheet', buf: Buffer): Promise<string>` writes `<PHOTO_DIR>/<id>/<kind>-<timestamp>.<jpg|png>` and returns the path; `readImage(path: string): Promise<Buffer>`; `removeProfileFiles(id: string): Promise<void>` (no error if missing).
  - `downloadName(person: string, kind: string, version?: number): string` → lowercase, non-alphanumerics to `-`, trimmed, e.g. `downloadName('Ana María', 'character-sheet')` = `ana-mar-a-character-sheet.png`; with version 2 → `...-2.png`.
  - `GET /api/p/[id]/image/photo|sheet` streams the file with correct content type; `?download=1` adds `Content-Disposition: attachment; filename="<downloadName>"`; unknown profile or missing file → 404.
- Photo page: heading `UPLOAD ONE PHOTO`, subline `FRONT. FULL BODY. DAYLIGHT. PLAIN BACKGROUND.`, the example sheet beside it, a file input with preview, primary `UPLOAD`. On success, redirect to `/p/<id>/q/1`. On `PhotoError`, re-render with the message in `--bad`.

- [ ] **Step 1:** Tests: `normalizePhoto(ok.png)` returns a buffer whose sharp metadata format is `jpeg` and width ≤ 2048; `not-image.txt` rejects with `PhotoError` message `USE A JPG, PNG OR WEBP PHOTO.`; a 26 MB `Buffer.alloc` rejects with `PHOTO IS OVER 25 MB.`; the two `downloadName` cases above.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement. Set the Astro/Node body size limit high enough for 25 MB uploads.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: photo upload, storage and image downloads`.

### Task 5: AI clients and background jobs

**Files:**
- Create: `app/src/lib/ai/mode.ts`, `app/src/lib/ai/gemini.ts`, `app/src/lib/ai/claude.ts`, `app/src/lib/jobs.ts` (replaces stub), `app/src/pages/api/p/[id]/status.ts`
- Test: `app/tests/jobs.test.ts`, `app/tests/ai.test.ts`

**Interfaces:**
- Consumes: `setPhoto`, `finishSheet`, `finishPhotoRead`, `retrySheet`, `getProfile`, `saveImage`, `readImage`.
- Produces:
  - `aiMode(): { gemini: 'live' | 'demo'; claude: 'live' | 'demo' }` (demo when the key env var is empty).
  - `CHARACTER_SHEET_PROMPT: string` stating the spec's layout exactly: top row FRONT, left side, right side, BACK waist up; middle row PROFILE with smiling front, left profile, right profile, neutral front; bottom row FULL BODY VIEW side and front; plain light-gray studio background; labels as in the example; same simple outfit in every view; face, glasses, hair, facial hair, skin tone, height, build and visible tattoos identical to the photo; one image, portrait.
  - `generateCharacterSheet(photo: Buffer): Promise<Buffer>`: live posts to `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent` with header `x-goog-api-key`, parts `[text, inline_data jpeg]`, `generationConfig: { responseModalities: ['TEXT','IMAGE'], imageConfig: { aspectRatio: '3:4', imageSize: '2K' } }` (same request shape as `callGemini` in the root `index.html`); throws `Error` with Google's message, or `NO IMAGE CAME BACK. TRY ANOTHER PHOTO.`; 120 s timeout. Demo returns `public/example-sheet.jpg` after 3 s.
  - `type SkinTone = 1 | 2 | 3 | 4 | 5 | 6 | 7`; `type PhotoRead = { skinTone: SkinTone; hair: string; eyes: string }`.
  - `readPhoto(photo: Buffer): Promise<PhotoRead>`: live calls Claude (`CLAUDE_MODEL`) with the image and a forced tool call whose input schema is `PhotoRead` (skin tone mapped to the seven swatches in Task 6); demo returns `null` from the job (questions stay unselected). Read the `claude-api` skill before writing this file.
  - `startPhotoJobs(id: string, attempt: number): void` and `startSheetJob(id: string, attempt: number): void`: fire-and-forget; each reads the photo, calls the AI, saves the sheet via `saveImage` only if `getProfile(id)` still exists with the same `attempt`, then calls `finishSheet` / `finishPhotoRead`; any thrown error becomes `{ error: message }` / `null`. Never rejects.
  - `GET /api/p/[id]/status` → `{ sheetStatus, sheetError, photoReadStatus, photoRead, demo: aiMode() }`.

- [ ] **Step 1:** Tests (mock `generateCharacterSheet` / `readPhoto` with `vi.mock`, real DB): job success sets `sheetStatus 'ready'` and a `sheetPath` that exists; job throwing `Error('quota')` sets `'failed'` with `sheetError 'quota'`; **stale attempt:** start attempt 1 with a mock that resolves after attempt 2 was started via `setPhoto`, assert the final `sheetPath` is attempt 2's and attempt 1 wrote no file; **deleted mid-flight:** delete the profile before the mock resolves, assert no throw and no directory recreated; `aiMode()` is `demo` for both when keys are `''`. In `ai.test.ts`, stub `fetch` to return a Gemini response with `inlineData` and assert the decoded buffer; stub one with no image and assert the `NO IMAGE CAME BACK` error.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: Gemini character sheet and Claude photo read jobs`.

### Task 6: Questionnaire

**Files:**
- Create: `app/src/lib/questionnaire.ts`, `app/src/pages/p/[id]/q/[step].astro`, `app/src/pages/api/p/[id]/answers.ts`, `app/src/components/ShapeIcon.astro` (five inline line-drawing SVGs)
- Test: `app/tests/questionnaire.test.ts`

**Interfaces:**
- Consumes: `getProfile`, `saveAnswers`.
- Produces:
  - `SKIN_SWATCHES: readonly { tone: SkinTone; hex: string }[]` = `#F6DCC7, #EBC3A3, #D9A57F, #C08A62, #9C6A45, #74482D, #4A2D1C` (tones 1–7).
  - `AnswersSchema` (zod) and `type Answers = z.infer<typeof AnswersSchema>` with: `section: 'mens'|'womens'|'both'`; `height`, `topSize`, `bottomSize`: string 1–20; `shape: 'inverted-triangle'|'pear'|'hourglass'|'rectangle'|'apple'`; `goals`: 1–2 of `'taller'|'broader'|'streamline'|'balance-hips'|'show-waist'|'comfort'`; `skinTone: SkinTone`; `veins: 'blue'|'green'|'unsure'`; `metal: 'silver'|'gold'|'both'`; `hair`, `eyes`: string 1–30; `styles`: 1–3 of `'classic'|'minimal'|'workwear'|'streetwear'|'preppy'|'boho'|'edgy'|'smart-casual'`; `loveColors`, `avoidColors`: string[] (optional); `avoid`: string[] of `'tight'|'shorts'|'bold-patterns'|'sleeveless'|'shiny'|'none'`; `dressCode: 'casual'|'business-casual'|'formal'|'uniform'|'remote'`; `occasions`: string[] of `'date-night'|'travel'|'events'|'weekends'`; `location`: string 1–60; `budget: '$'|'$$'|'$$$'`.
  - `STEPS: { n: 1|2|3|4; title: string; fields: (keyof Answers)[] }[]` with titles `YOUR BODY`, `YOUR COLORING`, `YOUR TASTE`, `YOUR LIFE` and fields per the spec's questions 1–12.
  - `stepComplete(answers: Partial<Answers>, n: number): boolean`; `prefillFromRead(answers: Partial<Answers>, read: PhotoRead | null): Partial<Answers>` returns only `skinTone`/`hair`/`eyes` keys that are absent from `answers`.
  - `nextPath(p: Profile): string`: no photo → `/p/<id>/photo`; first incomplete step n → `/p/<id>/q/<n>`; sheet not approved → `/p/<id>/sheet`; else `/p/<id>`.
  - `POST /api/p/[id]/answers?step=n` validates that step's fields with `AnswersSchema.pick(...)`, saves, `303` to the next step (after step 4 → `/p/<id>/sheet`); invalid → re-render with field messages.
- Step page: progress line `STEP 2 OF 4`, the step's questions as chip groups and swatch rows (selected chip in `--ink` fill, primary button `NEXT` in `--accent`), `BACK` plain link. Step 2 polls `/api/p/[id]/status` every 2 s until `photoReadStatus` is not `pending`, then fills empty fields client-side with the server's `prefillFromRead` result and shows `FROM YOUR PHOTO. CHANGE IF WRONG.` Step 3 style choices are labelled tiles in `--chip` (placeholder images allowed by the spec).

- [ ] **Step 1:** Tests: `AnswersSchema.pick({goals:true})` rejects three goals; `prefillFromRead({ skinTone: 2 }, { skinTone: 5, hair: 'black', eyes: 'brown' })` returns `{ hair: 'black', eyes: 'brown' }` (late read never overwrites); `prefillFromRead({}, null)` returns `{}`; `nextPath` for a profile with photo and steps 1–2 complete returns `/p/<id>/q/3`; `stepComplete` false when a required field is missing.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS. In the browser, complete all four steps, reload mid-way, and confirm answers persist.
- [ ] **Step 5:** Commit `feat: four-step questionnaire with photo prefill`.

### Task 7: Character sheet approval

**Files:**
- Create: `app/src/pages/p/[id]/sheet.astro`, `app/src/pages/api/p/[id]/sheet/approve.ts`, `app/src/pages/api/p/[id]/sheet/retry.ts`
- Test: `app/tests/sheet-api.test.ts`

**Interfaces:**
- Consumes: `approveSheet`, `retrySheet`, `startSheetJob`, `getProfile`, image route from Task 4.
- Produces: `POST /api/p/[id]/sheet/retry` → `retrySheet` + `startSheetJob`, `303` back to `/p/<id>/sheet`. `POST /api/p/[id]/sheet/approve` → only when `sheetStatus === 'ready'`, sets approved, `303` to `/p/<id>`; otherwise `409`.
- Page: photo and sheet side by side (stacked on mobile). Pending: `--chip` box with `BUILDING YOUR CHARACTER SHEET` and polling every 3 s. Failed: the `sheetError` text and `TRY AGAIN`. Ready: primary `THIS IS ME`, plain `TRY AGAIN`, plain `DOWNLOAD` linking to `/api/p/<id>/image/sheet?download=1`. Demo mode shows a small `DEMO MODE: ADD GEMINI_API_KEY TO .env FOR REAL SHEETS` note in `--warn`.

- [ ] **Step 1:** Tests: approve when `sheetStatus` is `'pending'` → 409; approve after `finishSheet(..., {path})` → 303 and `sheetApproved` true; retry increments `attempt` and sets `'pending'`.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: character sheet approval and download`.

### Task 8: Results screen, delete and 404

**Files:**
- Create: `app/src/pages/p/[id]/index.astro`, `app/src/pages/api/p/[id]/delete.ts`, `app/src/pages/404.astro`, `app/src/middleware.ts`
- Test: `app/tests/profile-routes.test.ts`

**Interfaces:**
- Consumes: `getProfile`, `deleteProfile`, `removeProfileFiles`, `nextPath`, `STEPS`, `SKIN_SWATCHES`.
- Produces: `middleware.ts` loads the profile for any `/p/[id]/**` or `/api/p/[id]/**` path into `Astro.locals.profile` and returns the 404 page (status 404) when it doesn't exist. `/p/[id]` redirects to `nextPath` unless complete; when complete, shows: the approved sheet with `DOWNLOAD`, the answers grouped under the four step titles (skin tone as its swatch), and a placeholder block `YOUR GUIDE IS NEXT` for the later guide phase. `POST /api/p/[id]/delete` requires form field `confirm=DELETE` (typed into a small inline form, since dialogs aren't used), removes files and row, `303` to `/`.

- [ ] **Step 1:** Tests: `GET /p/AAAAAAAAAAAAAAAAAAAAAA` (valid shape, not in DB) → 404; `GET /api/p/bad/image/photo` → 404; delete without `confirm` → 400; delete with `confirm=DELETE` → 303, row gone, photo directory gone.
- [ ] **Step 2:** `npm test` → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `npm test` → PASS.
- [ ] **Step 5:** Commit `feat: results screen, delete profile, 404`.

### Task 9: End-to-end run and README

**Files:**
- Modify: `README.md` (add a "Style File app (local)" section: copy `.env.example` to `.env`, add keys, `docker compose up --build`, open `http://localhost:4321`; demo mode without keys; data lives in Docker volumes `pgdata` and `photos`; `docker compose down -v` wipes everything)

- [ ] **Step 1:** `docker compose down; docker compose up -d --build`; wait for health.
- [ ] **Step 2:** In the browser (demo mode is fine): create a profile, upload a photo, complete all four steps, approve the sheet, download it, view results, delete the profile. Every step works and the home list updates.
- [ ] **Step 3:** `cd app; npm test` → all PASS.
- [ ] **Step 4:** Update README and commit `docs: how to run the Style File app locally`; push the branch.
