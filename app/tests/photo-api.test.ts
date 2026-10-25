import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFile } from 'node:fs/promises';

vi.mock('../src/lib/jobs', () => ({ startPhotoJobs: vi.fn(), startSheetJob: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile } from '../src/lib/profiles';
import { POST } from '../src/pages/api/p/[id]/photo';

beforeEach(async () => { await sql`truncate profiles`; });

async function upload(id: string, file: string, type: string) {
  const form = new FormData();
  form.append('photo', new File([await readFile(new URL(`./fixtures/${file}`, import.meta.url))], file, { type }));
  const request = new Request('http://localhost/', { method: 'POST', body: form, headers: { Accept: 'application/json' } });
  return POST({ params: { id }, request } as any);
}

describe('POST photo (drag and drop, JSON)', () => {
  it('returns the saved state as JSON and stays on the page', async () => {
    const p = await createProfile('Ana');
    const res = await upload(p.id, 'ok.jpg', 'image/jpeg');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, next: `/p/${p.id}/q/1` });
    expect((await getProfile(p.id))?.sheetStatus).toBe('pending');
  });

  it('returns the plain message as JSON for a non-image', async () => {
    const p = await createProfile('Ana');
    const res = await upload(p.id, 'not-image.txt', 'text/plain');
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'USE A JPG, PNG OR WEBP PHOTO.' });
  });
});
