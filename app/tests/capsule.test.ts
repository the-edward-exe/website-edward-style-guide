import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../src/lib/db';
import { createProfile, getProfile } from '../src/lib/profiles';
import { POST } from '../src/pages/api/p/[id]/capsule';

beforeEach(async () => { await sql`truncate profiles cascade`; });
const post = (id: string, body: unknown) =>
  POST({ params: { id }, request: new Request('http://localhost/', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) } as any);

describe('capsule endpoint', () => {
  it('saves owned items', async () => {
    const p = await createProfile('Ana');
    expect((await post(p.id, { owned: [0, 3] })).status).toBe(200);
    expect((await getProfile(p.id))?.capsuleOwned).toEqual([0, 3]);
  });

  it('rejects anything but a list of whole numbers', async () => {
    const p = await createProfile('Ana');
    expect((await post(p.id, { owned: ['a', 1.5] })).status).toBe(400);
    expect((await post(p.id, 'nope')).status).toBe(400);
  });
});
