import { z } from 'zod';
import type { Profile } from './profiles';
import type { PhotoRead, SkinTone } from './ai/claude';

export const SKIN_SWATCHES: readonly { tone: SkinTone; hex: string }[] = [
  { tone: 1, hex: '#F6DCC7' }, { tone: 2, hex: '#EBC3A3' }, { tone: 3, hex: '#D9A57F' }, { tone: 4, hex: '#C08A62' },
  { tone: 5, hex: '#9C6A45' }, { tone: 6, hex: '#74482D' }, { tone: 7, hex: '#4A2D1C' },
];

export const COLOR_SWATCHES = [
  ['black', '#111111'], ['white', '#F5F5F2'], ['gray', '#8E8F90'], ['navy', '#24364F'], ['blue', '#4A6FA5'],
  ['green', '#4F6B3A'], ['olive', '#5B5F3F'], ['brown', '#6B4A33'], ['camel', '#B08A62'], ['red', '#9B2F2F'],
  ['pink', '#D9A0A8'], ['yellow', '#D9B44A'], ['purple', '#5E4A7A'], ['orange', '#C7682E'],
] as const;

const SHAPES = ['inverted-triangle', 'pear', 'hourglass', 'rectangle', 'apple'] as const;
const GOALS = ['taller', 'broader', 'streamline', 'balance-hips', 'show-waist', 'comfort'] as const;
const STYLES = ['classic', 'minimal', 'workwear', 'streetwear', 'preppy', 'boho', 'edgy', 'smart-casual'] as const;
const AVOID = ['tight', 'shorts', 'bold-patterns', 'sleeveless', 'shiny', 'none'] as const;
const OCCASIONS = ['date-night', 'travel', 'events', 'weekends'] as const;
const DRESS_CODES = ['casual', 'business-casual', 'formal', 'uniform', 'remote'] as const;
const BUDGETS = ['$', '$$', '$$$'] as const;
const COLORS = COLOR_SWATCHES.map(([c]) => c) as unknown as [string, ...string[]];

const text = (max: number) => z.string().trim().min(1).max(max);
/** A multi-select answer. A single string (saved before the question allowed several) reads as one pick. */
const picks = <T extends readonly [string, ...string[]]>(values: T, max?: number) => {
  const list = z.array(z.enum(values)).min(1);
  return z.preprocess((v) => (typeof v === 'string' ? [v] : v), max ? list.max(max) : list);
};

export const AnswersSchema = z.object({
  section: z.enum(['mens', 'womens', 'both']),
  height: text(20),
  topSize: text(20),
  bottomSize: text(20),
  shape: picks(SHAPES, 2),
  goals: z.array(z.enum(GOALS)).min(1),
  skinTone: z.coerce.number().int().min(1).max(7),
  veins: z.enum(['blue', 'green', 'unsure']),
  metal: z.enum(['silver', 'gold', 'both']),
  hair: text(30),
  eyes: text(30),
  styles: z.array(z.enum(STYLES)).min(1),
  loveColors: z.array(z.enum(COLORS)).optional(),
  avoidColors: z.array(z.enum(COLORS)).optional(),
  avoid: z.array(z.enum(AVOID)).min(1),
  dressCode: picks(DRESS_CODES),
  occasions: z.array(z.enum(OCCASIONS)).optional(),
  location: text(60),
  budget: picks(BUDGETS),
});
export type Answers = z.infer<typeof AnswersSchema>;
export type AnswerKey = keyof Answers;

export type Option = { value: string; label: string; hint?: string };
export type Field = {
  key: AnswerKey;
  kind: 'single' | 'multi' | 'text' | 'skin' | 'colors' | 'shape' | 'tiles';
  label?: string;
  placeholder?: string;
  options?: Option[];
  max?: number;
};
export type Question = { n: number; title: string; hint?: string; fields: Field[] };
export type Step = { n: 1 | 2 | 3 | 4; title: string; questions: Question[] };

const opts = (pairs: [string, string, string?][]): Option[] => pairs.map(([value, label, hint]) => ({ value, label, hint }));

