import { describe, it, expect, beforeEach, vi } from 'vitest';
import { profileNav } from '../src/lib/nav';
import { sql } from '../src/lib/db';
import { createProfile } from '../src/lib/profiles';
import { POST as stopRoute } from '../src/pages/api/p/[id]/stop';
import { POST as looksRoute } from '../src/pages/api/p/[id]/looks/index';

vi.mock('../src/lib/ai/looks', () => ({ generateLooks: vi.fn(() => new Promise(() => {})) }));

const ANSWERS = {
  section: 'mens', height: '6ft', topSize: 'M', bottomSize: '32', shape: ['pear'], goals: ['comfort'], skinTone: 5,
  metal: 'gold', hair: 'black', eyes: 'brown', styles: ['minimal'], avoid: ['none'],
  dressCode: ['remote'], location: 'Austin', budget: ['$$'],
};
const base = { id: 'abc', answers: {}, photoPath: null, sheetPath: null, sheetStatus: 'none', sheetApproved: false, guideStatus: 'none' };
const nav = (over: object, current?: any) => Object.fromEntries(profileNav({ ...base, ...over } as any, current).map((i) => [i.key, i]));
const withPhoto = { photoPath: '/x.jpg', sheetStatus: 'pending' };
const sheetReady = { ...withPhoto, answers: ANSWERS, sheetPath: '/s.png', sheetStatus: 'ready' };
const finished = { ...sheetReady, sheetApproved: true, guideStatus: 'ready' };

describe('profile navigation', () => {
  it('starts with the character sheet and ends with the Dressing Room', () => {
    const items = profileNav(base as any);
    expect(items.map((i) => i.key)).toEqual(['sheet', 'questions', 'guide', 'room', 'dressing']);
    expect(items.at(-1)!.label).toBe('Dressing Room');
  });

  it('the Dressing Room is one page', () => {
    expect(nav(finished).dressing.href).toBe('/p/abc/dressing');
  });

  it('a new profile starts on the character sheet page, where the photo goes, and the rest say why they are locked', () => {
    const n = nav({});
    expect(n.sheet).toMatchObject({ href: '/p/abc/sheet', next: true, locked: null });
    for (const key of ['questions', 'guide', 'room', 'dressing']) {
      expect(n[key].href).toBeNull();
      expect(n[key].locked).toBeTruthy();
    }
  });

  it('after the photo, the questions come next at the first unanswered step', () => {
    const n = nav({ ...withPhoto, answers: { section: 'mens', height: '6ft', topSize: 'M', bottomSize: '32', shape: ['pear'], goals: ['comfort'] } });
    expect(n.sheet).toMatchObject({ done: false, next: false });
    expect(n.questions).toMatchObject({ href: '/p/abc/q/2', next: true, done: false });
    expect(n.sheet.href).toBe('/p/abc/sheet');
    expect(n.dressing.href).toBeNull();
  });

  it('the Dressing Room opens with the answers, even while the sheet is still building', () => {
    expect(nav({ ...withPhoto, answers: ANSWERS }).dressing.href).toBe('/p/abc/dressing');
  });

  it('the guide stays locked until the sheet is approved', () => {
    const n = nav(sheetReady);
    expect(n.sheet.next).toBe(true);
    expect(n.guide.href).toBeNull();
  });

  it('Your Colors opens once the guide is written', () => {
    expect(nav(finished).room.label).toBe('Your Colors');
    expect(nav({ ...sheetReady, sheetApproved: true, guideStatus: 'pending' }).room.href).toBeNull();
    const n = nav(finished);
    expect(n.guide).toMatchObject({ href: '/p/abc', done: true });
    expect(n.room.href).toBe('/p/abc#room');
  });

  it('a finished profile has no next step, and answers can still be changed', () => {
    const n = nav(finished);
    expect(Object.values(n).some((i: any) => i.next)).toBe(false);
    expect(n.questions.href).toBe('/p/abc/q/1');
  });

  it('marks the current page', () => {
    const n = nav(finished, 'dressing');
    expect(n.dressing.current).toBe(true);
    expect(n.guide.current).toBe(false);
  });
});

describe('the Dressing Room holds the looks and the outfits', () => {
  beforeEach(async () => { await sql`truncate profiles cascade`; });

  it('stopping or retrying returns to the right part of it', async () => {
    const p = await createProfile('Ana');
    const req = (what: string) => new Request('http://localhost/', { method: 'POST', body: new URLSearchParams({ what }) });
    const stop = async (what: string) => (await stopRoute({ params: { id: p.id }, request: req(what) } as any)).headers.get('Location');
    expect(await stop('looks')).toBe(`/p/${p.id}/dressing#looks`);
    expect(await stop('outfits')).toBe(`/p/${p.id}/dressing#outfits`);
    expect((await looksRoute({ params: { id: p.id } } as any)).headers.get('Location')).toBe(`/p/${p.id}/dressing#looks`);
  });
});
