import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { aiMode } from './mode';

export const CHARACTER_SHEET_PROMPT = `Use the attached photo as the identity reference. Create one photorealistic character reference sheet of this exact person, laid out as a single portrait-format image on a plain light-gray studio background:

Top row, labeled "FRONT" at the left and "BACK" at the right: four waist-up views in a row: front, left side, right side, back.
Middle row, labeled "PROFILE": four head-and-shoulders shots: smiling front, left profile, right profile, neutral front.
Bottom row, labeled "FULL BODY VIEW": two full-body views, side and front, standing naturally.

Keep the face, eyeglasses if any, hairstyle and hair color, facial hair, skin tone, height, body build and any visible tattoos identical to the photo in every view. Dress the person in the same simple outfit in every view: a plain fitted shirt, dark jeans and white sneakers. Soft even studio light. Clean thin white gutters between panels, labels in a simple sans-serif. One single image.`;

const DEMO_SHEET = resolve(process.cwd(), 'public/example-sheet.jpg');

export async function generateCharacterSheet(photo: Buffer): Promise<Buffer> {
  if (aiMode().gemini === 'demo') {
    await new Promise((r) => setTimeout(r, Number(process.env.DEMO_DELAY_MS ?? 3000)));
    return readFile(DEMO_SHEET);
  }
  const model = process.env.GEMINI_MODEL || 'gemini-3-pro-image-preview';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: CHARACTER_SHEET_PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: photo.toString('base64') } }] }],
      generationConfig: { responseModalities: ['TEXT', 'IMAGE'], imageConfig: { aspectRatio: '3:4', imageSize: '2K' } },
    }),
    signal: AbortSignal.timeout(120_000),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message ?? `GOOGLE RETURNED ${res.status}.`);
  const parts: any[] = json.candidates?.[0]?.content?.parts ?? [];
  const img = parts.find((p) => p.inlineData || p.inline_data);
  if (!img) throw new Error('NO IMAGE CAME BACK. TRY ANOTHER PHOTO.');
  return Buffer.from((img.inlineData ?? img.inline_data).data, 'base64');
}
