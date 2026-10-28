import { describe, it, expect } from 'vitest';
import { GET } from '../src/pages/api/health';

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await GET({} as any);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
