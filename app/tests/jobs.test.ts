import { describe, it, expect, beforeEach, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';

vi.mock('../src/lib/ai/gemini', () => ({ generateCharacterSheet: vi.fn() }));
vi.mock('../src/lib/ai/claude', () => ({ readPhoto: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, deleteProfile } from '../src/lib/profiles';
import { saveImage, profileDir, removeProfileFiles } from '../src/lib/storage';
import { generateCharacterSheet } from '../src/lib/ai/gemini';
import { readPhoto } from '../src/lib/ai/claude';
import { runSheetJob, runPhotoReadJob } from '../src/lib/jobs';
import { aiMode } from '../src/lib/ai/mode';

const PNG = Buffer.from('89504e470d0a1a0a0000', 'hex');

async function profileWithPhoto() {
  const p = await createProfile('Ana');
  const path = await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff]));
  const attempt = await setPhoto(p.id, path);
  return { id: p.id, attempt };
}

beforeEach(async () => {
  await sql`truncate profiles`;
  vi.mocked(generateCharacterSheet).mockReset();
  vi.mocked(readPhoto).mockReset();
});

describe('sheet job', () => {
  it('saves the sheet and marks it ready', async () => {
    const { id, attempt } = await profileWithPhoto();
    vi.mocked(generateCharacterSheet).mockResolvedValue(PNG);
    await runSheetJob(id, attempt);
    const p = await getProfile(id);
    expect(p?.sheetStatus).toBe('ready');
    expect(existsSync(p!.sheetPath!)).toBe(true);
  });

  it('records the error when generation fails', async () => {
    const { id, attempt } = await profileWithPhoto();
    vi.mocked(generateCharacterSheet).mockRejectedValue(new Error('quota'));
    await runSheetJob(id, attempt);
    const p = await getProfile(id);
    expect(p?.sheetStatus).toBe('failed');
    expect(p?.sheetError).toBe('quota');
  });

  it('drops a result from an older photo', async () => {
    const { id, attempt: first } = await profileWithPhoto();
    let release!: (b: Buffer) => void;
    vi.mocked(generateCharacterSheet).mockReturnValueOnce(new Promise((r) => { release = r; }));
    const slow = runSheetJob(id, first);

    const second = await setPhoto(id, (await getProfile(id))!.photoPath!);
    vi.mocked(generateCharacterSheet).mockResolvedValueOnce(PNG);
    await runSheetJob(id, second);
    const newest = (await getProfile(id))!.sheetPath;

    release(PNG);
    await slow;
    expect((await getProfile(id))!.sheetPath).toBe(newest);
    const sheets = (await readdir(profileDir(id))).filter((f) => f.startsWith('sheet-'));
    expect(sheets).toHaveLength(1);
  });

  it('does nothing when the profile is deleted mid-flight', async () => {
    const { id, attempt } = await profileWithPhoto();
    let release!: (b: Buffer) => void;
    vi.mocked(generateCharacterSheet).mockReturnValueOnce(new Promise((r) => { release = r; }));
    const job = runSheetJob(id, attempt);
    await deleteProfile(id);
    await removeProfileFiles(id);
    release(PNG);
    await expect(job).resolves.toBeUndefined();
    expect(existsSync(profileDir(id))).toBe(false);
  });
});

describe('photo read job', () => {
  it('stores the read', async () => {
    const { id, attempt } = await profileWithPhoto();
    vi.mocked(readPhoto).mockResolvedValue({ skinTone: 4, hair: 'black', eyes: 'brown' });
    await runPhotoReadJob(id, attempt);
    const p = await getProfile(id);
    expect(p?.photoReadStatus).toBe('ready');
    expect(p?.photoRead).toEqual({ skinTone: 4, hair: 'black', eyes: 'brown' });
  });

  it('marks failed when the read throws', async () => {
    const { id, attempt } = await profileWithPhoto();
    vi.mocked(readPhoto).mockRejectedValue(new Error('refused'));
    await runPhotoReadJob(id, attempt);
    expect((await getProfile(id))?.photoReadStatus).toBe('failed');
  });
});

describe('aiMode', () => {
  it('is demo when keys are empty', () => {
    expect(aiMode()).toEqual({ gemini: 'demo', claude: 'demo' });
  });
});
