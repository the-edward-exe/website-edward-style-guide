import { timingSafeEqual } from 'node:crypto';

const same = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

/**
 * A user name and password for a copy of Vestry that is on the internet.
 * Returns the browser's sign-in prompt, or null to let the request through.
 * With no password set (the local Docker copy) everything goes through;
 * with no user name set, any name is accepted.
 */
export function gate(request: Request, password: string | undefined, user?: string): Response | null {
  if (!password) return null;
  const header = request.headers.get('Authorization') ?? '';
  if (header.startsWith('Basic ')) {
    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const colon = decoded.indexOf(':');
    const givenUser = decoded.slice(0, colon);
    const givenPassword = decoded.slice(colon + 1);
    const userOk = !user || same(givenUser, user);
    if (colon >= 0 && same(givenPassword, password) && userOk) return null;
  }
  return new Response('Sign-in needed.', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Vestry", charset="UTF-8"' },
  });
}
