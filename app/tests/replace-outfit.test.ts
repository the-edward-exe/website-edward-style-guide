import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync } from 'node:fs';

vi.mock('../src/lib/ai/tryon', async (orig) => ({ ...(await orig<any>()), generateTryon: vi.fn() }));
vi.mock('../src/lib/ai/outfits', () => ({ generateOutfits: vi.fn(), generateReplacement: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, finishSheet, saveAnswers, beginLooks, finishLooks } from '../src/lib/profiles';
import { saveImage } from '../src/lib/storage';
import { generateTryon } from '../src/lib/ai/tryon';
import { generateOutfits, generateReplacement } from '../src/lib/ai/outfits';
import { runLookImages, runOutfitsJob } from '../src/lib/jobs';
import { stopGeneration, STOPPED } from '../src/lib/stop';
import { beginOutfits, listOutfits, replacementPrompt } from '../src/lib/outfits';
import { listLookImages } from '../src/lib/look-images';
import { DEMO_LOOKS } from '../src/lib/ai/demo-looks';
import { POST as replaceOutfitRoute } from '../src/pages/api/p/[id]/outfits/[oid]/replace';
import { POST as retryOutfitRoute, GET as outfitImage } from '../src/pages/api/p/[id]/outfits/[oid]';
import { POST as replaceLookRoute } from '../src/pages/api/p/[id]/looks/[n]/replace';
import { GET as outfitsStatus } from '../src/pages/api/p/[id]/outfits/index';
import { GET as status } from '../src/pages/api/p/[id]/status';

const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');
const ANSWERS = {
  section: 'mens', height: '6ft', topSize: 'M', bottomSize: '32', shape: ['pear'], goals: ['comfort'], skinTone: 5,
  metal: 'gold', hair: 'black', eyes: 'brown', styles: ['minimal'], avoid: ['none'],
  dressCode: ['remote'], location: 'Austin', budget: ['$$'],
};
const WRITTEN = DEMO_LOOKS.looks.map(({ style: _style, ...l }) => l);
const FRESH = { ...WRITTEN[0], name: 'Fresh Replacement' };

async function readyProfile() {
  const p = await createProfile('Ana');
  const attempt = await setPhoto(p.id, await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff])));
  await saveAnswers(p.id, ANSWERS as any);
  await finishSheet(p.id, attempt, { path: await saveImage(p.id, 'sheet', PNG) });
  return p.id;
}
async function withOutfits() {
  const id = await readyProfile();
  await runOutfitsJob((await beginOutfits(id, ['Winter', 'Summer'], ['classic', 'edgy']))!);
  return { id, outfits: await listOutfits(id) };
}
async function withLooks() {
  const id = await readyProfile();
  await finishLooks(id, await beginLooks(id), { looks: DEMO_LOOKS });
  await runLookImages(id);
  return id;
}
const replaceOutfit = (id: string, oid: string) => replaceOutfitRoute({ params: { id, oid } } as any);
const replaceLook = (id: string, n: string) => replaceLookRoute({ params: { id, n } } as any);
const outfit = async (id: string, oid: string) => (await listOutfits(id)).find((o) => o.id === oid)!;

beforeEach(async () => {
  await sql`truncate profiles cascade`;
  vi.mocked(generateTryon).mockReset().mockResolvedValue(PNG);
  vi.mocked(generateOutfits).mockReset().mockResolvedValue(WRITTEN);
  vi.mocked(generateReplacement).mockReset().mockResolvedValue(FRESH);
});

