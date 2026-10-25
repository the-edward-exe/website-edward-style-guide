import type { APIRoute } from 'astro';
import { getProfile } from '../../../../../lib/profiles';
import { readImage, imageExt } from '../../../../../lib/storage';
import { downloadName } from '../../../../../lib/filenames';

export const GET: APIRoute = async ({ params, url }) => {
  const profile = await getProfile(params.id!);
  const path = params.kind === 'photo' ? profile?.photoPath : params.kind === 'sheet' ? profile?.sheetPath : null;
  if (!profile || !path) return new Response('Not found', { status: 404 });

  let buf: Buffer;
  try {
    buf = await readImage(path);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const ext = imageExt(buf);
  const headers: Record<string, string> = {
    'Content-Type': ext === 'png' ? 'image/png' : 'image/jpeg',
    'Cache-Control': 'private, no-cache',
  };
  if (url.searchParams.has('download')) {
    const kind = params.kind === 'sheet' ? 'character-sheet' : 'photo';
    headers['Content-Disposition'] = `attachment; filename="${downloadName(profile.name, kind, undefined, ext)}"`;
  }
  return new Response(new Uint8Array(buf), { headers });
};
