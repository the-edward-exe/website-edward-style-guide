import type { APIRoute } from 'astro';
import { createProfile, NEW_PROFILE_NAME } from '../../lib/profiles';
import { seeOther, readForm, wantsJson } from '../../lib/http';

// A profile starts when the photo is dropped; the first name is asked in the pop-up's step 1.
export const POST: APIRoute = async ({ request }) => {
  const name = String((await readForm(request)).get('name') ?? '').trim().slice(0, 40) || NEW_PROFILE_NAME;
  const profile = await createProfile(name);
  return wantsJson(request) ? Response.json({ ok: true, id: profile.id }) : seeOther(`/p/${profile.id}/photo`);
};
