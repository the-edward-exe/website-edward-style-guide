import { describe, it, expect, beforeEach } from 'vitest';
import { existsSync } from 'node:fs';
import { sql } from '../src/lib/db';
import { createProfile, getProfile } from '../src/lib/profiles';
import { saveImage, profileDir } from '../src/lib/storage';
import { onRequest } from '../src/middleware';
import { POST as del } from '../src/pages/api/p/[id]/delete';
import { formRequest } from './helpers/form';

beforeEach(async () => { await sql`truncate profiles cascade`; });

function ctx(path: string) {
  return {
    url: new URL(`http://localhost${path}`),
    rewrite: async (to: string) => new Response(`rewrote to ${to}`, { status: 404 }),
  } as any;
}
const next = async () => new Response('page', { status: 200 });

describe('profile routes', () => {
  it('shows 404 for a well-formed id that does not exist', async () => {
    const res = await onRequest(ctx('/p/AAAAAAAAAAAAAAAAAAAAAA'), next);
    expect((res as Response).status).toBe(404);
  });

  it('shows 404 for a malformed id on an api route', async () => {
    const res = await onRequest(ctx('/api/p/bad/image/photo'), next);
    expect((res as Response).status).toBe(404);
  });

  it('lets existing profiles through', async () => {
    const p = await createProfile('Ana');
    const res = await onRequest(ctx(`/p/${p.id}/sheet`), next);
    expect((res as Response).status).toBe(200);
  });

  it('refuses delete without typed confirmation', async () => {
    const p = await createProfile('Ana');
    const res = await del({ params: { id: p.id }, request: formRequest('/', {}) } as any);
    expect(res.status).toBe(400);
    expect(await getProfile(p.id)).not.toBeNull();
  });

  it('treats a delete with no form body as unconfirmed', async () => {
    const p = await createProfile('Ana');
    const res = await del({ params: { id: p.id }, request: new Request('http://localhost/', { method: 'POST' }) } as any);
    expect(res.status).toBe(400);
  });

  it('deletes the profile and its photos', async () => {
    const p = await createProfile('Ana');
    await saveImage(p.id, 'photo', Buffer.from([0xff, 0xd8]));
    const res = await del({ params: { id: p.id }, request: formRequest('/', { confirm: 'DELETE' }) } as any);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/');
    expect(await getProfile(p.id)).toBeNull();
    expect(existsSync(profileDir(p.id))).toBe(false);
  });
});
