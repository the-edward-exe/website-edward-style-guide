import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../src/lib/db';
import { newProfileId } from '../src/lib/ids';
import {
  createProfile, getProfile, listProfiles, saveAnswers,
  setPhoto, finishSheet, deleteProfile, retrySheet,
} from '../src/lib/profiles';

beforeEach(async () => { await sql`truncate profiles`; });

describe('ids', () => {
  it('makes 22-char url-safe ids', () => {
    expect(newProfileId()).toMatch(/^[A-Za-z0-9_-]{22}$/);
  });
});

describe('profiles', () => {
  it('round-trips a created profile', async () => {
    const p = await createProfile('Ana');
    expect((await getProfile(p.id))?.name).toBe('Ana');
  });

  it('lists newest first', async () => {
    const a = await createProfile('First');
    await new Promise((r) => setTimeout(r, 10));
    const b = await createProfile('Second');
    expect((await listProfiles()).map((p) => p.id)).toEqual([b.id, a.id]);
  });

  it('merges answer patches', async () => {
    const p = await createProfile('Ana');
    await saveAnswers(p.id, { section: 'mens' });
    const answers = await saveAnswers(p.id, { height: `5'10"` });
    expect(answers).toEqual({ section: 'mens', height: `5'10"` });
  });

  it('ignores a sheet result from a stale attempt', async () => {
    const p = await createProfile('Ana');
    const first = await setPhoto(p.id, '/x/photo-1.jpg');
    await setPhoto(p.id, '/x/photo-2.jpg');
    expect(await finishSheet(p.id, first, { path: '/x/sheet-1.png' })).toBe(false);
    expect((await getProfile(p.id))?.sheetStatus).toBe('pending');
  });

  it('a sheet retry does not leave the photo read stuck pending', async () => {
    const p = await createProfile('Ana');
    await setPhoto(p.id, '/x/photo.jpg');
    await retrySheet(p.id);
    expect((await getProfile(p.id))?.photoReadStatus).toBe('failed');
  });

  it('returns null for an unknown id', async () => {
    expect(await getProfile('nope')).toBeNull();
  });

  it('deletes a profile', async () => {
    const p = await createProfile('Ana');
    expect(await deleteProfile(p.id)).toBe(true);
    expect(await getProfile(p.id)).toBeNull();
  });
});
