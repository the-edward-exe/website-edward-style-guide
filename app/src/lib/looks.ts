import { z } from 'zod/v4';
import { SKIN_SWATCHES, type AnswerKey } from './questionnaire';
import { answerText } from './guide';
import type { Profile } from './profiles';

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const LookSchema = z.object({
  name: z.string(),
  style: z.string(),
  why: z.string(),
  pieces: z.array(z.object({ item: z.string(), color: z.string(), hex })).min(3).max(5),
});

export const LooksSchema = z.object({ looks: z.array(LookSchema).length(10) });

export type Look = z.infer<typeof LookSchema>;
export type Looks = z.infer<typeof LooksSchema>;

/** The ten quick looks shown on the sheet page, before the full guide is written. */
export function looksPrompt(p: Profile): string {
  const a = p.answers;
  const t = (k: AnswerKey) => answerText(a, k);
  const skin = SKIN_SWATCHES.find((s) => s.tone === Number(a.skinTone));

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

Return exactly 10 looks. Spread them across the looks they like and the occasions they named, and make each one a different combination. Each look has:
- name: short, in the style "Olive Field Jacket and Cream Knit".
- style: which of the looks they like it belongs to, using its name from the list above.
- why: one sentence on why these colors suit their skin tone and why the look suits their taste.
- pieces: 3 to 5 garments and shoes, each with item, color name and #RRGGBB hex.

Never use colors they never wear or pieces they avoid.`;
}
