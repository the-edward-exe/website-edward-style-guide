import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { unzipSync } from 'fflate';

vi.mock('../src/lib/ai/tryon', async (orig) => ({ ...(await orig<any>()), generateTryon: vi.fn() }));
vi.mock('../src/lib/ai/outfits', () => ({ generateOutfits: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, finishSheet, saveAnswers, deleteProfile, beginLooks, finishLooks } from '../src/lib/profiles';
import { POST as answersRoute } from '../src/pages/api/p/[id]/answers';
import { saveImage } from '../src/lib/storage';
import { generateTryon } from '../src/lib/ai/tryon';
import { generateOutfits } from '../src/lib/ai/outfits';
import { runOutfitsJob } from '../src/lib/jobs';
import { stopGeneration, stopAll, STOPPED } from '../src/lib/stop';
import { DEMO_LOOKS } from '../src/lib/ai/demo-looks';
import {
  OUTFIT_COUNT, SEASONS, outfitSlots, outfitsPrompt, canMakeOutfits, parseOutfitChoice,
  beginOutfits, finishOutfitRun, getOutfitRun, latestOutfitRun, listOutfits, previousOutfitNames,
} from '../src/lib/outfits';
import { GET as listRoute, POST as startRoute } from '../src/pages/api/p/[id]/outfits/index';
import { GET as imageRoute, POST as retryRoute } from '../src/pages/api/p/[id]/outfits/[oid]';
import { GET as zipRoute } from '../src/pages/api/p/[id]/outfits/zip';

const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');
const ANSWERS = {
  section: 'mens', height: '6ft', topSize: 'M', bottomSize: '32', shape: ['pear'], goals: ['comfort'], skinTone: 5,
  metal: 'gold', hair: 'black', eyes: 'brown', styles: ['minimal', 'workwear'], avoid: ['none'],
  dressCode: ['remote'], location: 'Austin', budget: ['$$'],
};
const WRITTEN = DEMO_LOOKS.looks.map(({ style: _style, ...l }) => l);

async function readyProfile() {
  const p = await createProfile('Ana');
  const attempt = await setPhoto(p.id, await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff])));
  await saveAnswers(p.id, ANSWERS as any);
  await finishSheet(p.id, attempt, { path: await saveImage(p.id, 'sheet', PNG) });
  return p.id;
}
const tally = (xs: string[]) => Object.values(xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {}));
const form = (pairs: [string, string][]) => new Request('http://localhost/', { method: 'POST', body: new URLSearchParams(pairs) });
const start = (id: string, pairs: [string, string][]) => startRoute({ params: { id }, request: form(pairs) } as any);
async function made(id: string, seasons = ['Winter', 'Summer'], styles = ['classic', 'edgy']) {
  vi.mocked(generateOutfits).mockResolvedValue(WRITTEN);
  vi.mocked(generateTryon).mockResolvedValue(PNG);
  const run = (await beginOutfits(id, seasons, styles))!;
  await runOutfitsJob(run);
  return run;
}

beforeEach(async () => {
  await sql`truncate profiles cascade`;
  vi.mocked(generateTryon).mockReset();
  vi.mocked(generateOutfits).mockReset();
});

describe('splitting outfits across seasons and styles', () => {
  it('always makes ten, balanced by season and by style', () => {
    for (let s = 1; s <= SEASONS.length; s++) {
      for (let t = 1; t <= 8; t++) {
        const slots = outfitSlots(SEASONS.slice(0, s), Array.from({ length: t }, (_, i) => `S${i}`));
        expect(slots).toHaveLength(OUTFIT_COUNT);
        for (const counts of [tally(slots.map((x) => x.season)), tally(slots.map((x) => x.style))]) {
          expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        }
        expect(new Set(slots.map((x) => x.season)).size).toBe(s);
        expect(new Set(slots.map((x) => x.style)).size).toBe(t);
      }
    }
  });

  it('crosses seasons with styles rather than pairing them off', () => {
    const slots = outfitSlots(['Summer', 'Winter'], ['Classic', 'Edgy']);
    expect(new Set(slots.map((x) => `${x.season}/${x.style}`)).size).toBe(4);
  });
});

