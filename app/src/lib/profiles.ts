import { sql } from './db';
import { newProfileId, isProfileId } from './ids';
import type { Answers } from './questionnaire';
import type { PhotoRead } from './ai/claude';
import type { Guide } from './guide';
import type { Looks } from './looks';

/** Name a profile carries until the person types theirs in the pop-up. */
export const NEW_PROFILE_NAME = 'New profile';

export type JobStatus = 'none' | 'pending' | 'ready' | 'failed';

export type Profile = {
  id: string;
  name: string;
  createdAt: Date;
  answers: Partial<Answers>;
  photoPath: string | null;
  photoRead: PhotoRead | null;
  photoReadStatus: JobStatus;
  sheetPath: string | null;
  sheetStatus: JobStatus;
  sheetError: string | null;
  sheetApproved: boolean;
  attempt: number;
  guide: Guide | null;
  guideStatus: JobStatus;
  guideError: string | null;
  guideAttempt: number;
  capsuleOwned: number[];
  looks: Looks | null;
  looksStatus: JobStatus;
  looksError: string | null;
  looksAttempt: number;
};

function toProfile(r: Record<string, any>): Profile {
  return {
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    answers: r.answers ?? {},
    photoPath: r.photo_path,
    photoRead: r.photo_read,
    photoReadStatus: r.photo_read_status,
    sheetPath: r.sheet_path,
    sheetStatus: r.sheet_status,
    sheetError: r.sheet_error,
    sheetApproved: r.sheet_approved,
    attempt: r.attempt,
    guide: r.guide ?? null,
    guideStatus: r.guide_status ?? 'none',
    guideError: r.guide_error ?? null,
    guideAttempt: r.guide_attempt ?? 0,
    capsuleOwned: r.capsule_owned ?? [],
    looks: r.looks ?? null,
    looksStatus: r.looks_status ?? 'none',
    looksError: r.looks_error ?? null,
    looksAttempt: r.looks_attempt ?? 0,
  };
}

export async function createProfile(name: string): Promise<Profile> {
  const [r] = await sql`insert into profiles (id, name) values (${newProfileId()}, ${name}) returning *`;
  return toProfile(r);
}

export async function getProfile(id: string): Promise<Profile | null> {
  if (!isProfileId(id)) return null;
  const [r] = await sql`select * from profiles where id = ${id}`;
  return r ? toProfile(r) : null;
}

export async function listProfiles(): Promise<Profile[]> {
  return (await sql`select * from profiles order by created_at desc`).map(toProfile);
}

export async function saveAnswers(id: string, patch: Partial<Answers>): Promise<Partial<Answers>> {
  const [r] = await sql`update profiles set answers = answers || ${sql.json(patch as any)} where id = ${id} returning answers`;
  return r?.answers ?? {};
}

export async function setPhoto(id: string, photoPath: string): Promise<number> {
  const [r] = await sql`
    update profiles set photo_path = ${photoPath}, attempt = attempt + 1,
      sheet_status = 'pending', photo_read_status = 'pending', photo_read = null,
      sheet_path = null, sheet_error = null, sheet_approved = false
    where id = ${id} returning attempt`;
  return r.attempt;
}

export async function finishSheet(id: string, attempt: number, r: { path: string } | { error: string }): Promise<boolean> {
  const rows = 'path' in r
    ? await sql`update profiles set sheet_status = 'ready', sheet_path = ${r.path}, sheet_error = null
        where id = ${id} and attempt = ${attempt} returning id`
    : await sql`update profiles set sheet_status = 'failed', sheet_error = ${r.error}
        where id = ${id} and attempt = ${attempt} returning id`;
  return rows.length > 0;
}

export async function finishPhotoRead(id: string, attempt: number, read: PhotoRead | null): Promise<boolean> {
  const rows = await sql`
    update profiles set photo_read = ${read ? sql.json(read as any) : null},
      photo_read_status = ${read ? 'ready' : 'failed'}
    where id = ${id} and attempt = ${attempt} returning id`;
  return rows.length > 0;
}

export async function retrySheet(id: string): Promise<number> {
  const [r] = await sql`
    update profiles set attempt = attempt + 1, sheet_status = 'pending', sheet_path = null,
      sheet_error = null, sheet_approved = false,
      -- the bumped attempt drops an in-flight photo read, so stop step 2 waiting on it
      photo_read_status = case when photo_read_status = 'pending' then 'failed' else photo_read_status end
    where id = ${id} returning attempt`;
  return r.attempt;
}

export async function renameProfile(id: string, name: string): Promise<void> {
  await sql`update profiles set name = ${name} where id = ${id}`;
}

export async function approveSheet(id: string): Promise<void> {
  await sql`update profiles set sheet_approved = true where id = ${id}`;
}

/**
 * Starts a guide run and returns its attempt. With `unless`, the check and the bump happen in one
 * statement, so two simultaneous requests can't both start a run; it returns null when blocked.
 */
export async function beginGuide(id: string): Promise<number>;
export async function beginGuide(id: string, unless: JobStatus[]): Promise<number | null>;
export async function beginGuide(id: string, unless: JobStatus[] = []): Promise<number | null> {
  const [r] = await sql`update profiles set guide_attempt = guide_attempt + 1, guide_status = 'pending', guide_error = null
    where id = ${id} and not (guide_status = any(${unless}::text[])) returning guide_attempt`;
  return r ? r.guide_attempt : null;
}

export async function finishGuide(id: string, attempt: number, r: { guide: Guide } | { error: string }): Promise<boolean> {
  const rows = 'guide' in r
    ? await sql`update profiles set guide = ${sql.json(r.guide as any)}, guide_status = 'ready', guide_error = null
        where id = ${id} and guide_attempt = ${attempt} returning id`
    : await sql`update profiles set guide_status = 'failed', guide_error = ${r.error}
        where id = ${id} and guide_attempt = ${attempt} returning id`;
  return rows.length > 0;
}

/** Starts a run of the ten sheet-page looks, guarded the same way as beginGuide. */
export async function beginLooks(id: string): Promise<number>;
export async function beginLooks(id: string, unless: JobStatus[]): Promise<number | null>;
export async function beginLooks(id: string, unless: JobStatus[] = []): Promise<number | null> {
  const [r] = await sql`update profiles set looks_attempt = looks_attempt + 1, looks_status = 'pending', looks_error = null
    where id = ${id} and not (looks_status = any(${unless}::text[])) returning looks_attempt`;
  return r ? r.looks_attempt : null;
}

export async function finishLooks(id: string, attempt: number, r: { looks: Looks } | { error: string }): Promise<boolean> {
  const rows = 'looks' in r
    ? await sql`update profiles set looks = ${sql.json(r.looks as any)}, looks_status = 'ready', looks_error = null
        where id = ${id} and looks_attempt = ${attempt} returning id`
    : await sql`update profiles set looks_status = 'failed', looks_error = ${r.error}
        where id = ${id} and looks_attempt = ${attempt} returning id`;
  return rows.length > 0;
}

export async function setCapsuleOwned(id: string, owned: number[]): Promise<void> {
  await sql`update profiles set capsule_owned = ${sql.json(owned)} where id = ${id}`;
}

export async function deleteProfile(id: string): Promise<boolean> {
  return (await sql`delete from profiles where id = ${id} returning id`).length > 0;
}
