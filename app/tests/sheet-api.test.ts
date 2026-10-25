import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/jobs', () => ({ startSheetJob: vi.fn(), startPhotoJobs: vi.fn(), startGuideJob: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, finishSheet } from '../src/lib/profiles';
import { startSheetJob } from '../src/lib/jobs';
import { POST as approve } from '../src/pages/api/p/[id]/sheet/approve';
import { POST as retry } from '../src/pages/api/p/[id]/sheet/retry';

const call = (fn: any, id: string) => fn({ params: { id }, request: new Request('http://localhost/', { method: 'POST' }) });

beforeEach(async () => { await sql`truncate profiles cascade`; vi.mocked(startSheetJob).mockReset(); });

async function withPendingSheet() {
  const p = await createProfile('Ana');
  const attempt = await setPhoto(p.id, '/x/photo.jpg');
  return { id: p.id, attempt };
}

describe('sheet approval', () => {
  it('refuses to approve a sheet that is still building', async () => {
    const { id } = await withPendingSheet();
    expect((await call(approve, id)).status).toBe(409);
  });

  it('approves a ready sheet and moves on to results', async () => {
    const { id, attempt } = await withPendingSheet();
    await finishSheet(id, attempt, { path: '/x/sheet.png' });
    const res = await call(approve, id);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe(`/p/${id}`);
    expect((await getProfile(id))?.sheetApproved).toBe(true);
  });

  it('retry starts a new attempt', async () => {
    const { id, attempt } = await withPendingSheet();
    await finishSheet(id, attempt, { error: 'quota' });
    const res = await call(retry, id);
    const p = await getProfile(id);
    expect(res.status).toBe(303);
    expect(p?.attempt).toBe(attempt + 1);
    expect(p?.sheetStatus).toBe('pending');
    expect(startSheetJob).toHaveBeenCalledWith(id, attempt + 1);
  });
});
