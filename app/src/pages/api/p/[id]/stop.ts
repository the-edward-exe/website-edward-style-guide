import type { APIRoute } from 'astro';
import { getProfile } from '../../../../lib/profiles';
import { stopGeneration, STOP_KINDS, type StopKind } from '../../../../lib/stop';
import { seeOther, readForm, wantsJson } from '../../../../lib/http';

// Stop: the character sheet, the ten looks and their pictures, the guide, or one try-on.
export const POST: APIRoute = async ({ params, request }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  const form = await readForm(request);
  const what = String(form.get('what') ?? '') as StopKind;
  if (!STOP_KINDS.includes(what)) return new Response('Unknown thing to stop', { status: 400 });

  await stopGeneration(profile.id, what, String(form.get('tryon') ?? '') || undefined);
  if (wantsJson(request)) return Response.json({ ok: true });
  return seeOther(what === 'sheet' || what === 'looks' ? `/p/${profile.id}/sheet` : `/p/${profile.id}`);
};
