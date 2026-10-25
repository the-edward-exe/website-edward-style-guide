import { z } from 'zod/v4';
import { STORE_IDS, STORES, storesFor } from './stores';
import { STEPS, SKIN_SWATCHES, type Answers, type AnswerKey } from './questionnaire';
import type { Profile } from './profiles';

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const rule = z.object({ title: z.string(), body: z.string() });

export const PieceSchema = z.object({
  item: z.string(),
  color: z.string(),
  hex,
  fabric: z.string(),
  search: z.string(),
  stores: z.array(z.enum(STORE_IDS)).min(1).max(2),
});

export const OutfitSchema = z.object({
  id: z.string().regex(/^o\d{2}$/),
  name: z.string(),
  occasion: z.enum(['Work', 'Weekend', 'Evening', 'Travel']),
  season: z.enum(['Spring', 'Summer', 'Fall', 'Winter', 'All year']),
  setting: z.string(),
  why: z.string(),
  pieces: z.array(PieceSchema).min(3).max(5),
});

export const GuideSchema = z.object({
  summary: z.string(),
  families: z.array(z.object({
    name: z.string(),
    purpose: z.string(),
    swatches: z.array(z.object({ name: z.string(), hex })).length(4),
  })).length(3),
  fitRules: z.array(rule).min(3).max(5),
  stylingRules: z.array(rule).min(3).max(5),
  capsule: z.array(z.object({ item: z.string(), category: z.string() })).min(12).max(20),
  outfits: z.array(OutfitSchema).length(12),
});

export type Guide = z.infer<typeof GuideSchema>;
export type Outfit = z.infer<typeof OutfitSchema>;
export type Piece = z.infer<typeof PieceSchema>;

/** The human label for an answer, as the person saw it in the questionnaire. */
function answerText(a: Partial<Answers>, key: AnswerKey): string {
  const field = STEPS.flatMap((s) => s.questions.flatMap((q) => q.fields)).find((f) => f.key === key);
  const v = a[key];
  if (v === undefined || (Array.isArray(v) && v.length === 0)) return 'not given';
  const label = (x: string) => field?.options?.find((o) => o.value === x)?.label ?? x;
  return Array.isArray(v) ? v.map((x) => label(String(x))).join(', ') : label(String(v));
}

export function guidePrompt(p: Profile): string {
  const a = p.answers;
  const t = (k: AnswerKey) => answerText(a, k);
  const skin = SKIN_SWATCHES.find((s) => s.tone === Number(a.skinTone));
  const stores = storesFor(a.section, a.budget).map((id) => `${id}: ${STORES[id].name} (${STORES[id].tier}) ${STORES[id].note}`).join('\n');

  return `You are a personal stylist. Build a style guide for ${p.name}, who appears in the attached photo. Write for them directly, plainly and concretely. No exclamation marks, no em dashes.

About them:
- Shops: ${t('section')}
- Height ${t('height')}, top size ${t('topSize')}, bottom size ${t('bottomSize')}
- Body shape closest to: ${t('shape')}
- Wants clothes to: ${t('goals')}
- Skin tone: swatch ${a.skinTone ?? '?'} of 7${skin ? ` (${skin.hex})` : ''}; wrist veins look ${t('veins')}; ${t('metal')} jewelry suits them
- Hair: ${t('hair')}; eyes: ${t('eyes')}
- Looks they like: ${t('styles')}
- Colors they love: ${t('loveColors')}; colors they never wear: ${t('avoidColors')}
- Avoids: ${t('avoid')}
- Work dress code: ${t('dressCode')}; outfits wanted for: ${t('occasions')}
- Lives in: ${t('location')} (use its climate for fabric weights and seasons)
- Budget per piece: ${t('budget')}

Use the photo to judge their coloring and proportions; the answers win where they disagree.

Return:
- summary: two or three sentences on what works for them and why.
- families: three color families of four swatches each (a core neutral family, an accent family that flatters their coloring, and a dark anchor). Real color names and #RRGGBB hex values. Respect colors they love and never use colors they never wear.
- fitRules: 3 to 5 rules for their shape and goals, each with a short title and one or two sentences.
- stylingRules: 3 to 5 rules covering their features, how to combine colors, texture and their climate.
- capsule: 12 to 20 pieces that run most outfits, each with a short category (outer, tailoring, bottoms, shirts, knits, basics, shoes, dresses, accessories).
- outfits: exactly 12, ids o01 to o12, spread across their occasions and the seasons they get. Each has a name in the style "Navy Overshirt Weekday", an occasion (Work, Weekend, Evening or Travel), a season (Spring, Summer, Fall, Winter or All year), a short photo setting, a one or two sentence "why it works", and 3 to 5 pieces. Each piece: item, color name, #RRGGBB hex, fabric note, a shopping search query (for example "men's navy wool overshirt"), and 1 or 2 store ids from this list only:
${stores}

Every outfit must use the palette, follow the fit rules, avoid what they avoid and fit their budget.`;
}
