import sharp from 'sharp';

export class PhotoError extends Error {}

const MAX_BYTES = 25 * 1024 * 1024;
const ACCEPTED = new Set(['jpeg', 'png', 'webp']);

export async function normalizePhoto(buf: Buffer): Promise<Buffer> {
  if (buf.length > MAX_BYTES) throw new PhotoError('PHOTO IS OVER 25 MB.');
  let format: string | undefined;
  try {
    format = (await sharp(buf).metadata()).format;
  } catch {
    format = undefined;
  }
  if (!format || !ACCEPTED.has(format)) throw new PhotoError('USE A JPG, PNG OR WEBP PHOTO.');
  return sharp(buf)
    .rotate()
    .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 90 })
    .toBuffer();
}
