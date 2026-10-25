import type { APIRoute } from 'astro';
import { zipSync } from 'fflate';
import { getProfile } from '../../../../../lib/profiles';
import { listTryons } from '../../../../../lib/tryons';
import { readImage, imageExt } from '../../../../../lib/storage';
import { downloadName } from '../../../../../lib/filenames';

// "Download all": the newest ready try-on of each outfit.
export const GET: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });

  const latest = new Map<string, { path: string; version: number }>();
  for (const t of await listTryons(profile.id, profile.guideAttempt)) {
    if (t.status === 'ready' && t.path) latest.set(t.outfitId, { path: t.path, version: t.version });
  }
  const files: Record<string, Uint8Array> = {};
  for (const [outfitId, t] of latest) {
    try {
      const buf = await readImage(t.path);
      const name = profile.guide?.outfits.find((o) => o.id === outfitId)?.name ?? outfitId;
      files[downloadName(profile.name, name, t.version, imageExt(buf))] = new Uint8Array(buf);
    } catch {
      // A missing file just leaves that outfit out.
    }
  }
  if (Object.keys(files).length === 0) return Response.json({ error: 'NO TRY-ONS YET.' }, { status: 404 });

  const zip = zipSync(files, { level: 0 });
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${downloadName(profile.name, 'dressing-room', undefined, 'zip')}"`,
    },
  });
};
