import { z } from 'zod/v4';
import { SKIN_SWATCHES, STEPS, type AnswerKey } from './questionnaire';
import { answerText } from './guide';
import type { Profile } from './profiles';

export const LOOK_COUNT = 10;

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const LookSchema = z.object({
  name: z.string(),
  style: z.string(),
  why: z.string(),
  pieces: z.array(z.object({ item: z.string(), color: z.string(), hex })).min(3).max(5),
});

export const LooksSchema = z.object({ looks: z.array(LookSchema).length(LOOK_COUNT) });

export type Look = z.infer<typeof LookSchema>;
export type Looks = z.infer<typeof LooksSchema>;

/** How many of the ten looks each chosen taste gets. */
export type StyleSplit = { style: string; count: number }[];

const STYLE_LABELS = new Map(
  STEPS.flatMap((s) => s.questions.flatMap((q) => q.fields)).find((f) => f.key === 'styles')?.options?.map((o) => [o.value, o.label]) ?? [],
);

/** Splits the ten looks as evenly as possible across the chosen tastes, in the order picked; earlier tastes take any extra. */
export function styleSplit(styles: readonly string[] | undefined): StyleSplit {
  const labels = (styles?.length ? styles : ['any']).slice(0, LOOK_COUNT).map((s) => STYLE_LABELS.get(s) ?? s);
  const base = Math.floor(LOOK_COUNT / labels.length);
  const extra = LOOK_COUNT % labels.length;
  return labels.map((style, i) => ({ style, count: base + (i < extra ? 1 : 0) }));
}

/** The looks schema for one profile: each look's style must be one of their tastes, and there are exactly ten. */
export function looksSchemaFor(split: StyleSplit) {
  const style = split.length > 1 ? z.enum(split.map((s) => s.style) as [string, ...string[]]) : z.literal(split[0].style);
  return z.object({ looks: z.array(LookSchema.extend({ style })).length(LOOK_COUNT) });
}

export function matchesSplit(looks: Look[], split: StyleSplit): boolean {
  return looks.length === LOOK_COUNT && split.every((s) => looks.filter((l) => l.style === s.style).length === s.count);
}

/** Groups the cards by taste, in the order the tastes were picked. */
export function orderBySplit(looks: Look[], split: StyleSplit): Look[] {
  const rank = (l: Look) => {
    const i = split.findIndex((s) => s.style === l.style);
    return i < 0 ? split.length : i;
  };
  return looks.map((l, i) => ({ l, i })).sort((a, b) => rank(a.l) - rank(b.l) || a.i - b.i).map((x) => x.l).slice(0, LOOK_COUNT);
}

/** The ten quick looks shown on the sheet page, before the full guide is written. */
export function looksPrompt(p: Profile): string {
  const a = p.answers;
  const t = (k: AnswerKey) => answerText(a, k);
  const skin = SKIN_SWATCHES.find((s) => s.tone === Number(a.skinTone));
  const split = styleSplit(a.styles);

  return `You are a personal stylist. Suggest outfits for ${p.name}, who appears in the attached photo. Write plainly and concretely. No exclamation marks, no em dashes.

About them:
- Shops: ${t('section')}
- Body shape closest to: ${t('shape')}; wants clothes to: ${t('goals')}
- Skin tone: swatch ${a.skinTone ?? '?'} of 7${skin ? ` (${skin.hex})` : ''}; ${t('metal')} jewelry suits them
- Hair: ${t('hair')}; eyes: ${t('eyes')}
- Looks they like: ${t('styles')}
- Colors they love: ${t('loveColors')}; colors they never wear: ${t('avoidColors')}
- Avoids: ${t('avoid')}
- Work dress code: ${t('dressCode')}; outfits wanted for: ${t('occasions')}
- Lives in: ${t('location')}

Use the photo to judge their coloring; the answers win where they disagree.

Return exactly ${LOOK_COUNT} looks, split across the looks they like exactly like this:
${split.map((s) => `- ${s.count} ${s.style}`).join('\n')}

Within each look they like, spread the outfits across the occasions they named, and make every one a different combination. Each look has:
- name: short, in the style "Olive Field Jacket and Cream Knit".
- style: the look it belongs to, written exactly as in the split above.
- why: one sentence on why these colors suit their skin tone and why the look suits their taste.
- pieces: 3 to 5 garments and shoes, each with item, color name and #RRGGBB hex.

Never use colors they never wear or pieces they avoid.`;
}
