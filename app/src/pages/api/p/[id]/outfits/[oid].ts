import type { APIRoute } from 'astro';
import { getProfile } from '../../../../../lib/profiles';
import { getOutfit, retryOutfit } from '../../../../../lib/outfits';
import { startOutfitImage } from '../../../../../lib/jobs';
import { readImage, imageExt } from '../../../../../lib/storage';
import { downloadName } from '../../../../../lib/filenames';
import { seeOther } from '../../../../../lib/http';

export const GET: APIRoute = async ({ params, url }) => {
  const profile = await getProfile(params.id!);
  const outfit = profile && (await getOutfit(params.oid!));
  if (!profile || outfit?.profileId !== profile.id || outfit.status !== 'ready' || !outfit.path) return new Response('Not found', { status: 404 });

  let buf: Buffer;
  try {
    buf = await readImage(outfit.path);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const ext = imageExt(buf);
  const headers: Record<string, string> = {
    'Content-Type': ext === 'png' ? 'image/png' : 'image/jpeg',
    'Cache-Control': 'private, no-cache',
  };
  if (url.searchParams.has('download')) {
    const kind = `${outfit.season}-${outfit.style}-${outfit.look.name}`;
    headers['Content-Disposition'] = `attachment; filename="${downloadName(profile.name, kind, undefined, ext)}"`;
  }
  return new Response(new Uint8Array(buf), { headers });
};

// Try again on one picture that failed.
export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  if (await retryOutfit(profile.id, params.oid!)) startOutfitImage(params.oid!);
  return seeOther(`/p/${profile.id}/dressing#outfit-${params.oid}`);
};
