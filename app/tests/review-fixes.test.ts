import { describe, it, expect, beforeEach, vi } from 'vitest';
import { execSync } from 'node:child_process';

vi.mock('../src/lib/ai/guide', () => ({ generateGuide: vi.fn(() => new Promise(() => {})) }));
vi.mock('../src/lib/ai/tryon', async (orig) => ({ ...(await orig<any>()), generateTryon: vi.fn(() => new Promise(() => {})) }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, finishSheet } from '../src/lib/profiles';
import { createTryon, listTryons } from '../src/lib/tryons';
import { saveImage } from '../src/lib/storage';
import { POST as approve } from '../src/pages/api/p/[id]/sheet/approve';

beforeEach(async () => { await sql`truncate profiles cascade`; });
const call = (fn: any, id: string) => fn({ params: { id }, request: new Request('http://localhost/', { method: 'POST' }) });

async function sheetReady() {
  const p = await createProfile('Ana');
  await finishSheet(p.id, await setPhoto(p.id, await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff]))), { path: '/x/sheet.png' });
  return p.id;
}

describe('review fixes', () => {
  it('two simultaneous approvals start the guide once', async () => {
    const id = await sheetReady();
    await Promise.all([call(approve, id), call(approve, id)]);
    expect((await getProfile(id))?.guideAttempt).toBe(1);
  });

  it('two simultaneous try-ons for one outfit become versions 1 and 2', async () => {
    const id = await sheetReady();
    const rows = await Promise.all([createTryon(id, 'o01', 'p'), createTryon(id, 'o01', 'p')]);
    expect(rows.map((r) => r.version).sort()).toEqual([1, 2]);
  });

  it('work interrupted by a restart is marked failed on start', async () => {
    const id = await sheetReady();
    await createTryon(id, 'o01', 'p');
    await sql`update profiles set guide_status = 'pending' where id = ${id}`;
    execSync('node scripts/migrate.mjs', { env: { ...process.env, DATABASE_URL: 'postgres://style:style@localhost:5433/style_test' }, stdio: 'ignore' });
    const [t] = await listTryons(id);
    const p = await getProfile(id);
    expect([t.status, t.error]).toEqual(['failed', 'INTERRUPTED. TRY AGAIN.']);
    expect([p?.guideStatus, p?.sheetStatus, p?.guideError]).toEqual(['failed', 'ready', 'INTERRUPTED. TRY AGAIN.']);
  });
});
