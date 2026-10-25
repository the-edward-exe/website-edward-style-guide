import type { APIRoute } from 'astro';
import { createProfile } from '../../lib/profiles';
import { seeOther, readForm, wantsJson } from '../../lib/http';

export const POST: APIRoute = async ({ request }) => {
  const json = wantsJson(request);
  const name = String((await readForm(request)).get('name') ?? '').trim();
  if (name.length < 1 || name.length > 40) {
    return json ? Response.json({ ok: false, error: 'ENTER A FIRST NAME.' }, { status: 400 }) : seeOther('/?error=name');
  }
  const profile = await createProfile(name);
  return json ? Response.json({ ok: true, id: profile.id }) : seeOther(`/p/${profile.id}/photo`);
};
