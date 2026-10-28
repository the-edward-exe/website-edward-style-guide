import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto, saveAnswers } from '../src/lib/profiles';
import { POST as createRoute } from '../src/pages/api/profiles';
import { POST as answersRoute } from '../src/pages/api/p/[id]/answers';

beforeEach(async () => { await sql`truncate profiles cascade`; });

const jsonForm = (url: string, fields: [string, string][]) => {
  const body = new URLSearchParams(fields);
  return new Request(`http://localhost${url}`, { method: 'POST', body, headers: { Accept: 'application/json' } });
};

describe('home page JSON calls', () => {
  it('creates a profile and returns its id', async () => {
    const res = await createRoute({ request: jsonForm('/api/profiles', [['name', 'Ana']]) } as any);
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.ok).toBe(true);
    expect((await getProfile(out.id))?.name).toBe('Ana');
  });


  it('saves a step and lists what is missing', async () => {
    const p = await createProfile('Ana');
    await setPhoto(p.id, '/x.jpg');
    const url = `/api/p/${p.id}/answers?step=1`;
    const res = await answersRoute({ params: { id: p.id }, url: new URL(`http://localhost${url}`), request: jsonForm(url, [['section', 'mens']]) } as any);
    expect(await res.json()).toEqual({ ok: false, missing: ['name', 'height', 'topSize', 'bottomSize', 'shape', 'goals'] });
    expect((await getProfile(p.id))?.answers).toEqual({ section: 'mens' });
  });

  it('says where to go after the last step', async () => {
    const p = await createProfile('Ana');
    await setPhoto(p.id, '/x.jpg');
    await saveAnswers(p.id, { section: 'mens', height: '6ft', topSize: 'M', bottomSize: '32', shape: 'pear', goals: ['comfort'], skinTone: 3, metal: 'gold', hair: 'brown', eyes: 'brown', styles: ['minimal'], avoid: ['none'] });
    const url = `/api/p/${p.id}/answers?step=4`;
    const fields: [string, string][] = [['dressCode', 'remote'], ['location', 'Austin'], ['budget', '$$']];
    const res = await answersRoute({ params: { id: p.id }, url: new URL(`http://localhost${url}`), request: jsonForm(url, fields) } as any);
    expect(await res.json()).toEqual({ ok: true, next: `/p/${p.id}/sheet` });
  });
});

describe('finishing the questionnaire out of order', () => {
  it('sends the person to the first unanswered step, not the sheet', async () => {
    const p = await createProfile('Ana');
    await setPhoto(p.id, '/x.jpg');
    const url = `/api/p/${p.id}/answers?step=4`;
    const fields: [string, string][] = [['dressCode', 'remote'], ['location', 'Austin'], ['budget', '$$']];
    const res = await answersRoute({ params: { id: p.id }, url: new URL(`http://localhost${url}`), request: jsonForm(url, fields) } as any);
    expect(await res.json()).toEqual({ ok: true, next: `/p/${p.id}/q/1` });
  });
});

describe('name in the pop-up', () => {
  it('a profile can start without a name', async () => {
    const res = await createRoute({ request: jsonForm('/api/profiles', []) } as any);
    const out = await res.json();
    expect(out.ok).toBe(true);
    expect((await getProfile(out.id))?.name).toBe('New profile');
  });

  it('step 1 saves the first name', async () => {
    const p = await createProfile('New profile');
    await setPhoto(p.id, '/x.jpg');
    const url = `/api/p/${p.id}/answers?step=1`;
    const fields: [string, string][] = [['name', ' Ana '], ['section', 'womens'], ['height', '5ft6'], ['topSize', 'M'], ['bottomSize', '8'], ['shape', 'pear'], ['goals', 'comfort']];
    const res = await answersRoute({ params: { id: p.id }, url: new URL(`http://localhost${url}`), request: jsonForm(url, fields) } as any);
    expect((await res.json()).ok).toBe(true);
    expect((await getProfile(p.id))?.name).toBe('Ana');
  });

  it('step 1 needs a first name', async () => {
    const p = await createProfile('New profile');
    await setPhoto(p.id, '/x.jpg');
    const url = `/api/p/${p.id}/answers?step=1`;
    const fields: [string, string][] = [['name', '  '], ['section', 'womens'], ['height', '5ft6'], ['topSize', 'M'], ['bottomSize', '8'], ['shape', 'pear'], ['goals', 'comfort']];
    const res = await answersRoute({ params: { id: p.id }, url: new URL(`http://localhost${url}`), request: jsonForm(url, fields) } as any);
    expect(await res.json()).toEqual({ ok: false, missing: ['name'] });
  });
});
