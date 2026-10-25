import { describe, it, expect } from 'vitest';
import { GuideSchema, guidePrompt } from '../src/lib/guide';
import { STORES, STORE_IDS } from '../src/lib/stores';
import { DEMO_GUIDE } from '../src/lib/ai/demo-guide';
import type { Profile } from '../src/lib/profiles';

const profile = (answers: object): Profile => ({
  id: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'Ana', createdAt: new Date(), answers: answers as any,
  photoPath: '/x.jpg', photoRead: null, photoReadStatus: 'ready', sheetPath: '/s.png', sheetStatus: 'ready',
  sheetError: null, sheetApproved: true, attempt: 1,
  guide: null, guideStatus: 'none', guideError: null, guideAttempt: 0, capsuleOwned: [],
});

describe('guide schema', () => {
  it('accepts the demo guide', () => {
    expect(GuideSchema.safeParse(DEMO_GUIDE).success).toBe(true);
    expect(DEMO_GUIDE.outfits).toHaveLength(12);
  });

  it('rejects an unknown store and a non-hex color', () => {
    const bad = structuredClone(DEMO_GUIDE);
    bad.outfits[0].pieces[0].stores = ['nowhere' as any];
    expect(GuideSchema.safeParse(bad).success).toBe(false);
    const bad2 = structuredClone(DEMO_GUIDE);
    bad2.outfits[0].pieces[0].hex = 'tan';
    expect(GuideSchema.safeParse(bad2).success).toBe(false);
  });
});

describe('guidePrompt', () => {
  it('uses labels, budget and only stores for their section', () => {
    const text = guidePrompt(profile({ section: 'womens', shape: 'pear', budget: '$$', goals: ['balance-hips'], skinTone: 3 }));
    expect(text).toContain('Hips wider');
    expect(text).toContain('Balance the hips');
    expect(text).toContain('$60 to $150');
    const mensOnly = STORE_IDS.filter((s) => !STORES[s].sections.includes('womens'));
    for (const s of mensOnly) expect(text).not.toContain(`${s}:`);
    expect(text).toContain('aritzia:');
  });
});
