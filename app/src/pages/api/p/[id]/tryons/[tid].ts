import type { APIRoute } from 'astro';
import { getProfile } from '../../../../../lib/profiles';
import { getTryon } from '../../../../../lib/tryons';
import { readImage, imageExt } from '../../../../../lib/storage';
import { downloadName } from '../../../../../lib/filenames';

export const GET: APIRoute = async ({ params, url }) => {
  const profile = await getProfile(params.id!);
  const tryon = await getTryon(params.tid!);
  if (!profile || !tryon || tryon.profileId !== profile.id || !tryon.path) return new Response('Not found', { status: 404 });

  let buf: Buffer;
  try {
    buf = await readImage(tryon.path);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const ext = imageExt(buf);
  const headers: Record<string, string> = { 'Content-Type': ext === 'png' ? 'image/png' : 'image/jpeg', 'Cache-Control': 'private, max-age=31536000, immutable' };
  if (url.searchParams.has('download')) {
    const outfit = profile.guide?.outfits.find((o) => o.id === tryon.outfitId);
    headers['Content-Disposition'] = `attachment; filename="${downloadName(profile.name, outfit?.name ?? tryon.outfitId, tryon.version, ext)}"`;
  }
  return new Response(new Uint8Array(buf), { headers });
};
