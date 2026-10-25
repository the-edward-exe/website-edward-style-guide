import { aiMode } from './mode';
import { geminiImage } from './gemini';
import { demoTryon } from './demo-sheet';
import type { Outfit } from '../guide';
import type { Profile } from '../profiles';

const FIT: Record<string, string> = {
  taller: 'long unbroken lines and a clean hem so they read taller',
  broader: 'structure at the shoulders',
  streamline: 'clean drape through the middle, nothing clinging',
  'balance-hips': 'structure on top and an easy, straight line through the hips',
  'show-waist': 'a defined waist',
  comfort: 'an easy, relaxed fit',
};

export function tryonPrompt(p: Profile, outfit: Outfit): string {
  const pieces = outfit.pieces.map((x) => `${x.color.toLowerCase()} ${x.item.toLowerCase()} (${x.fabric.toLowerCase()})`).join('; ');
  const fit = (p.answers.goals ?? []).map((g) => FIT[g]).filter(Boolean).join(', ');
  return `Use the attached character sheet as the identity reference. It shows one person from several angles. Keep their face, eyeglasses if any, hairstyle and hair color, facial hair, skin tone, height, body build and any visible tattoos exactly the same.

Create one photorealistic full-body photograph of this person standing in a relaxed, natural pose, three-quarter front view, wearing this outfit: ${pieces}. Clothes fit well: tailored but not tight${fit ? `, with ${fit}` : ''}, realistic drape and fabric texture.

Setting: ${outfit.setting}. Soft natural light, shallow depth of field, editorial lookbook style. No text, no logos, no watermark. One single image, not a collage.`;
}

export async function generateTryon(sheet: Buffer, prompt: string): Promise<Buffer> {
  if (aiMode().gemini === 'demo') {
    await new Promise((r) => setTimeout(r, Number(process.env.DEMO_DELAY_MS ?? 3000)));
    return demoTryon();
  }
  return geminiImage(prompt, sheet, 'NO IMAGE CAME BACK. TRY AGAIN OR EDIT THE PROMPT.');
}
