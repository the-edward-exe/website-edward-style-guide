import type { APIRoute } from 'astro';
import { getProfile, setPhoto } from '../../../../lib/profiles';
import { normalizePhoto, PhotoError } from '../../../../lib/images';
import { saveImage } from '../../../../lib/storage';
import { startPhotoJobs } from '../../../../lib/jobs';
import { seeOther, readForm } from '../../../../lib/http';

export const POST: APIRoute = async ({ params, request }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  const back = (msg: string) => seeOther(`/p/${profile.id}/photo?error=${encodeURIComponent(msg)}`);

  const file = (await readForm(request)).get('photo');
  if (!(file instanceof File) || file.size === 0) return back('CHOOSE A PHOTO FIRST.');
  try {
    const jpeg = await normalizePhoto(Buffer.from(await file.arrayBuffer()));
    const path = await saveImage(profile.id, 'photo', jpeg);
    const attempt = await setPhoto(profile.id, path);
    startPhotoJobs(profile.id, attempt);
  } catch (e) {
    if (e instanceof PhotoError) return back(e.message);
    throw e;
  }
  return seeOther(`/p/${profile.id}/q/1`);
};
