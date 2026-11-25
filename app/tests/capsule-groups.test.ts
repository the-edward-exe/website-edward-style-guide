import { describe, it, expect } from 'vitest';
import { capsuleGroup, groupCapsule } from '../src/lib/capsule';

const piece = (category: string, item = 'thing') => ({ category, item });

describe('capsuleGroup', () => {
  it('puts upper-body categories under tops', () => {
    for (const c of ['outer', 'outerwear', 'tailoring', 'shirts', 'basics', 'knits', 'dresses', 'Tops']) {
      expect(capsuleGroup(piece(c)), c).toBe('tops');
    }
  });

  it('sorts bottoms, shoes and accessories by category', () => {
    expect(capsuleGroup(piece('bottoms'))).toBe('bottoms');
    expect(capsuleGroup(piece('Trousers'))).toBe('bottoms');
    expect(capsuleGroup(piece('skirts'))).toBe('bottoms');
    expect(capsuleGroup(piece('shoes'))).toBe('shoes');
    expect(capsuleGroup(piece('footwear'))).toBe('shoes');
    expect(capsuleGroup(piece('accessories'))).toBe('accessories');
    expect(capsuleGroup(piece('bags'))).toBe('accessories');
    expect(capsuleGroup(piece('jewelry'))).toBe('accessories');
  });

  it('reads the item name when the category says nothing', () => {
    expect(capsuleGroup(piece('basics', 'White straight jeans'))).toBe('bottoms');
    expect(capsuleGroup(piece('basics', 'Black chukka boots'))).toBe('shoes');
    expect(capsuleGroup(piece('essentials', 'Brown leather belt'))).toBe('accessories');
    expect(capsuleGroup(piece('essentials', 'Navy merino sweater'))).toBe('tops');
  });

  it('trusts a clear category over the item name', () => {
    expect(capsuleGroup(piece('outer', 'Navy cotton overshirt'))).toBe('tops');
    expect(capsuleGroup(piece('accessories', 'Silver chain and watch'))).toBe('accessories');
  });
});

describe('groupCapsule', () => {
  it('keeps each piece’s place in the list and drops empty groups', () => {
    const groups = groupCapsule([piece('shoes', 'Sneakers'), piece('knits', 'Crew'), piece('bottoms', 'Jeans'), piece('shirts', 'Oxford')]);
    expect(groups.map((g) => g.label)).toEqual(['Tops', 'Bottoms', 'Shoes']);
    expect(groups[0].pieces.map((p) => [p.index, p.item])).toEqual([[1, 'Crew'], [3, 'Oxford']]);
    expect(groups[2].pieces.map((p) => p.index)).toEqual([0]);
  });
});