export const STEPS: Step[] = [
  { n: 1, title: 'YOUR BODY', questions: [
    { n: 1, title: 'Which section do you usually shop?', fields: [
      { key: 'section', kind: 'single', options: opts([['mens', "Men's"], ['womens', "Women's"], ['both', 'Both']]) }] },
    { n: 2, title: 'Height and usual sizes', fields: [
      { key: 'height', kind: 'text', label: 'Height', placeholder: `5'10" or 178 cm` },
      { key: 'topSize', kind: 'text', label: 'Shirt size', placeholder: 'M, 40, 10' },
      { key: 'bottomSize', kind: 'text', label: 'Pant size', placeholder: '32x30, 8, M' }] },
    { n: 3, title: 'Which shape is closest to yours?', hint: 'Pick two if you are between shapes', fields: [
      { key: 'shape', kind: 'shape', max: 2, options: opts([
        ['inverted-triangle', 'Shoulders wider'], ['pear', 'Hips wider'], ['hourglass', 'Even, defined waist'],
        ['rectangle', 'Even and straight'], ['apple', 'Fuller middle']]) }] },
    { n: 4, title: 'What should your clothes do for you?', hint: 'Pick all that apply', fields: [
      { key: 'goals', kind: 'multi', options: opts([
        ['taller', 'Look taller'], ['broader', 'Look broader'], ['streamline', 'Streamline the middle'],
        ['balance-hips', 'Balance the hips'], ['show-waist', 'Show the waist'], ['comfort', 'Just feel comfortable']]) }] },
  ] },
  { n: 2, title: 'YOUR COLORING', questions: [
    { n: 5, title: 'Skin tone', fields: [{ key: 'skinTone', kind: 'skin' }] },
    { n: 6, title: 'Undertone check', fields: [
      { key: 'veins', kind: 'single', label: 'The veins on your wrist look', options: opts([['blue', 'Blue or purple'], ['green', 'Green'], ['unsure', "Can't tell"]]) },
      { key: 'metal', kind: 'single', label: 'Jewelry that looks better on you', options: opts([['silver', 'Silver'], ['gold', 'Gold'], ['both', 'Both']]) }] },
    { n: 7, title: 'Hair and eye color', fields: [
      { key: 'hair', kind: 'text', label: 'Hair', placeholder: 'salt and pepper' },
      { key: 'eyes', kind: 'text', label: 'Eyes', placeholder: 'brown' }] },
  ] },
  { n: 3, title: 'YOUR TASTE', questions: [
    { n: 8, title: 'Looks you like', hint: 'Pick all that apply', fields: [
      { key: 'styles', kind: 'tiles', options: opts([
        ['classic', 'Classic', 'Navy blazer, oxford, loafers'], ['minimal', 'Minimal', 'Clean lines, few colors'],
        ['workwear', 'Rugged / workwear', 'Chore coat, denim, boots'], ['streetwear', 'Streetwear', 'Hoodies, sneakers, relaxed'],
        ['preppy', 'Preppy', 'Polos, chinos, knits'], ['boho', 'Boho', 'Loose, layered, earthy'],
        ['edgy', 'Edgy', 'Leather, black, sharp'], ['smart-casual', 'Smart-casual', 'Knit polo, trousers, suede']]) }] },
    { n: 9, title: 'Colors you love or never wear', hint: 'Optional', fields: [
      { key: 'loveColors', kind: 'colors', label: 'Love' },
      { key: 'avoidColors', kind: 'colors', label: 'Never wear' }] },
    { n: 10, title: 'Anything you avoid?', fields: [
      { key: 'avoid', kind: 'multi', options: opts([
        ['tight', 'Tight fits'], ['shorts', 'Shorts'], ['bold-patterns', 'Bold patterns'],
        ['sleeveless', 'Sleeveless'], ['shiny', 'Shiny fabrics'], ['none', 'None']]) }] },
  ] },
  { n: 4, title: 'YOUR LIFE', questions: [
    { n: 11, title: 'What does your week look like?', fields: [
      { key: 'dressCode', kind: 'multi', label: 'Work dress code', options: opts([
        ['casual', 'Casual'], ['business-casual', 'Business casual'], ['formal', 'Formal'], ['uniform', 'Uniform'], ['remote', 'Remote']]) },
      { key: 'occasions', kind: 'multi', label: 'Outfits for', options: opts([
        ['date-night', 'Date night'], ['travel', 'Travel'], ['events', 'Events'], ['weekends', 'Weekends']]) }] },
    { n: 12, title: 'Climate and budget', fields: [
      { key: 'location', kind: 'text', label: 'City or ZIP', placeholder: 'Austin, TX' },
      { key: 'budget', kind: 'multi', label: 'Budget per piece', options: opts([
        ['$', '$ Under $60'], ['$$', '$$ $60 to $150'], ['$$$', '$$$ Over $150']]) }] },
  ] },
];

export const MULTI_KEYS = new Set<AnswerKey>(['shape', 'goals', 'styles', 'loveColors', 'avoidColors', 'avoid', 'occasions', 'dressCode', 'budget']);

export function stepFields(n: number): AnswerKey[] {
  return STEPS.find((s) => s.n === n)?.questions.flatMap((q) => q.fields.map((f) => f.key)) ?? [];
}

export function stepComplete(answers: Partial<Answers>, n: number): boolean {
  return stepFields(n).every((k) => AnswersSchema.shape[k].safeParse(answers[k]).success);
}

/** Parses one step's form: the fields that validated, and the keys that didn't. */
export function parseStep(n: number, form: FormData): { valid: Partial<Answers>; missing: AnswerKey[] } {
  const valid: Record<string, unknown> = {};
  const missing: AnswerKey[] = [];
  for (const key of stepFields(n)) {
    const raw = MULTI_KEYS.has(key) ? form.getAll(key).map(String) : form.get(key) ?? undefined;
    const r = AnswersSchema.shape[key].safeParse(raw);
    if (r.success) valid[key] = r.data;
    else missing.push(key);
  }
  return { valid: valid as Partial<Answers>, missing };
}

export function prefillFromRead(answers: Partial<Answers>, read: PhotoRead | null): Partial<Answers> {
  if (!read) return {};
  const out: Partial<Answers> = {};
  if (answers.skinTone === undefined) out.skinTone = read.skinTone;
  if (answers.hair === undefined) out.hair = read.hair;
  if (answers.eyes === undefined) out.eyes = read.eyes;
  return out;
}

export function nextPath(p: Profile): string {
  if (!p.photoPath) return `/p/${p.id}/photo`;
  const open = STEPS.find((s) => !stepComplete(p.answers, s.n));
  if (open) return `/p/${p.id}/q/${open.n}`;
  if (!p.sheetApproved) return `/p/${p.id}/sheet`;
  return `/p/${p.id}`;
}
