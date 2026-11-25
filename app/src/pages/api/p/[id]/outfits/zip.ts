import type { APIRoute } from 'astro';
import { zipSync } from 'fflate';
import { getProfile } from '../../../../../lib/profiles';
import { listOutfits } from '../../../../../lib/outfits';
import { readImage, imageExt } from '../../../../../lib/storage';
import { downloadName } from '../../../../../lib/filenames';

// "Download all" for the outfit library. The number keeps outfits with the same name apart.
export const GET: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });

  const files: Record<string, Uint8Array> = {};
  let n = 0;
  for (const o of await listOutfits(profile.id)) {
    if (o.status !== 'ready' || !o.path) continue;
    try {
      const buf = await readImage(o.path);
      n++;
      files[downloadName(profile.name, `${o.season}-${o.style}-${String(n).padStart(3, '0')}-${o.look.name}`, undefined, imageExt(buf))] = new Uint8Array(buf);
    } catch {
      // A missing file just leaves that outfit out.
    }
  }
  if (n === 0) return Response.json({ error: 'NO OUTFIT PICTURES YET.' }, { status: 404 });

  return new Response(zipSync(files, { level: 0 }), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${downloadName(profile.name, 'outfits', undefined, 'zip')}"`,
    },
  });
};
