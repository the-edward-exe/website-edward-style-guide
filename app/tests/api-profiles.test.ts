import { describe, it, expect, beforeEach } from 'vitest';
import { sql } from '../src/lib/db';
import { POST } from '../src/pages/api/profiles';
import { formRequest } from './helpers/form';

beforeEach(async () => { await sql`truncate profiles cascade`; });

describe('POST /api/profiles', () => {
  it('creates a profile and sends the person to the photo step', async () => {
    const res = await POST({ request: formRequest('/api/profiles', { name: 'Ana' }) } as any);
    expect(res.status).toBe(303);
    expect(res.headers.get('Location')).toMatch(/^\/p\/[A-Za-z0-9_-]{22}\/photo$/);
  });

  it('starts a profile without a name; the pop-up asks for it', async () => {
    const res = await POST({ request: formRequest('/api/profiles', { name: '   ' }) } as any);
    expect(res.status).toBe(303);
    expect((await sql`select name from profiles`)[0].name).toBe('New profile');
  });
});
