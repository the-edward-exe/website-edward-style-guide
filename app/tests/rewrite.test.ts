import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/ai/guide', () => ({ generateGuide: vi.fn(() => new Promise(() => {})) }));
vi.mock('../src/lib/ai/tryon', async (orig) => ({ ...(await orig<any>()), generateTryon: vi.fn(() => new Promise(() => {})) }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, finishSheet, approveSheet, beginGuide, finishGuide } from '../src/lib/profiles';
import { listTryons } from '../src/lib/tryons';
import { DEMO_GUIDE } from '../src/lib/ai/demo-guide';
import { POST as startTryon, GET as listRoute } from '../src/pages/api/p/[id]/tryons/index';
import { POST as regenerate } from '../src/pages/api/p/[id]/guide/regenerate';

beforeEach(async () => { await sql`truncate profiles cascade`; });

async function withGuide() {
  const p = await createProfile('Ana');
  await finishSheet(p.id, await setPhoto(p.id, '/x/photo.jpg'), { path: '/x/sheet.png' });
  await approveSheet(p.id);
  await finishGuide(p.id, await beginGuide(p.id), { guide: DEMO_GUIDE });
  return p.id;
}
const post = (fn: any, id: string, body?: object) => fn({ params: { id }, request: new Request('http://localhost/', { method: 'POST', body: body ? JSON.stringify(body) : undefined, headers: { 'Content-Type': 'application/json' } }) });

describe('rewriting the guide', () => {
  it('try-ons from the old guide leave the dressing room', async () => {
    const id = await withGuide();
    await post(startTryon, id, { outfitId: 'o01' });
    expect((await listTryons(id, 1)).length).toBe(1);

    expect((await post(regenerate, id)).status).toBe(303);
    const p = await getProfile(id);
    await finishGuide(id, p!.guideAttempt, { guide: DEMO_GUIDE });

    const listed = await (await listRoute({ params: { id } } as any)).json();
    expect(listed.tryons).toEqual([]);
    expect((await listTryons(id)).length).toBe(1); // still stored
  });
});
