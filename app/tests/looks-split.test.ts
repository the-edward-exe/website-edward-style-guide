import { describe, it, expect, beforeAll } from 'vitest';
import { styleSplit, looksPrompt, looksSchemaFor, matchesSplit, orderBySplit } from '../src/lib/looks';
import { generateLooks } from '../src/lib/ai/looks';
import { DEMO_LOOKS } from '../src/lib/ai/demo-looks';

const profile = (styles: string[]) => ({ id: 'x', name: 'Ana', answers: { skinTone: 4, styles }, photoRead: null }) as any;
const counts = (looks: { style: string }[]) => looks.reduce<Record<string, number>>((m, l) => ({ ...m, [l.style]: (m[l.style] ?? 0) + 1 }), {});

beforeAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  process.env.DEMO_DELAY_MS = '0';
});

describe('splitting the ten looks across tastes', () => {
  it('one taste gets all ten', () => {
    expect(styleSplit(['minimal'])).toEqual([{ style: 'Minimal', count: 10 }]);
  });

  it('three tastes split 4, 3, 3 in the order picked', () => {
    expect(styleSplit(['classic', 'minimal', 'workwear']).map((s) => s.count)).toEqual([4, 3, 3]);
    expect(styleSplit(['classic', 'minimal', 'workwear'])[2].style).toBe('Rugged / workwear');
  });

  it('every taste gets at least one and the total is always ten', () => {
    const all = ['classic', 'minimal', 'workwear', 'streetwear', 'preppy', 'boho', 'edgy', 'smart-casual'];
    for (let n = 1; n <= all.length; n++) {
      const split = styleSplit(all.slice(0, n));
      expect(split).toHaveLength(n);
      expect(split.every((s) => s.count >= 1)).toBe(true);
      expect(split.reduce((t, s) => t + s.count, 0)).toBe(10);
    }
  });

  it('the prompt gives Claude the exact count for each taste', () => {
    const prompt = looksPrompt(profile(['classic', 'edgy']));
    expect(prompt).toContain('5 Classic');
    expect(prompt).toContain('5 Edgy');
  });

  it('only the chosen tastes are allowed, and never more than ten looks', () => {
    const schema = looksSchemaFor(styleSplit(['classic', 'edgy']));
    const ok = { looks: DEMO_LOOKS.looks.map((l, i) => ({ ...l, style: i < 5 ? 'Classic' : 'Edgy' })) };
    expect(schema.safeParse(ok).success).toBe(true);
    expect(schema.safeParse({ looks: ok.looks.map((l) => ({ ...l, style: 'Boho' })) }).success).toBe(false);
    expect(schema.safeParse({ looks: [...ok.looks, ok.looks[0]] }).success).toBe(false);
  });

  it('checks the split and groups the cards by taste', () => {
    const split = styleSplit(['classic', 'edgy']);
    const mixed = DEMO_LOOKS.looks.map((l, i) => ({ ...l, style: i % 2 ? 'Classic' : 'Edgy' }));
    expect(matchesSplit(mixed, split)).toBe(true);
    expect(orderBySplit(mixed, split).map((l) => l.style)).toEqual([...Array(5).fill('Classic'), ...Array(5).fill('Edgy')]);
    expect(matchesSplit(mixed.map((l) => ({ ...l, style: 'Classic' })), split)).toBe(false);
  });

  it('demo looks follow the split too', async () => {
    const out = await generateLooks(profile(['classic', 'minimal', 'workwear']), Buffer.from([]));
    expect(out.looks).toHaveLength(10);
    expect(counts(out.looks)).toEqual({ Classic: 4, Minimal: 3, 'Rugged / workwear': 3 });
  });
});
