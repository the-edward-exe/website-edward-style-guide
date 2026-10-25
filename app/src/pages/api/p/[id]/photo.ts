import type { APIRoute } from 'astro';
import { getProfile, setPhoto } from '../../../../lib/profiles';
import { normalizePhoto, PhotoError } from '../../../../lib/images';
import { saveImage } from '../../../../lib/storage';
import { startPhotoJobs } from '../../../../lib/jobs';
import { seeOther, readForm, wantsJson } from '../../../../lib/http';

// The drag-and-drop page posts with Accept: application/json and stays put;
// a plain form post (no JavaScript) still redirects.
export const POST: APIRoute = async ({ params, request }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  const json = wantsJson(request);
  const next = `/p/${profile.id}/q/1`;
  const fail = (msg: string) =>
    json
      ? Response.json({ ok: false, error: msg }, { status: 400 })
      : seeOther(`/p/${profile.id}/photo?error=${encodeURIComponent(msg)}`);

  const file = (await readForm(request)).get('photo');
  if (!(file instanceof File) || file.size === 0) return fail('CHOOSE A PHOTO FIRST.');
  try {
    const jpeg = await normalizePhoto(Buffer.from(await file.arrayBuffer()));
    const path = await saveImage(profile.id, 'photo', jpeg);
    const attempt = await setPhoto(profile.id, path);
    startPhotoJobs(profile.id, attempt);
  } catch (e) {
    if (e instanceof PhotoError) return fail(e.message);
    throw e;
  }
  return json ? Response.json({ ok: true, next }) : seeOther(next);
};
