import type { APIRoute } from 'astro';
import { getProfile } from '../../../../../lib/profiles';
import { listLookImages, retryLookImage, keyOf } from '../../../../../lib/look-images';
import { startLookImage } from '../../../../../lib/jobs';
import { readImage, imageExt } from '../../../../../lib/storage';
import { downloadName } from '../../../../../lib/filenames';
import { seeOther } from '../../../../../lib/http';

// Look pictures are numbered 1 to 10 in URLs, matching the cards.
const lookIndex = (n: string | undefined) => (/^\d{1,2}$/.test(n ?? '') ? Number(n) - 1 : -1);

export const GET: APIRoute = async ({ params, url }) => {
  const profile = await getProfile(params.id!);
  const idx = lookIndex(params.n);
  if (!profile || idx < 0) return new Response('Not found', { status: 404 });
  const image = (await listLookImages(profile)).find((i) => i.idx === idx);
  if (image?.status !== 'ready' || !image.path) return new Response('Not found', { status: 404 });

  let buf: Buffer;
  try {
    buf = await readImage(image.path);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const ext = imageExt(buf);
  const headers: Record<string, string> = {
    'Content-Type': ext === 'png' ? 'image/png' : 'image/jpeg',
    'Cache-Control': 'private, no-cache',
  };
  if (url.searchParams.has('download')) {
    const kind = `look-${String(idx + 1).padStart(2, '0')}-${profile.looks?.looks[idx]?.name ?? ''}`;
    headers['Content-Disposition'] = `attachment; filename="${downloadName(profile.name, kind, undefined, ext)}"`;
  }
  return new Response(new Uint8Array(buf), { headers });
};

// Try again on one picture that failed.
export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  const idx = lookIndex(params.n);
  if (!profile || idx < 0) return new Response('Not found', { status: 404 });
  if (await retryLookImage(profile, idx)) startLookImage(keyOf(profile), idx);
  return seeOther(`/p/${profile.id}/sheet#look-${idx + 1}`);
};
