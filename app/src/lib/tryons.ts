import { randomBytes } from 'node:crypto';
import { sql } from './db';
import type { JobStatus } from './profiles';

export type Tryon = {
  id: string;
  profileId: string;
  outfitId: string;
  version: number;
  prompt: string;
  path: string | null;
  status: JobStatus;
  error: string | null;
  createdAt: Date;
};

function toTryon(r: Record<string, any>): Tryon {
  return {
    id: r.id, profileId: r.profile_id, outfitId: r.outfit_id, version: r.version, prompt: r.prompt,
    path: r.path, status: r.status, error: r.error, createdAt: r.created_at,
  };
}

/** A new version for this outfit: one more than the highest so far. */
export async function createTryon(profileId: string, outfitId: string, prompt: string, guideAttempt = 0): Promise<Tryon> {
  // Two clicks at once can pick the same next version; the unique index rejects one, so retry it.
  for (let tries = 0; ; tries++) {
    try {
      return await insertTryon(profileId, outfitId, prompt, guideAttempt);
    } catch (e: any) {
      if (e?.code !== '23505' || tries >= 4) throw e;
    }
  }
}

async function insertTryon(profileId: string, outfitId: string, prompt: string, guideAttempt: number): Promise<Tryon> {
  const [r] = await sql`
    insert into tryons (id, profile_id, outfit_id, version, prompt, guide_attempt)
    values (${randomBytes(12).toString('base64url')}, ${profileId}, ${outfitId},
      (select coalesce(max(version), 0) + 1 from tryons where profile_id = ${profileId} and outfit_id = ${outfitId}),
      ${prompt}, ${guideAttempt})
    returning *`;
  return toTryon(r);
}

export async function getTryon(id: string): Promise<Tryon | null> {
  const [r] = await sql`select * from tryons where id = ${id}`;
  return r ? toTryon(r) : null;
}

/** All try-ons for a profile, or only those made for one guide (the dressing room shows the current guide's). */
export async function listTryons(profileId: string, guideAttempt?: number): Promise<Tryon[]> {
  const rows = guideAttempt === undefined
    ? await sql`select * from tryons where profile_id = ${profileId} order by outfit_id, version`
    : await sql`select * from tryons where profile_id = ${profileId} and guide_attempt = ${guideAttempt} order by outfit_id, version`;
  return rows.map(toTryon);
}

export async function finishTryon(id: string, r: { path: string } | { error: string }): Promise<boolean> {
  const rows = 'path' in r
    ? await sql`update tryons set status = 'ready', path = ${r.path}, error = null where id = ${id} returning id`
    : await sql`update tryons set status = 'failed', error = ${r.error} where id = ${id} returning id`;
  return rows.length > 0;
}