describe('choosing what to make', () => {
  it('keeps valid picks in a fixed order and ignores the rest', () => {
    const f = new FormData();
    for (const s of ['Winter', 'Spring', 'Monsoon']) f.append('season', s);
    for (const s of ['edgy', 'nope']) f.append('style', s);
    expect(parseOutfitChoice(f)).toEqual({ seasons: ['Spring', 'Winter'], styles: ['edgy'] });
  });

  it('needs at least one season and one style', () => {
    const f = new FormData();
    f.append('season', 'Winter');
    expect(parseOutfitChoice(f)).toBeNull();
  });

  it('needs a finished profile', async () => {
    const p = await createProfile('Ana');
    expect(canMakeOutfits(p)).toBe(false);
    expect(canMakeOutfits((await getProfile(await readyProfile()))!)).toBe(true);
  });

  it('the prompt lists every slot in order, dresses for the season and avoids repeats', async () => {
    const p = (await getProfile(await readyProfile()))!;
    const prompt = outfitsPrompt(p, outfitSlots(['Winter'], ['Classic']), ['Old Navy Peacoat']);
    expect(prompt).toContain('1. Winter, Classic');
    expect(prompt).toContain('10. Winter, Classic');
    expect(prompt).toContain('Austin');
    expect(prompt).toContain('Old Navy Peacoat');
  });
});

describe('making outfits', () => {
  it('files each outfit by season and style and makes its picture from the sheet', async () => {
    const id = await readyProfile();
    const run = await made(id);
    expect((await getOutfitRun(run))!.status).toBe('ready');
    const outfits = await listOutfits(id);
    expect(outfits).toHaveLength(10);
    expect(outfits.every((o) => o.status === 'ready' && existsSync(o.path!))).toBe(true);
    expect(new Set(outfits.map((o) => o.season))).toEqual(new Set(['Summer', 'Winter']));
    expect(new Set(outfits.map((o) => o.style))).toEqual(new Set(['Classic', 'Edgy']));
    expect(generateTryon).toHaveBeenCalledTimes(10);
  });

  it('a second run adds to the library and is told what already exists', async () => {
    const id = await readyProfile();
    await made(id);
    await made(id, ['Fall'], ['boho']);
    expect(await listOutfits(id)).toHaveLength(20);
    expect((await previousOutfitNames(id))).toContain(WRITTEN[0].name);
    expect(vi.mocked(generateOutfits).mock.calls[1][3]).toContain(WRITTEN[0].name);
  });

  it('leaves the ten looks and the guide alone', async () => {
    const id = await readyProfile();
    await made(id);
    const p = (await getProfile(id))!;
    expect(p.looksStatus).toBe('none');
    expect(p.guideStatus).toBe('none');
  });

  it('only one run at a time', async () => {
    const id = await readyProfile();
    expect(await beginOutfits(id, ['Fall'], ['boho'])).not.toBeNull();
    expect(await beginOutfits(id, ['Fall'], ['boho'])).toBeNull();
  });

  it('no new run while pictures are still being made', async () => {
    const id = await readyProfile();
    const run = (await beginOutfits(id, ['Fall'], ['boho']))!;
    await finishOutfitRun(run, { looks: WRITTEN });
    expect(await beginOutfits(id, ['Fall'], ['boho'])).toBeNull();
  });

  it('a failed run shows its error and clears when a new one starts', async () => {
    const id = await readyProfile();
    vi.mocked(generateOutfits).mockRejectedValue(new Error('NO OUTFITS'));
    const run = (await beginOutfits(id, ['Fall'], ['boho']))!;
    await runOutfitsJob(run);
    expect(await latestOutfitRun(id)).toMatchObject({ status: 'failed', error: 'NO OUTFITS', seasons: ['Fall'], styles: ['boho'] });
    await beginOutfits(id, ['Fall'], ['boho']);
    expect(await getOutfitRun(run)).toBeNull();
  });

  it('a failed picture keeps the rest', async () => {
    const id = await readyProfile();
    vi.mocked(generateOutfits).mockResolvedValue(WRITTEN);
    vi.mocked(generateTryon).mockRejectedValueOnce(new Error('NO IMAGE')).mockResolvedValue(PNG);
    await runOutfitsJob((await beginOutfits(id, ['Fall'], ['boho']))!);
    const outfits = await listOutfits(id);
    expect(outfits.filter((o) => o.status === 'failed').map((o) => o.error)).toEqual(['NO IMAGE']);
    expect(outfits.filter((o) => o.status === 'ready')).toHaveLength(9);
  });
});

