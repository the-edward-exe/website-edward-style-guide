import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export const PHOTO_DIR = resolve(process.env.PHOTO_DIR ?? './data/photos');

export function profileDir(id: string): string {
  return join(PHOTO_DIR, id);
}

export function imageExt(buf: Buffer): 'png' | 'jpg' {
  return buf[0] === 0x89 && buf[1] === 0x50 ? 'png' : 'jpg';
}

export async function saveImage(id: string, kind: 'photo' | 'sheet' | 'tryon' | 'look' | 'outfit', buf: Buffer): Promise<string> {
  const dir = profileDir(id);
  await mkdir(dir, { recursive: true });
  // Pictures are made several at a time, so the clock alone could give two the same name.
  const path = join(dir, `${kind}-${Date.now()}-${randomBytes(3).toString('hex')}.${imageExt(buf)}`);
  await writeFile(path, buf);
  return path;
}

export function readImage(path: string): Promise<Buffer> {
  return readFile(path);
}

export async function removeImage(path: string): Promise<void> {
  await rm(path, { force: true });
}

export async function removeProfileFiles(id: string): Promise<void> {
  await rm(profileDir(id), { recursive: true, force: true });
}
