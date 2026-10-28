import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/ai/gemini', () => ({ generateCharacterSheet: vi.fn() }));
vi.mock('../src/lib/ai/claude', () => ({ readPhoto: vi.fn(() => new Promise(() => {})) }));
vi.mock('../src/lib/ai/looks', () => ({ generateLooks: vi.fn() }));
vi.mock('../src/lib/ai/guide', () => ({ generateGuide: vi.fn() }));
vi.mock('../src/lib/ai/tryon', async (orig) => ({ ...(await orig<any>()), generateTryon: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, finishSheet, retrySheet, beginLooks, finishLooks, beginGuide, approveSheet } from '../src/lib/profiles';
import { saveImage } from '../src/lib/storage';
import { createTryon, getTryon } from '../src/lib/tryons';
import { generateCharacterSheet } from '../src/lib/ai/gemini';
import { generateLooks } from '../src/lib/ai/looks';
import { generateGuide } from '../src/lib/ai/guide';
import { generateTryon } from '../src/lib/ai/tryon';
import { runSheetJob, runLooksJob, runLookImages, runGuideJob, runTryonJob } from '../src/lib/jobs';
import { listLookImages } from '../src/lib/look-images';
import { STOPPED } from '../src/lib/stop';
import { DEMO_LOOKS } from '../src/lib/ai/demo-looks';
import { POST as stopRoute } from '../src/pages/api/p/[id]/stop';

const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');

/** A model call that only ends when it is aborted, like a real one cut off mid-flight. */
const untilAborted = (...args: any[]) => new Promise<never>((_, reject) => {
  const signal: AbortSignal = args[args.length - 1];
  signal.addEventListener('abort', () => reject(new Error('This operation was aborted')));
});

async function photoProfile() {
  const p = await createProfile('Ana');
  const attempt = await setPhoto(p.id, await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff])));
  return { id: p.id, attempt };
}

function stop(id: string, what: string, extra: Record<string, string> = {}, json = false) {
  const body = new URLSearchParams({ what, ...extra });
  const headers: Record<string, string> = json ? { Accept: 'application/json' } : {};
  return stopRoute({ params: { id }, request: new Request('http://localhost/', { method: 'POST', body, headers }) } as any);
}

beforeEach(async () => {
  await sql`truncate profiles cascade`;
  for (const f of [generateCharacterSheet, generateLooks, generateGuide, generateTryon]) vi.mocked(f as any).mockReset();
});

describe('stopping the character sheet', () => {
  it('cancels the call and marks it stopped', async () => {
    const { id, attempt } = await photoProfile();
    vi.mocked(generateCharacterSheet).mockImplementation(untilAborted);
    const job = runSheetJob(id, attempt);
    await vi.waitFor(() => expect(generateCharacterSheet).toHaveBeenCalled());
    expect((await stop(id, 'sheet')).status).toBe(303);
    await job;
    const p = await getProfile(id);
    expect(p?.sheetStatus).toBe('failed');
    expect(p?.sheetError).toBe(STOPPED);
  });

  it('drops a result that lands after stopping', async () => {
    const { id, attempt } = await photoProfile();
    let finish!: (b: Buffer) => void;
    vi.mocked(generateCharacterSheet).mockReturnValue(new Promise((r) => { finish = r; }));
    const job = runSheetJob(id, attempt);
    await vi.waitFor(() => expect(generateCharacterSheet).toHaveBeenCalled());
    await stop(id, 'sheet');
    finish(PNG);
    await job;
    const p = await getProfile(id);
    expect(p?.sheetError).toBe(STOPPED);
    expect(p?.sheetPath).toBeNull();
  });

  it('try again works after stopping', async () => {
    const { id } = await photoProfile();
    await stop(id, 'sheet');
    vi.mocked(generateCharacterSheet).mockResolvedValue(PNG);
    await runSheetJob(id, await retrySheet(id));
    expect((await getProfile(id))?.sheetStatus).toBe('ready');
  });
});

