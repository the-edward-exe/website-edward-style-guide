import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../src/lib/db';
import { createProfile, getProfile, setPhoto } from '../src/lib/profiles';
import { POST as createRoute } from '../src/pages/api/profiles';
import { POST as answersRoute } from '../src/pages/api/p/[id]/answers';

beforeEach(async () => { await sql`truncate profiles`; });

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

  it('reports a blank name', async () => {
    const res = await createRoute({ request: jsonForm('/api/profiles', [['name', ' ']]) } as any);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ ok: false, error: 'ENTER A FIRST NAME.' });
  });

  it('saves a step and lists what is missing', async () => {
    const p = await createProfile('Ana');
    await setPhoto(p.id, '/x.jpg');
    const url = `/api/p/${p.id}/answers?step=1`;
    const res = await answersRoute({ params: { id: p.id }, url: new URL(`http://localhost${url}`), request: jsonForm(url, [['section', 'mens']]) } as any);
    expect(await res.json()).toEqual({ ok: false, missing: ['height', 'topSize', 'bottomSize', 'shape', 'goals'] });
    expect((await getProfile(p.id))?.answers).toEqual({ section: 'mens' });
  });

  it('says where to go after the last step', async () => {
    const p = await createProfile('Ana');
    await setPhoto(p.id, '/x.jpg');
    const url = `/api/p/${p.id}/answers?step=4`;
    const fields: [string, string][] = [['dressCode', 'remote'], ['location', 'Austin'], ['budget', '$$']];
    const res = await answersRoute({ params: { id: p.id }, url: new URL(`http://localhost${url}`), request: jsonForm(url, fields) } as any);
    expect(await res.json()).toEqual({ ok: true, next: `/p/${p.id}/sheet` });
  });
});