describe('new outfits keep the old ones', () => {
  it('a later run adds to the same season and style group', async () => {
    const id = await readyProfile();
    await made(id, ['Fall'], ['boho']);
    const first = (await listOutfits(id)).map((o) => o.id);
    await made(id, ['Fall'], ['boho']);
    const all = await listOutfits(id);
    expect(all).toHaveLength(20);
    expect(all.every((o) => o.season === 'Fall' && o.style === 'Boho' && o.status === 'ready')).toBe(true);
    expect(all.map((o) => o.id)).toEqual(expect.arrayContaining(first));
  });

  const changeTaste = (id: string, styles: string[]) => answersRoute({
    params: { id },
    url: new URL(`http://localhost/api/p/${id}/answers?step=3`),
    request: new Request('http://localhost/', {
      method: 'POST', headers: { Accept: 'application/json' },
      body: new URLSearchParams([...styles.map((s) => ['styles', s]), ['avoid', 'none']]),
    }),
  } as any);
  async function withLooks() {
    const id = await readyProfile();
    await finishLooks(id, await beginLooks(id), { looks: DEMO_LOOKS });
    vi.mocked(generateOutfits).mockResolvedValue(WRITTEN);
    vi.mocked(generateTryon).mockResolvedValue(PNG);
    return id;
  }

  it('changing taste keeps the looks and sends new outfits to the New Outfits page', async () => {
    const id = await withLooks();
    const before = (await getProfile(id))!;
    const out = await (await changeTaste(id, ['edgy'])).json();
    expect(out.go).toBe(`/p/${id}/dressing#outfits`);
    await vi.waitFor(async () => expect((await listOutfits(id)).filter((o) => o.status === 'ready')).toHaveLength(10));
    const after = (await getProfile(id))!;
    expect(after.looksAttempt).toBe(before.looksAttempt);
    expect(after.looks).toEqual(before.looks);
    const outfits = await listOutfits(id);
    expect(new Set(outfits.map((o) => o.style))).toEqual(new Set(['Edgy']));
    expect(new Set(outfits.map((o) => o.season))).toEqual(new Set(SEASONS));
  });

  it('saving the same taste makes nothing', async () => {
    const id = await withLooks();
    const out = await (await changeTaste(id, ['minimal', 'workwear'])).json();
    expect(out.go).toBeUndefined();
    expect(await latestOutfitRun(id)).toBeNull();
  });
});

