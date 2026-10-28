import { sql } from './db';
import { FIT } from './ai/tryon';
import type { JobStatus, Profile } from './profiles';
import type { Look } from './looks';

export type LookImage = {
  idx: number;
  status: JobStatus;
  path: string | null;
  error: string | null;
};

/** Which set of pictures a run writes to: the looks run and the character sheet it was made from. */
export type LookImageKey = { id: string; looksAttempt: number; sheetAttempt: number };

export const keyOf = (p: Profile): LookImageKey => ({ id: p.id, looksAttempt: p.looksAttempt, sheetAttempt: p.attempt });

export function lookImagePrompt(p: Profile, look: Look): string {
  const pieces = look.pieces.map((x) => `${x.color.toLowerCase()} ${x.item.toLowerCase()}`).join('; ');
  const fit = (p.answers.goals ?? []).map((g) => FIT[g]).filter(Boolean).join(', ');
  return `Use the attached character sheet as the identity reference. It shows one person from several angles. Keep their face, eyeglasses if any, hairstyle and hair color, facial hair, skin tone, height, body build and any visible tattoos exactly the same.

Create one photorealistic full-body photograph of this person standing in a relaxed, natural pose, three-quarter front view, wearing this outfit: ${pieces}. Clothes fit well: tailored but not tight${fit ? `, with ${fit}` : ''}, realistic drape and fabric texture. Show the whole outfit, head to shoes.

Setting: a plain warm off-white studio backdrop. Soft natural light, editorial lookbook style. No text, no logos, no watermark. One single image, not a collage.`;
}

/**
 * Claims the pictures for the current looks and sheet. Returns the look numbers this call claimed,
 * which is none when the looks or the sheet aren't ready, or when another call already claimed them.
 */
export async function beginLookImages(p: Profile): Promise<number[]> {
  if (p.looksStatus !== 'ready' || !p.looks || p.sheetStatus !== 'ready' || !p.sheetPath) return [];
  const rows = await sql`
    insert into look_images (profile_id, looks_attempt, sheet_attempt, idx)
    select ${p.id}, ${p.looksAttempt}, ${p.attempt}, i from generate_series(0, ${p.looks.looks.length - 1}) i
    on conflict do nothing returning idx`;
  return rows.map((r) => r.idx as number).sort((a, b) => a - b);
}

export async function listLookImages(p: Profile): Promise<LookImage[]> {
  const rows = await sql`
    select idx, status, path, error from look_images
    where profile_id = ${p.id} and looks_attempt = ${p.looksAttempt} and sheet_attempt = ${p.attempt}
    order by idx`;
  return rows.map((r) => ({ idx: r.idx, status: r.status, path: r.path, error: r.error }));
}

/** Try again on one failed picture. True when it was failed and is now pending again. */
export async function retryLookImage(p: Profile, idx: number): Promise<boolean> {
  const rows = await sql`
    update look_images set status = 'pending', error = null
    where profile_id = ${p.id} and looks_attempt = ${p.looksAttempt} and sheet_attempt = ${p.attempt}
      and idx = ${idx} and status = 'failed'
    returning idx`;
  return rows.length > 0;
}

export async function finishLookImage(k: LookImageKey, idx: number, r: { path: string } | { error: string }): Promise<boolean> {
  const rows = 'path' in r
    ? await sql`update look_images set status = 'ready', path = ${r.path}, error = null
        where profile_id = ${k.id} and looks_attempt = ${k.looksAttempt} and sheet_attempt = ${k.sheetAttempt} and idx = ${idx} and status = 'pending'
        returning idx`
    : await sql`update look_images set status = 'failed', error = ${r.error}
        where profile_id = ${k.id} and looks_attempt = ${k.looksAttempt} and sheet_attempt = ${k.sheetAttempt} and idx = ${idx} and status = 'pending'
        returning idx`;
  return rows.length > 0;
}

export async function lookImageStatus(k: LookImageKey, idx: number): Promise<JobStatus | null> {
  const [r] = await sql`select status from look_images
    where profile_id = ${k.id} and looks_attempt = ${k.looksAttempt} and sheet_attempt = ${k.sheetAttempt} and idx = ${idx}`;
  return r?.status ?? null;
}
