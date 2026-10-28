import { describe, it, expect } from 'vitest';
import { STEPS, AnswersSchema } from '../src/lib/questionnaire';
import { looksPrompt } from '../src/lib/looks';
import { guidePrompt } from '../src/lib/guide';

const profile = { id: 'x', name: 'Ana', answers: { skinTone: 4, metal: 'gold', veins: 'green' }, photoRead: null } as any;

describe('the wrist veins question is gone', () => {
  it('is not asked', () => {
    const keys = STEPS.flatMap((s) => s.questions.flatMap((q) => q.fields.map((f) => f.key as string)));
    expect(keys).not.toContain('veins');
    expect(keys).toContain('metal');
  });

  it('is not in the answers', () => {
    expect(Object.keys(AnswersSchema.shape)).not.toContain('veins');
  });

  it('is not sent to Claude, even from an old saved answer', () => {
    expect(looksPrompt(profile)).not.toMatch(/vein/i);
    expect(guidePrompt(profile)).not.toMatch(/vein/i);
  });
});
