# DESIGN.md — Style File

> The locked design language for the Style File app. Source of truth for taste; `src/styles/tokens.css` is the machine-readable twin.

## Design Read

Reading this as: **a personal styling tool** for **anyone deciding what to wear**, with a **quiet fashion-retail** language, leaning **Fear of God Essentials layout and type over the current Style File earth palette**: Archivo Narrow, stone ground, navy-black ink, tobacco accent, 0px radius, no shadows.

## The four questions

- **Purpose:** turn one photo and 12 answers into a character sheet, palette, fit rules and outfits the person can see themselves in.
- **Tone:** quiet, image-first retail. Few words, all said plainly.
- **Constraints:** Astro server mode in Docker, local only, light mode only, accessible, works at phone width.
- **Differentiation:** the person's own character sheet and try-ons are the hero image of every screen.

## The three dials

- **DESIGN_VARIANCE:** 3. Symmetric retail grid; the one asymmetric moment is the home intro (copy left, sheet right).
- **MOTION_INTENSITY:** 1. No animation beyond hover opacity.
- **VISUAL_DENSITY:** 4. Narrow gutters, generous image size, small text.

## Chosen aesthetic direction

- **Base:** fashion retail collection page (fearofgod.com/collections/essentials-fall-2026).
- **Twist:** the current Style File's earth palette in place of black and white (Edward's decision).

## Tokens

| Group | Choice | Why |
|---|---|---|
| Ground / surface | #E6E4DF / #F3F2EE | warm stone from the current guide; sits well against the sheet's gray studio background |
| Ink / muted / line | #1D2938 / #5D636A / #CBC7BF | navy-black instead of pure black, per the current guide |
| Accent | #8A5A3C tobacco | one primary action per screen and active states only |
| Links | #24364F navy | store and secondary links |
| Status | #3F6B4A / #9A5B12 / #9B2F2F | ok / warn / error text |
| Font | Archivo Narrow 400/500/600 | free condensed sans standing in for the reference's Helvetica Neue Condensed |
| Radius | 0 | reference has no rounding |
| Shadow | none | reference is flat |
| Density | comfortable | retail grid with narrow gutters |

## Type system

- One family. Labels and navigation: 11px, uppercase, 0.1em tracking, muted.
- Body and names: 13–15px regular, 0.02em tracking.
- Headings: uppercase, 500 weight, never larger than ~22px. No shouting headlines.

## Motion budget

Subtle: hover opacity on images and underline on nav links. Nothing animates on load.

## Photography

The person's own uploaded photo, their Gemini character sheet and try-on renders. Images sit on `--surface` at 3:4. No stock photography in the foundation.

## Copy rules

Terse and confident. Uppercase for labels and instructions ("UPLOAD ONE PHOTO", "FRONT. FULL BODY. DAYLIGHT."). No exclamation marks, no em dashes, no chatty onboarding.

## Anti-slop check

- [x] No purple gradient or blob · [x] Not Inter/Geist · [x] Hero is not centered headline over a button
- [x] No three equal feature cards · [x] Flat, consistent shape language · [x] No glassmorphism
- [x] One asymmetric moment (home intro) · [x] Real photography (the person) · [x] Zero em dashes in UI copy
- [x] Memorable thing: seeing your own character sheet as the product shot

## Design lock

- Locked on 2026-10-25 from the approved spec (`docs/superpowers/specs/2026-10-25-style-file-app-design.md`).
