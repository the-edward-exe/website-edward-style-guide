import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/ai/guide', () => ({ generateGuide: vi.fn() }));
vi.mock('../src/lib/ai/gemini', () => ({ generateCharacterSheet: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, finishSheet, beginGuide, finishGuide } from '../src/lib/profiles';
import { saveImage } from '../src/lib/storage';
import { generateGuide } from '../src/lib/ai/guide';
import { runGuideJob } from '../src/lib/jobs';
import { DEMO_GUIDE } from '../src/lib/ai/demo-guide';
import { POST as approve } from '../src/pages/api/p/[id]/sheet/approve';
import { POST as regenerate } from '../src/pages/api/p/[id]/guide/regenerate';

const call = (fn: any, id: string) => fn({ params: { id }, request: new Request('http://localhost/', { method: 'POST' }) });

async function readyProfile() {
  const p = await createProfile('Ana');
  const attempt = await setPhoto(p.id, await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff])));
  await finishSheet(p.id, attempt, { path: '/x/sheet.png' });
  return p.id;
}

beforeEach(async () => {
  await sql`truncate profiles cascade`;
  vi.mocked(generateGuide).mockReset();
});

describe('guide job', () => {
  it('stores the guide', async () => {
    const id = await readyProfile();
    vi.mocked(generateGuide).mockResolvedValue(DEMO_GUIDE);
    await runGuideJob(id, await beginGuide(id));
    const p = await getProfile(id);
    expect(p?.guideStatus).toBe('ready');
    expect(p?.guide?.outfits).toHaveLength(12);
  });

  it('stores the error message', async () => {
    const id = await readyProfile();
    vi.mocked(generateGuide).mockRejectedValue(new Error('overloaded'));
    await runGuideJob(id, await beginGuide(id));
    expect((await getProfile(id))?.guideError).toBe('overloaded');
  });

  it('drops a guide from an older run', async () => {
    const id = await readyProfile();
    const first = await beginGuide(id);
    await beginGuide(id);
    vi.mocked(generateGuide).mockResolvedValue(DEMO_GUIDE);
    await runGuideJob(id, first);
    expect((await getProfile(id))?.guideStatus).toBe('pending');
  });
});

describe('approve and regenerate', () => {
  it('approving twice starts the guide once', async () => {
    const id = await readyProfile();
    vi.mocked(generateGuide).mockReturnValue(new Promise(() => {}));
    await call(approve, id);
    await call(approve, id);
    expect((await getProfile(id))?.guideAttempt).toBe(1);
  });

  it('regenerate starts a new run once the last one is done', async () => {
    const id = await readyProfile();
    vi.mocked(generateGuide).mockReturnValue(new Promise(() => {}));
    await call(approve, id);
    await finishGuide(id, 1, { error: 'x' });
    const res = await call(regenerate, id);
    expect(res.status).toBe(303);
    expect((await getProfile(id))?.guideAttempt).toBe(2);
  });
});
