import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { normalizePhoto, PhotoError } from '../src/lib/images';

const fixture = (f: string) => readFile(new URL(`./fixtures/${f}`, import.meta.url));

describe('normalizePhoto', () => {
  it('converts a large PNG to a JPEG no wider than 2048px', async () => {
    const meta = await sharp(await normalizePhoto(await fixture('ok.png'))).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width!, meta.height!)).toBeLessThanOrEqual(2048);
  });

  it('rejects a file that is not an image', async () => {
    await expect(normalizePhoto(await fixture('not-image.txt'))).rejects.toThrow(
      new PhotoError('USE A JPG, PNG OR WEBP PHOTO.'),
    );
  });

  it('rejects a corrupt or truncated photo with the plain message', async () => {
    await expect(normalizePhoto(await fixture('truncated.jpg'))).rejects.toThrow(PhotoError);
  });

  it('rejects a photo over 25 MB', async () => {
    await expect(normalizePhoto(Buffer.alloc(26 * 1024 * 1024))).rejects.toThrow('PHOTO IS OVER 25 MB.');
  });
});