describe('stopping the looks', () => {
  it('cancels the written looks', async () => {
    const { id } = await photoProfile();
    vi.mocked(generateLooks).mockImplementation(untilAborted);
    const job = runLooksJob(id, await beginLooks(id));
    await vi.waitFor(() => expect(generateLooks).toHaveBeenCalled());
    await stop(id, 'looks');
    await job;
    expect((await getProfile(id))?.looksError).toBe(STOPPED);
  });

  it('stops the pictures still to come and keeps the finished ones', async () => {
    const { id, attempt } = await photoProfile();
    await finishSheet(id, attempt, { path: await saveImage(id, 'sheet', PNG) });
    await finishLooks(id, await beginLooks(id), { looks: DEMO_LOOKS });
    let calls = 0;
    vi.mocked(generateTryon).mockImplementation((...args: any[]) => (++calls <= 3 ? Promise.resolve(PNG) : untilAborted(...args)));
    const job = runLookImages(id);
    await vi.waitFor(() => expect(calls).toBeGreaterThan(3));
    await stop(id, 'looks');
    await job;
    const images = await listLookImages((await getProfile(id))!);
    expect(images.filter((i) => i.status === 'ready')).toHaveLength(3);
    expect(images.filter((i) => i.status === 'failed').every((i) => i.error === STOPPED)).toBe(true);
    expect(images.some((i) => i.status === 'pending')).toBe(false);
    expect(calls).toBeLessThanOrEqual(6);
  });
});

describe('stopping the guide and try-ons', () => {
  it('cancels the guide', async () => {
    const { id } = await photoProfile();
    await approveSheet(id);
    vi.mocked(generateGuide).mockImplementation(untilAborted);
    const job = runGuideJob(id, await beginGuide(id));
    await vi.waitFor(() => expect(generateGuide).toHaveBeenCalled());
    const res = await stop(id, 'guide');
    expect(res.headers.get('Location')).toBe(`/p/${id}`);
    await job;
    expect((await getProfile(id))?.guideError).toBe(STOPPED);
  });

  it('cancels one try-on and answers JSON', async () => {
    const { id, attempt } = await photoProfile();
    await finishSheet(id, attempt, { path: await saveImage(id, 'sheet', PNG) });
    const t = await createTryon(id, 'o1', 'prompt');
    vi.mocked(generateTryon).mockImplementation(untilAborted);
    const job = runTryonJob(t.id);
    await vi.waitFor(() => expect(generateTryon).toHaveBeenCalled());
    const res = await stop(id, 'tryon', { tryon: t.id }, true);
    expect(await res.json()).toEqual({ ok: true });
    await job;
    const after = await getTryon(t.id);
    expect(after?.status).toBe('failed');
    expect(after?.error).toBe(STOPPED);
  });

  it('will not stop another profile’s try-on', async () => {
    const { id, attempt } = await photoProfile();
    await finishSheet(id, attempt, { path: await saveImage(id, 'sheet', PNG) });
    const t = await createTryon(id, 'o1', 'prompt');
    const other = await createProfile('Bo');
    await stop(other.id, 'tryon', { tryon: t.id });
    expect((await getTryon(t.id))?.status).toBe('pending');
  });

  it('rejects an unknown kind', async () => {
    const { id } = await photoProfile();
    expect((await stop(id, 'everything')).status).toBe(400);
  });
});

describe('deleting a profile', () => {
  it('stops what it was generating and leaves no files behind', async () => {
    const { existsSync } = await import('node:fs');
    const { profileDir } = await import('../src/lib/storage');
    const { POST: deleteRoute } = await import('../src/pages/api/p/[id]/delete');
    const { id, attempt } = await photoProfile();
    vi.mocked(generateCharacterSheet).mockImplementation(untilAborted);
    const job = runSheetJob(id, attempt);
    await vi.waitFor(() => expect(generateCharacterSheet).toHaveBeenCalled());
    const res = await deleteRoute({ params: { id }, request: new Request('http://localhost/', { method: 'POST', body: new URLSearchParams({ confirm: 'DELETE' }) }) } as any);
    expect(res.status).toBe(303);
    await job;
    const signal = vi.mocked(generateCharacterSheet).mock.calls[0][1] as AbortSignal;
    expect(signal.aborted).toBe(true);
    expect(await getProfile(id)).toBeNull();
    expect(existsSync(profileDir(id))).toBe(false);
  });
});