describe('stopping outfits', () => {
  it('stops the writing, and a late answer is dropped', async () => {
    const id = await readyProfile();
    const run = (await beginOutfits(id, ['Fall'], ['boho']))!;
    expect(await stopGeneration(id, 'outfits')).toBe(true);
    expect(await getOutfitRun(run)).toMatchObject({ status: 'failed', error: STOPPED });
    expect(await finishOutfitRun(run, { looks: WRITTEN })).toEqual([]);
    expect(await listOutfits(id)).toHaveLength(0);
  });

  it('stops pictures still waiting and keeps finished ones', async () => {
    const id = await readyProfile();
    await made(id);
    const run = (await beginOutfits(id, ['Fall'], ['boho']))!;
    await finishOutfitRun(run, { looks: WRITTEN });
    await stopGeneration(id, 'outfits');
    const outfits = await listOutfits(id);
    expect(outfits.filter((o) => o.status === 'ready')).toHaveLength(10);
    expect(outfits.filter((o) => o.status === 'failed' && o.error === STOPPED)).toHaveLength(10);
  });

  it('stopAll covers outfits, and deleting the profile removes them', async () => {
    const id = await readyProfile();
    const run = (await beginOutfits(id, ['Fall'], ['boho']))!;
    await stopAll(id);
    expect((await getOutfitRun(run))!.status).toBe('failed');
    await deleteProfile(id);
    expect(await getOutfitRun(run)).toBeNull();
  });
});

describe('outfit routes', () => {
  const image = (id: string, oid: string, q = '') =>
    imageRoute({ params: { id, oid }, url: new URL(`http://localhost/api/p/${id}/outfits/${oid}${q}`) } as any);
  const retry = (id: string, oid: string) => retryRoute({ params: { id, oid } } as any);

  it('starting needs a finished profile and a choice', async () => {
    const unfinished = await createProfile('Ana');
    expect((await start(unfinished.id, [['season', 'Fall'], ['style', 'boho']])).status).toBe(409);
    const id = await readyProfile();
    expect((await start(id, [['season', 'Fall']])).status).toBe(400);
    expect(await latestOutfitRun(id)).toBeNull();
  });

  it('starting runs the job and returns to the outfits page', async () => {
    const id = await readyProfile();
    vi.mocked(generateOutfits).mockResolvedValue(WRITTEN);
    vi.mocked(generateTryon).mockResolvedValue(PNG);
    const res = await start(id, [['season', 'Fall'], ['style', 'boho']]);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe(`/p/${id}/dressing#outfits`);
    await vi.waitFor(async () => expect((await listOutfits(id)).filter((o) => o.status === 'ready')).toHaveLength(10));
  });

  it('serves a picture and a download named by season and style', async () => {
    const id = await readyProfile();
    await made(id, ['Fall'], ['boho']);
    const [o] = await listOutfits(id);
    expect((await image(id, o.id)).headers.get('Content-Type')).toBe('image/png');
    expect((await image(id, o.id, '?download=1')).headers.get('Content-Disposition')).toContain('fall-boho');
  });

  it('will not serve another profile’s outfit', async () => {
    const id = await readyProfile();
    const other = await readyProfile();
    await made(id);
    const [o] = await listOutfits(id);
    expect((await image(other, o.id)).status).toBe(404);
  });

  it('try again redoes only a failed picture', async () => {
    const id = await readyProfile();
    vi.mocked(generateOutfits).mockResolvedValue(WRITTEN);
    vi.mocked(generateTryon).mockRejectedValueOnce(new Error('NO IMAGE')).mockResolvedValue(PNG);
    await runOutfitsJob((await beginOutfits(id, ['Fall'], ['boho']))!);
    const failed = (await listOutfits(id)).find((o) => o.status === 'failed')!;
    vi.mocked(generateTryon).mockClear();
    expect((await retry(id, failed.id)).status).toBe(303);
    await vi.waitFor(async () => expect((await listOutfits(id)).every((o) => o.status === 'ready')).toBe(true));
    await retry(id, failed.id);
    expect(generateTryon).toHaveBeenCalledTimes(1);
  });

  it('reports progress and zips every ready picture', async () => {
    const id = await readyProfile();
    await made(id);
    const out = await (await listRoute({ params: { id } } as any)).json();
    expect(out.run.status).toBe('ready');
    expect(out.outfits).toHaveLength(10);
    const zip = await zipRoute({ params: { id } } as any);
    expect(Object.keys(unzipSync(new Uint8Array(await zip.arrayBuffer())))).toHaveLength(10);
  });
});
