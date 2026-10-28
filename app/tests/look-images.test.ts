import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { unzipSync } from 'fflate';

vi.mock('../src/lib/ai/tryon', async (orig) => ({ ...(await orig<any>()), generateTryon: vi.fn() }));
vi.mock('../src/lib/ai/gemini', () => ({ generateCharacterSheet: vi.fn() }));
vi.mock('../src/lib/ai/looks', () => ({ generateLooks: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, finishSheet, retrySheet, beginLooks, finishLooks, saveAnswers } from '../src/lib/profiles';
import { saveImage } from '../src/lib/storage';
import { generateTryon } from '../src/lib/ai/tryon';
import { generateCharacterSheet } from '../src/lib/ai/gemini';
import { generateLooks } from '../src/lib/ai/looks';
import { runLooksJob, runSheetJob, runLookImages } from '../src/lib/jobs';
import { listLookImages, lookImagePrompt } from '../src/lib/look-images';
import { DEMO_LOOKS } from '../src/lib/ai/demo-looks';
import { GET as imageRoute, POST as retryRoute } from '../src/pages/api/p/[id]/looks/[n]';
import { GET as zipRoute } from '../src/pages/api/p/[id]/looks/zip';
import { GET as statusRoute } from '../src/pages/api/p/[id]/status';

const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');

async function photoProfile() {
  const p = await createProfile('Ana');
  const attempt = await setPhoto(p.id, await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff])));
  return { id: p.id, attempt };
}
async function sheetReady() {
  const { id, attempt } = await photoProfile();
  await finishSheet(id, attempt, { path: await saveImage(id, 'sheet', PNG) });
  return id;
}
async function looksReady(id: string) {
  await finishLooks(id, await beginLooks(id), { looks: DEMO_LOOKS });
}
const current = async (id: string) => listLookImages((await getProfile(id))!);

beforeEach(async () => {
  await sql`truncate profiles cascade`;
  vi.mocked(generateTryon).mockReset();
  vi.mocked(generateCharacterSheet).mockReset();
  vi.mocked(generateLooks).mockReset();
});

describe('look image prompt', () => {
  it('dresses the character sheet in the look pieces', async () => {
    const id = await sheetReady();
    await saveAnswers(id, { goals: ['taller'] } as any);
    const prompt = lookImagePrompt((await getProfile(id))!, DEMO_LOOKS.looks[0]);
    expect(prompt).toContain('character sheet');
    for (const pc of DEMO_LOOKS.looks[0].pieces) expect(prompt).toContain(pc.item.toLowerCase());
    expect(prompt).toContain('read taller');
  });
});

describe('making the look images', () => {
  it('waits until the sheet is ready', async () => {
    const { id } = await photoProfile();
    await looksReady(id);
    await runLookImages(id);
    expect(await current(id)).toHaveLength(0);
    expect(generateTryon).not.toHaveBeenCalled();
  });

  it('makes one image per look on the character sheet', async () => {
    const id = await sheetReady();
    await looksReady(id);
    vi.mocked(generateTryon).mockResolvedValue(PNG);
    await runLookImages(id);
    const images = await current(id);
    expect(images).toHaveLength(10);
    expect(images.every((i) => i.status === 'ready' && existsSync(i.path!))).toBe(true);
    expect(generateTryon).toHaveBeenCalledTimes(10);
  });

  it('does not make them twice', async () => {
    const id = await sheetReady();
    await looksReady(id);
    vi.mocked(generateTryon).mockResolvedValue(PNG);
    await runLookImages(id);
    await runLookImages(id);
    expect(generateTryon).toHaveBeenCalledTimes(10);
  });

  it('stores a failed image with its error', async () => {
    const id = await sheetReady();
    await looksReady(id);
    vi.mocked(generateTryon).mockRejectedValueOnce(new Error('NO IMAGE')).mockResolvedValue(PNG);
    await runLookImages(id);
    const failed = (await current(id)).filter((i) => i.status === 'failed');
    expect(failed).toHaveLength(1);
    expect(failed[0].error).toBe('NO IMAGE');
  });

  it('a new sheet starts a fresh set', async () => {
    const id = await sheetReady();
    await looksReady(id);
    vi.mocked(generateTryon).mockResolvedValue(PNG);
    await runLookImages(id);
    await retrySheet(id);
    expect(await current(id)).toHaveLength(0);
  });

  it('finishing the looks starts the images', async () => {
    const id = await sheetReady();
    vi.mocked(generateLooks).mockResolvedValue(DEMO_LOOKS);
    vi.mocked(generateTryon).mockResolvedValue(PNG);
    await runLooksJob(id, await beginLooks(id));
    expect(await current(id)).toHaveLength(10);
  });

  it('finishing the sheet starts the images', async () => {
    const { id, attempt } = await photoProfile();
    await looksReady(id);
    vi.mocked(generateCharacterSheet).mockResolvedValue(PNG);
    vi.mocked(generateTryon).mockResolvedValue(PNG);
    await runSheetJob(id, attempt);
    expect(await current(id)).toHaveLength(10);
  });
});

describe('look image routes', () => {
  async function made(fail = false) {
    const id = await sheetReady();
    await looksReady(id);
    if (fail) vi.mocked(generateTryon).mockRejectedValue(new Error('NO IMAGE'));
    else vi.mocked(generateTryon).mockResolvedValue(PNG);
    await runLookImages(id);
    return id;
  }
  const get = (id: string, n: string, q = '') =>
    imageRoute({ params: { id, n }, url: new URL(`http://localhost/api/p/${id}/looks/${n}${q}`) } as any);
  const retry = (id: string, n: string) =>
    retryRoute({ params: { id, n }, request: new Request('http://localhost/', { method: 'POST' }) } as any);

  it('serves a ready image and a download', async () => {
    const id = await made();
    const res = await get(id, '1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    const dl = await get(id, '1', '?download=1');
    expect(dl.headers.get('Content-Disposition')).toContain('ana-look-01');
  });

  it('404s an image that is not there', async () => {
    const id = await made(true);
    expect((await get(id, '1')).status).toBe(404);
    expect((await get(id, '99')).status).toBe(404);
  });

  it('try again redoes only a failed image', async () => {
    const id = await made(true);
    vi.mocked(generateTryon).mockReset().mockResolvedValue(PNG);
    expect((await retry(id, '3')).status).toBe(303);
    await vi.waitFor(async () => expect((await current(id))[2].status).toBe('ready'));
    expect(generateTryon).toHaveBeenCalledTimes(1);
    await retry(id, '3');
    expect(generateTryon).toHaveBeenCalledTimes(1);
  });

  it('zips the ready images', async () => {
    const id = await made();
    const res = await zipRoute({ params: { id } } as any);
    expect(res.status).toBe(200);
    expect(Object.keys(unzipSync(new Uint8Array(await res.arrayBuffer())))).toHaveLength(10);
  });

  it('status reports each image', async () => {
    const id = await made();
    const out = await (await statusRoute({ params: { id } } as any)).json();
    expect(out.lookImages).toHaveLength(10);
    expect(out.lookImages[0].status).toBe('ready');
  });
});
