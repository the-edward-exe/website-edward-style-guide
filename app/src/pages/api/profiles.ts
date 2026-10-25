import type { APIRoute } from 'astro';
import { createProfile } from '../../lib/profiles';
import { seeOther, readForm } from '../../lib/http';

export const POST: APIRoute = async ({ request }) => {
  const form = await readForm(request);
  const name = String(form.get('name') ?? '').trim();
  if (name.length < 1 || name.length > 40) return seeOther('/?error=name');
  const profile = await createProfile(name);
  return seeOther(`/p/${profile.id}/photo`);
};
