import type { APIRoute } from 'astro';
import { getProfile } from '../../../../../../lib/profiles';
import { replaceOutfit } from '../../../../../../lib/outfits';
import { startOutfitImage } from '../../../../../../lib/jobs';
import { removeImage } from '../../../../../../lib/storage';
import { seeOther } from '../../../../../../lib/http';

// The X on an outfit: deletes it and makes a new one in the same spot.
export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  const replaced = await replaceOutfit(profile.id, params.oid!);
  if (replaced) {
    if (replaced.oldPath) await removeImage(replaced.oldPath);
    startOutfitImage(params.oid!);
  }
  return seeOther(`/p/${profile.id}/dressing#outfit-${params.oid}`);
};
