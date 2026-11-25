import { describe, it, expect } from 'vitest';
import { gate } from '../src/lib/gate';

const auth = (user: string, pass: string) => ({ Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}` });
const req = (headers: Record<string, string> = {}) => new Request('http://x/', { headers });

describe('password gate', () => {
  it('lets everything through when no password is set', () => {
    expect(gate(req(), undefined)).toBeNull();
    expect(gate(req(), '')).toBeNull();
  });

  it('asks the browser for a password when none is sent', () => {
    const res = gate(req(), 'linen')!;
    expect(res.status).toBe(401);
    expect(res.headers.get('WWW-Authenticate')).toMatch(/^Basic realm="Vestry"/);
  });

  it('refuses a wrong password', () => {
    expect(gate(req(auth('ed', 'wool')), 'linen')?.status).toBe(401);
  });

  it('accepts the right password with any name', () => {
    expect(gate(req(auth('ed', 'linen')), 'linen')).toBeNull();
    expect(gate(req(auth('', 'linen')), 'linen')).toBeNull();
  });

  it('accepts a password that contains a colon', () => {
    expect(gate(req(auth('ed', 'a:b')), 'a:b')).toBeNull();
  });

  describe('with a user name set', () => {
    it('accepts the right name and password', () => {
      expect(gate(req(auth('admin', 'Linen@1')), 'Linen@1', 'admin')).toBeNull();
    });

    it('refuses the right password with the wrong name', () => {
      expect(gate(req(auth('ed', 'Linen@1')), 'Linen@1', 'admin')?.status).toBe(401);
      expect(gate(req(auth('', 'Linen@1')), 'Linen@1', 'admin')?.status).toBe(401);
    });

    it('refuses the right name with the wrong password', () => {
      expect(gate(req(auth('admin', 'wool')), 'Linen@1', 'admin')?.status).toBe(401);
    });
  });
});