describe('removing an outfit from the library', () => {
  it('replaces it in the same spot, season and style, and deletes the old picture', async () => {
    const { id, outfits } = await withOutfits();
    const old = outfits[3];
    vi.mocked(generateTryon).mockClear();
    const res = await replaceOutfit(id, old.id);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe(`/p/${id}/dressing#outfit-${old.id}`);
    expect(existsSync(old.path!)).toBe(false);
    await vi.waitFor(async () => expect((await outfit(id, old.id)).status).toBe('ready'));
    const now = await outfit(id, old.id);
    expect(now).toMatchObject({ idx: old.idx, season: old.season, style: old.style, replacing: false });
    expect(now.look.name).toBe('Fresh Replacement');
    expect(existsSync(now.path!)).toBe(true);
    expect(await listOutfits(id)).toHaveLength(10);
    expect(generateTryon).toHaveBeenCalledTimes(1);
  });

  it('tells the stylist what was rejected and what to avoid', async () => {
    const { id, outfits } = await withOutfits();
    await replaceOutfit(id, outfits[0].id);
    await vi.waitFor(async () => expect((await outfit(id, outfits[0].id)).status).toBe('ready'));
    const [, , slot, previous, rejected] = vi.mocked(generateReplacement).mock.calls[0];
    expect(slot).toEqual({ season: outfits[0].season, style: outfits[0].style });
    expect(rejected).toBe(outfits[0].look.name);
    expect(previous).toContain(outfits[1].look.name);
    const prompt = replacementPrompt((await getProfile(id))!, slot, previous, rejected);
    expect(prompt).toContain(outfits[0].look.name);
    expect(prompt).toContain(outfits[0].season);
  });

  it('pressing X twice makes one replacement', async () => {
    const { id, outfits } = await withOutfits();
    vi.mocked(generateReplacement).mockImplementation(() => new Promise(() => {}));
    await replaceOutfit(id, outfits[0].id);
    await replaceOutfit(id, outfits[0].id);
    await vi.waitFor(() => expect(generateReplacement).toHaveBeenCalledTimes(1));
    await stopGeneration(id, 'outfits');
  });

  it('shows no old outfit while it is being replaced', async () => {
    const { id, outfits } = await withOutfits();
    vi.mocked(generateReplacement).mockImplementation(() => new Promise(() => {}));
    await replaceOutfit(id, outfits[0].id);
    const url = new URL('http://localhost/');
    expect((await outfitImage({ params: { id, oid: outfits[0].id }, url } as any)).status).toBe(404);
    const out = await (await outfitsStatus({ params: { id } } as any)).json();
    expect(out.outfits.find((o: any) => o.id === outfits[0].id)).toMatchObject({ status: 'pending', replacing: true });
    await stopGeneration(id, 'outfits');
  });

  it('a failed replacement can be tried again and still writes a new outfit', async () => {
    const { id, outfits } = await withOutfits();
    vi.mocked(generateReplacement).mockRejectedValueOnce(new Error('NO OUTFIT'));
    await replaceOutfit(id, outfits[0].id);
    await vi.waitFor(async () => expect((await outfit(id, outfits[0].id)).error).toBe('NO OUTFIT'));
    expect((await outfit(id, outfits[0].id)).replacing).toBe(true);
    await retryOutfitRoute({ params: { id, oid: outfits[0].id } } as any);
    await vi.waitFor(async () => expect((await outfit(id, outfits[0].id)).status).toBe('ready'));
    expect((await outfit(id, outfits[0].id)).look.name).toBe('Fresh Replacement');
  });

  it('Stop ends a replacement', async () => {
    const { id, outfits } = await withOutfits();
    vi.mocked(generateReplacement).mockImplementation(() => new Promise(() => {}));
    await replaceOutfit(id, outfits[0].id);
    await stopGeneration(id, 'outfits');
    expect(await outfit(id, outfits[0].id)).toMatchObject({ status: 'failed', error: STOPPED, replacing: true });
  });

  it('will not touch another profile’s outfit', async () => {
    const { id, outfits } = await withOutfits();
    const other = await readyProfile();
    await replaceOutfit(other, outfits[0].id);
    expect((await outfit(id, outfits[0].id)).status).toBe('ready');
    expect(generateReplacement).not.toHaveBeenCalled();
  });
});

describe('removing a skin tone look', () => {
  it('replaces it in the same spot and style and deletes the old picture', async () => {
    const id = await withLooks();
    const before = (await getProfile(id))!;
    const old = (await listLookImages(before))[2];
    const res = await replaceLook(id, '3');
    expect(res.headers.get('Location')).toBe(`/p/${id}/dressing#look-3`);
    expect(existsSync(old.path!)).toBe(false);
    await vi.waitFor(async () => expect((await listLookImages((await getProfile(id))!))[2].status).toBe('ready'));
    const after = (await getProfile(id))!;
    expect(after.looks!.looks[2].name).toBe('Fresh Replacement');
    expect(after.looks!.looks[2].style).toBe(before.looks!.looks[2].style);
    expect(after.looks!.looks[1]).toEqual(before.looks!.looks[1]);
    expect(after.looksAttempt).toBe(before.looksAttempt);
    expect((await listLookImages(after))[2]).toMatchObject({ replacing: false });
    expect(vi.mocked(generateReplacement).mock.calls[0][4]).toBe(before.looks!.looks[2].name);
  });

  it('status says which look is being replaced', async () => {
    const id = await withLooks();
    vi.mocked(generateReplacement).mockImplementation(() => new Promise(() => {}));
    await replaceLook(id, '1');
    const out = await (await status({ params: { id } } as any)).json();
    expect(out.lookImages[0]).toMatchObject({ status: 'pending', replacing: true });
    expect(out.lookImages[1].replacing).toBe(false);
    await stopGeneration(id, 'looks');
  });

  it('ignores a look that does not exist', async () => {
    const id = await withLooks();
    expect((await replaceLook(id, '99')).status).toBe(404);
    expect(generateReplacement).not.toHaveBeenCalled();
  });
});
