import { describe, it, expect } from 'vitest';
import { AnswersSchema, parseStep, MULTI_KEYS } from '../src/lib/questionnaire';
import { storesFor, STORES } from '../src/lib/stores';

const ok = (k: keyof typeof AnswersSchema.shape, v: unknown) => AnswersSchema.shape[k].safeParse(v).success;

describe('multiple selections', () => {
  it('goals and looks have no cap', () => {
    expect(ok('goals', ['taller', 'broader', 'streamline', 'comfort'])).toBe(true);
    expect(ok('styles', ['classic', 'minimal', 'workwear', 'preppy', 'edgy'])).toBe(true);
  });

  it('shape allows up to two', () => {
    expect(ok('shape', ['pear', 'hourglass'])).toBe(true);
    expect(ok('shape', ['pear', 'hourglass', 'apple'])).toBe(false);
  });

  it('dress code and budget take several picks', () => {
    expect(ok('dressCode', ['remote', 'business-casual'])).toBe(true);
    expect(ok('budget', ['$', '$$'])).toBe(true);
  });

  it('answers saved before this change still read as one pick', () => {
    expect(AnswersSchema.shape.budget.parse('$$')).toEqual(['$$']);
    expect(AnswersSchema.shape.shape.parse('pear')).toEqual(['pear']);
    expect(AnswersSchema.shape.dressCode.parse('remote')).toEqual(['remote']);
  });

  it('the form sends every checked box', () => {
    expect(['shape', 'dressCode', 'budget'].every((k) => MULTI_KEYS.has(k as any))).toBe(true);
    const form = new FormData();
    for (const [k, v] of [['dressCode', 'remote'], ['dressCode', 'formal'], ['location', 'Austin'], ['budget', '$'], ['budget', '$$$']]) form.append(k, v);
    expect(parseStep(4, form).valid).toMatchObject({ dressCode: ['remote', 'formal'], budget: ['$', '$$$'] });
  });

  it('store suggestions reach the highest budget picked', () => {
    const ids = storesFor('mens', ['$', '$$$']);
    expect(ids.some((id) => STORES[id].tier === '$$$')).toBe(true);
    expect(storesFor('mens', '$').some((id) => STORES[id].tier === '$$$')).toBe(false);
  });
});
