import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../src/lib/db';
import { POST } from '../src/pages/api/profiles';
import { formRequest } from './helpers/form';

beforeEach(async () => { await sql`truncate profiles`; });

describe('POST /api/profiles', () => {
  it('creates a profile and sends the person to the photo step', async () => {
    const res = await POST({ request: formRequest('/api/profiles', { name: 'Ana' }) } as any);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toMatch(/^\/p\/[A-Za-z0-9_-]{22}\/photo$/);
  });

  it('sends a blank name back home with an error', async () => {
    const res = await POST({ request: formRequest('/api/profiles', { name: '   ' }) } as any);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toBe('/?error=name');
    expect((await sql`select count(*)::int as n from profiles`)[0].n).toBe(0);
  });
});
