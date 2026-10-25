import { describe, it, expect } from 'vitest';
import { AnswersSchema, prefillFromRead, nextPath, stepComplete, STEPS, SKIN_SWATCHES } from '../src/lib/questionnaire';
import type { Profile } from '../src/lib/profiles';

const base: Profile = {
  id: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'Ana', createdAt: new Date(), answers: {},
  photoPath: '/x.jpg', photoRead: null, photoReadStatus: 'ready', sheetPath: null,
  sheetStatus: 'pending', sheetError: null, sheetApproved: false, attempt: 1,
};
const step1 = { section: 'womens', height: `5'6"`, topSize: 'M', bottomSize: '8', shape: 'pear', goals: ['balance-hips'] } as const;
const step2 = { skinTone: 3, veins: 'green', metal: 'gold', hair: 'dark brown', eyes: 'brown' } as const;

describe('questionnaire', () => {
  it('has four steps and seven skin swatches', () => {
    expect(STEPS.map((s) => s.title)).toEqual(['YOUR BODY', 'YOUR COLORING', 'YOUR TASTE', 'YOUR LIFE']);
    expect(SKIN_SWATCHES.map((s) => s.hex)).toEqual(['#F6DCC7', '#EBC3A3', '#D9A57F', '#C08A62', '#9C6A45', '#74482D', '#4A2D1C']);
  });

  it('allows at most two goals', () => {
    expect(AnswersSchema.pick({ goals: true }).safeParse({ goals: ['taller', 'broader', 'comfort'] }).success).toBe(false);
  });

  it('never overwrites coloring answers already given', () => {
    expect(prefillFromRead({ skinTone: 2 }, { skinTone: 5, hair: 'black', eyes: 'brown' })).toEqual({ hair: 'black', eyes: 'brown' });
  });

  it('prefills nothing without a read', () => {
    expect(prefillFromRead({}, null)).toEqual({});
  });

  it('knows when a step is incomplete', () => {
    expect(stepComplete({ ...step1, goals: undefined }, 1)).toBe(false);
    expect(stepComplete(step1, 1)).toBe(true);
  });

  it('routes to the first incomplete step', () => {
    expect(nextPath({ ...base, answers: { ...step1, ...step2 } })).toBe(`/p/${base.id}/q/3`);
    expect(nextPath({ ...base, photoPath: null })).toBe(`/p/${base.id}/photo`);
  });
});

describe('parseStep', () => {
  it('keeps valid fields and reports missing ones', async () => {
    const { parseStep } = await import('../src/lib/questionnaire');
    const form = new FormData();
    form.append('section', 'mens');
    form.append('goals', 'taller');
    form.append('goals', 'comfort');
    const { valid, missing } = parseStep(1, form);
    expect(valid).toEqual({ section: 'mens', goals: ['taller', 'comfort'] });
    expect(missing).toEqual(['height', 'topSize', 'bottomSize', 'shape']);
  });
});
