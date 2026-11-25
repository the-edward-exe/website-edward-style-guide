import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../src/lib/ai/guide', () => ({ generateGuide: vi.fn() }));

import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, setCapsuleOwned, beginGuide, finishGuide } from '../src/lib/profiles';
import { saveImage } from '../src/lib/storage';
import { generateGuide } from '../src/lib/ai/guide';
import { runGuideJob } from '../src/lib/jobs';
import { excludedItems, isExcluded, keepExcluded } from '../src/lib/capsule';
import { looksPrompt } from '../src/lib/looks';
import { outfitsPrompt, replacementPrompt, outfitSlots } from '../src/lib/outfits';
import { lookImagePrompt } from '../src/lib/look-images';
import { tryonPrompt } from '../src/lib/ai/tryon';
import { guidePrompt } from '../src/lib/guide';
import { DEMO_GUIDE } from '../src/lib/ai/demo-guide';

const guide = { capsule: [{ item: 'Navy wool overshirt', category: 'outer' }, { item: 'White tee', category: 'basics' }, { item: 'Chelsea boots', category: 'shoes' }] };
const profile = (owned: number[]) => ({ id: 'x', name: 'Ana', answers: { goals: [] }, photoRead: null, guide, capsuleOwned: owned }) as any;
const piece = (color: string, item: string) => ({ color, item, hex: '#000000', fabric: 'wool', search: '', stores: [] });

describe('ticked capsule pieces', () => {
  it('are read from the guide', () => {
    expect(excludedItems(profile([0, 2]))).toEqual(['Navy wool overshirt', 'Chelsea boots']);
    expect(excludedItems(profile([]))).toEqual([]);
    expect(excludedItems(profile([99]))).toEqual([]);
    expect(excludedItems({ capsuleOwned: [0], guide: null } as any)).toEqual([]);
  });

  it('match the same piece however it is worded, and not a different color', () => {
    const out = ['Navy wool overshirt', 'Chelsea boots'];
    expect(isExcluded(piece('Navy', 'Wool overshirt'), out)).toBe(true);
    expect(isExcluded(piece('Navy', 'Overshirt'), out)).toBe(true);
    expect(isExcluded(piece('Dark brown', 'Chelsea boots'), out)).toBe(true);
    expect(isExcluded(piece('Camel', 'Wool overshirt'), out)).toBe(false);
    expect(isExcluded(piece('Navy', 'Wool trousers'), out)).toBe(false);
  });

  it('are ruled out of every outfit writing prompt', () => {
    const p = profile([0]);
    for (const prompt of [
      looksPrompt(p), outfitsPrompt(p, outfitSlots(['Fall'], ['Classic']), []),
      replacementPrompt(p, { style: 'Classic' }, [], 'Old'), guidePrompt(p),
    ]) expect(prompt).toContain('Navy wool overshirt');
    expect(looksPrompt(profile([]))).not.toContain('Navy wool overshirt');
  });

  it('are taken out of the picture prompts', () => {
    const pieces = [piece('Navy', 'Wool overshirt'), piece('Stone', 'Chinos'), piece('Brown', 'Loafers')];
    for (const prompt of [lookImagePrompt(profile([0]), { pieces }), tryonPrompt(profile([0]), { pieces, setting: 'a street' } as any)]) {
      expect(prompt).toContain('stone chinos');
      expect(prompt).not.toContain('navy wool overshirt (');
      expect(prompt).not.toContain('navy wool overshirt;');
      expect(prompt).toContain('Do not show');
      expect(prompt).toContain('Navy wool overshirt');
    }
    const plain = lookImagePrompt(profile([]), { pieces });
    expect(plain).toContain('navy wool overshirt');
    expect(plain).not.toContain('Do not show');
  });

  it('still give a usable picture prompt when every piece is ruled out', () => {
    const prompt = lookImagePrompt(profile([0]), { pieces: [piece('Navy', 'Wool overshirt')] });
    expect(prompt).not.toContain('wearing this outfit: .');
  });
});

describe('rewriting the guide', () => {
  it('keeps ticked pieces in the capsule and re-points the ticks', () => {
    const next = { capsule: [{ item: 'Grey hoodie', category: 'basics' }, { item: 'chelsea boots', category: 'shoes' }] } as any;
    const out = keepExcluded(next, ['Navy wool overshirt', 'Chelsea boots']);
    expect(out.guide.capsule.map((c) => c.item)).toEqual(['Grey hoodie', 'chelsea boots', 'Navy wool overshirt']);
    expect(out.owned).toEqual([1, 2]);
  });

  beforeEach(async () => { await sql`truncate profiles cascade`; vi.mocked(generateGuide).mockReset(); });

  it('a rewrite does not move the ticks onto other pieces', async () => {
    const p = await createProfile('Ana');
    await setPhoto(p.id, await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8, 0xff])));
    await finishGuide(p.id, await beginGuide(p.id), { guide: DEMO_GUIDE });
    await setCapsuleOwned(p.id, [1]);
    const ticked = DEMO_GUIDE.capsule[1].item;
    const reordered = { ...DEMO_GUIDE, capsule: [...DEMO_GUIDE.capsule].reverse() };
    vi.mocked(generateGuide).mockResolvedValue(reordered);
    await runGuideJob(p.id, await beginGuide(p.id));
    const after = (await getProfile(p.id))!;
    expect(after.guideStatus).toBe('ready');
    expect(excludedItems(after)).toEqual([ticked]);
  });
});
