import type { APIRoute } from 'astro';
import { getProfile } from '../../../../../../lib/profiles';
import { keyOf, replaceLookImage } from '../../../../../../lib/look-images';
import { startLookImage } from '../../../../../../lib/jobs';
import { removeImage } from '../../../../../../lib/storage';
import { seeOther } from '../../../../../../lib/http';

// The X on a look: deletes it and makes a new one in the same spot. Looks are numbered from 1 in URLs.
export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  const idx = /^\d{1,2}$/.test(params.n ?? '') ? Number(params.n) - 1 : -1;
  if (!profile || !profile.looks?.looks[idx]) return new Response('Not found', { status: 404 });
  const replaced = await replaceLookImage(profile, idx);
  if (replaced) {
    if (replaced.oldPath) await removeImage(replaced.oldPath);
    startLookImage(keyOf(profile), idx);
  }
  return seeOther(`/p/${profile.id}/dressing#look-${idx + 1}`);
};
