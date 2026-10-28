import { randomBytes } from 'node:crypto';

export function newProfileId(): string {
  return randomBytes(16).toString('base64url');
}

export function isProfileId(s: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(s);
}
