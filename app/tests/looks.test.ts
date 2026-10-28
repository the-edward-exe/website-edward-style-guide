import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/ai/looks', () => ({ generateLooks: vi.fn() }));
vi.mock('../src/lib/ai/gemini', () => ({ generateCharacterSheet: vi.fn(() => new Promise(() => {})) }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, saveAnswers, approveSheet, beginLooks, finishLooks } from '../src/lib/profiles';
import { saveImage } from '../src/lib/storage';
import { generateLooks } from '../src/lib/ai/looks';
import { runLooksJob } from '../src/lib/jobs';
import { LooksSchema, looksPrompt } from '../src/lib/looks';
import { DEMO_LOOKS } from '../src/lib/ai/demo-looks';
import { POST as answersRoute } from '../src/pages/api/p/[id]/answers';
import { POST as looksRoute } from '../src/pages/api/p/[id]/looks/index';
import { GET as statusRoute } from '../src/pages/api/p/[id]/status';

const FIRST_THREE = { section: 'mens', height: '6ft', topSize: 'M', bottomSize: '32', shape: ['pear'], goals: ['comfort'], skinTone: 5, metal: 'gold', hair: 'black', eyes: 'brown', styles: ['minimal', 'workwear'], avoid: ['none'] } as const;

async function photoProfile() {
  const p = await createProfile('Ana');
  await setPhoto(p.id, await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff])));
  return p.id;
}

const step4 = (id: string) => {
  const url = `/api/p/${id}/answers?step=4`;
  const body = new URLSearchParams([['dressCode', 'remote'], ['location', 'Austin'], ['budget', '$$']]);
  const request = new Request(`http://localhost${url}`, { method: 'POST', body, headers: { Accept: 'application/json' } });
  return answersRoute({ params: { id }, url: new URL(`http://localhost${url}`), request } as any);
};

beforeEach(async () => {
  await sql`truncate profiles cascade`;
  vi.mocked(generateLooks).mockReset();
});

describe('looks content', () => {
  it('the demo set is ten valid looks', () => {
    expect(LooksSchema.parse(DEMO_LOOKS).looks).toHaveLength(10);
  });

  it('the prompt names their skin tone and the looks they like', async () => {
    const id = await photoProfile();
    await saveAnswers(id, FIRST_THREE as any);
    const prompt = looksPrompt((await getProfile(id))!);
    expect(prompt).toContain('swatch 5 of 7');
    expect(prompt).toContain('Minimal, Rugged / workwear');
    expect(prompt).toContain('exactly 10');
  });
});

describe('looks job', () => {
  it('stores the looks', async () => {
    const id = await photoProfile();
    vi.mocked(generateLooks).mockResolvedValue(DEMO_LOOKS);
    await runLooksJob(id, await beginLooks(id));
    const p = await getProfile(id);
    expect(p?.looksStatus).toBe('ready');
    expect(p?.looks?.looks).toHaveLength(10);
  });

  it('stores the error message', async () => {
    const id = await photoProfile();
    vi.mocked(generateLooks).mockRejectedValue(new Error('overloaded'));
    await runLooksJob(id, await beginLooks(id));
    expect((await getProfile(id))?.looksError).toBe('overloaded');
  });

  it('drops looks from an older run', async () => {
    const id = await photoProfile();
    const first = await beginLooks(id);
    await beginLooks(id);
    vi.mocked(generateLooks).mockResolvedValue(DEMO_LOOKS);
    await runLooksJob(id, first);
    expect((await getProfile(id))?.looksStatus).toBe('pending');
  });
});

describe('starting the looks', () => {
  it('finishing the questionnaire starts them', async () => {
    const id = await photoProfile();
    await saveAnswers(id, FIRST_THREE as any);
    vi.mocked(generateLooks).mockReturnValue(new Promise(() => {}));
    await step4(id);
    const p = await getProfile(id);
    expect(p?.looksStatus).toBe('pending');
    expect(generateLooks).toHaveBeenCalledTimes(1);
  });

  it('an unfinished questionnaire does not', async () => {
    const id = await photoProfile();
    await step4(id);
    expect((await getProfile(id))?.looksStatus).toBe('none');
  });

  it('editing answers after the sheet is approved does not', async () => {
    const id = await photoProfile();
    await saveAnswers(id, FIRST_THREE as any);
    await approveSheet(id);
    await step4(id);
    expect((await getProfile(id))?.looksStatus).toBe('none');
  });

  it('the retry route starts a new run, but not over a pending one', async () => {
    const id = await photoProfile();
    vi.mocked(generateLooks).mockReturnValue(new Promise(() => {}));
    const attempt = await beginLooks(id);
    await finishLooks(id, attempt, { error: 'x' });
    const call = () => looksRoute({ params: { id }, request: new Request('http://localhost/', { method: 'POST' }) } as any);
    expect((await call()).status).toBe(303);
    await call();
    expect((await getProfile(id))?.looksAttempt).toBe(2);
  });

  it('status reports the looks', async () => {
    const id = await photoProfile();
    await beginLooks(id);
    const out = await (await statusRoute({ params: { id } } as any)).json();
    expect(out.looksStatus).toBe('pending');
  });
});

describe('changing your taste later', () => {
  const step3 = (id: string, pairs: [string, string][]) => {
    const url = `/api/p/${id}/answers?step=3`;
    const request = new Request(`http://localhost${url}`, { method: 'POST', body: new URLSearchParams(pairs), headers: { Accept: 'application/json' } });
    return answersRoute({ params: { id }, url: new URL(`http://localhost${url}`), request } as any);
  };
  const TASTE: [string, string][] = [['styles', 'minimal'], ['styles', 'workwear'], ['avoid', 'none']];

  it('new taste answers write new looks', async () => {
    const id = await photoProfile();
    await saveAnswers(id, FIRST_THREE as any);
    await finishLooks(id, await beginLooks(id), { looks: DEMO_LOOKS });
    vi.mocked(generateLooks).mockReturnValue(new Promise(() => {}));
    const out = await (await step3(id, [['styles', 'classic'], ['avoid', 'none']])).json();
    expect(out.ok).toBe(true);
    const p = await getProfile(id);
    expect(p?.looksStatus).toBe('pending');
    expect(p?.looksAttempt).toBe(2);
    expect(p?.answers.styles).toEqual(['classic']);
  });

  it('saving the same taste changes nothing', async () => {
    const id = await photoProfile();
    await saveAnswers(id, FIRST_THREE as any);
    await finishLooks(id, await beginLooks(id), { looks: DEMO_LOOKS });
    await step3(id, TASTE);
    expect((await getProfile(id))?.looksAttempt).toBe(1);
  });

  it('works after the sheet is approved', async () => {
    const id = await photoProfile();
    await saveAnswers(id, FIRST_THREE as any);
    await approveSheet(id);
    await finishLooks(id, await beginLooks(id), { looks: DEMO_LOOKS });
    vi.mocked(generateLooks).mockReturnValue(new Promise(() => {}));
    await step3(id, [['styles', 'classic'], ['avoid', 'none']]);
    expect((await getProfile(id))?.looksStatus).toBe('pending');
  });

  it('during the first questionnaire, step 3 does not write looks', async () => {
    const id = await photoProfile();
    await step3(id, TASTE);
    expect((await getProfile(id))?.looksStatus).toBe('none');
  });
});
