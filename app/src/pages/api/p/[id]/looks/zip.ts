import type { APIRoute } from 'astro';
import { zipSync } from 'fflate';
import { getProfile } from '../../../../../lib/profiles';
import { listLookImages } from '../../../../../lib/look-images';
import { readImage, imageExt } from '../../../../../lib/storage';
import { downloadName } from '../../../../../lib/filenames';

// "Download all" for the ten look pictures on the sheet page.
export const GET: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });

  const files: Record<string, Uint8Array> = {};
  for (const image of await listLookImages(profile)) {
    if (image.status !== 'ready' || !image.path) continue;
    try {
      const buf = await readImage(image.path);
      const kind = `look-${String(image.idx + 1).padStart(2, '0')}-${profile.looks?.looks[image.idx]?.name ?? ''}`;
      files[downloadName(profile.name, kind, undefined, imageExt(buf))] = new Uint8Array(buf);
    } catch {
      // A missing file just leaves that look out.
    }
  }
  if (Object.keys(files).length === 0) return Response.json({ error: 'NO LOOK PICTURES YET.' }, { status: 404 });

  const zip = zipSync(files, { level: 0 });
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${downloadName(profile.name, 'looks', undefined, 'zip')}"`,
    },
  });
};
