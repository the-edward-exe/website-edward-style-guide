import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { unzipSync } from 'fflate';

vi.mock('../src/lib/ai/tryon', async (orig) => ({ ...(await orig<any>()), generateTryon: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, finishSheet, approveSheet, beginGuide, finishGuide, deleteProfile } from '../src/lib/profiles';
import { saveImage, profileDir, removeProfileFiles } from '../src/lib/storage';
import { createTryon, listTryons } from '../src/lib/tryons';
import { generateTryon, tryonPrompt } from '../src/lib/ai/tryon';
import { runTryonJob } from '../src/lib/jobs';
import { DEMO_GUIDE } from '../src/lib/ai/demo-guide';
import { POST as startRoute } from '../src/pages/api/p/[id]/tryons/index';
import { GET as zipRoute } from '../src/pages/api/p/[id]/tryons/zip';

const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');

async function guideReady(name = 'Ana María') {
  const p = await createProfile(name);
  const attempt = await setPhoto(p.id, await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff])));
  await finishSheet(p.id, attempt, { path: await saveImage(p.id, 'sheet', PNG) });
  await approveSheet(p.id);
  await finishGuide(p.id, await beginGuide(p.id), { guide: DEMO_GUIDE });
  return p.id;
}
const start = (id: string, body: object) =>
  startRoute({ params: { id }, request: new Request('http://localhost/', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) } as any);

beforeEach(async () => {
  await sql`truncate profiles cascade`;
  vi.mocked(generateTryon).mockReset();
  vi.mocked(generateTryon).mockReturnValue(new Promise(() => {}));
});

describe('try-ons', () => {
  it('numbers versions per outfit', async () => {
    const id = await guideReady();
    const a = await createTryon(id, 'o01', 'p');
    const b = await createTryon(id, 'o01', 'p');
    const c = await createTryon(id, 'o02', 'p');
    expect([a.version, b.version, c.version]).toEqual([1, 2, 1]);
  });

  it('stores the image when the job finishes', async () => {
    const id = await guideReady();
    const t = await createTryon(id, 'o01', 'p');
    vi.mocked(generateTryon).mockResolvedValue(PNG);
    await runTryonJob(t.id);
    const [row] = await listTryons(id);
    expect(row.status).toBe('ready');
    expect(existsSync(row.path!)).toBe(true);
  });

  it('stores the error when generation fails', async () => {
    const id = await guideReady();
    const t = await createTryon(id, 'o01', 'p');
    vi.mocked(generateTryon).mockRejectedValue(new Error('quota'));
    await runTryonJob(t.id);
    expect((await listTryons(id))[0].error).toBe('quota');
  });

  it('writes nothing when the profile is deleted mid-flight', async () => {
    const id = await guideReady();
    const t = await createTryon(id, 'o01', 'p');
    let release!: (b: Buffer) => void;
    vi.mocked(generateTryon).mockReturnValueOnce(new Promise((r) => { release = r; }));
    const job = runTryonJob(t.id);
    await deleteProfile(id);
    await removeProfileFiles(id);
    release(PNG);
    await expect(job).resolves.toBeUndefined();
    expect(existsSync(profileDir(id))).toBe(false);
  });

  it('builds a prompt from the outfit pieces and setting', async () => {
    const id = await guideReady();
    const text = tryonPrompt((await getProfile(id))!, DEMO_GUIDE.outfits[0]);
    expect(text).toContain('navy wool-blend overshirt');
    expect(text).toContain('a modern office lobby');
    expect(text).toContain('character sheet');
  });
});

describe('try-on endpoints', () => {
  it('refuses before the guide is ready', async () => {
    const p = await createProfile('Ana');
    expect((await start(p.id, { outfitId: 'o01' })).status).toBe(409);
  });

  it('rejects an unknown outfit', async () => {
    const id = await guideReady();
    expect((await start(id, { outfitId: 'o99' })).status).toBe(400);
  });

  it('starts a try-on and returns the row', async () => {
    const id = await guideReady();
    const res = await start(id, { outfitId: 'o03' });
    const out = await res.json();
    expect(out.tryon).toMatchObject({ outfitId: 'o03', version: 1, status: 'pending' });
  });

  it('zip with nothing ready is a plain 404', async () => {
    const id = await guideReady();
    const res = await zipRoute({ params: { id } } as any);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'NO TRY-ONS YET.' });
  });

  it('zip holds the latest ready image per outfit, named for download', async () => {
    const id = await guideReady();
    vi.mocked(generateTryon).mockResolvedValue(PNG);
    for (const o of ['o01', 'o01', 'o02']) await runTryonJob((await createTryon(id, o, 'p', 1)).id);
    const res = await zipRoute({ params: { id } } as any);
    expect(res.headers.get('Content-Disposition')).toContain('ana-mar-a-dressing-room.zip');
    const files = Object.keys(unzipSync(new Uint8Array(await res.arrayBuffer()))).sort();
    expect(files).toEqual(['ana-mar-a-camel-and-charcoal-1.png', 'ana-mar-a-navy-overshirt-weekday-2.png']);
  });
});
