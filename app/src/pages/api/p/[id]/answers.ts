import type { APIRoute } from 'astro';
import { getProfile, saveAnswers } from '../../../../lib/profiles';
import { parseStep, nextPath } from '../../../../lib/questionnaire';
import { seeOther, readForm, wantsJson } from '../../../../lib/http';

export const POST: APIRoute = async ({ params, url, request }) => {
  const profile = await getProfile(params.id!);
  const step = Number(url.searchParams.get('step'));
  if (!profile) return new Response('Not found', { status: 404 });
  if (![1, 2, 3, 4].includes(step)) return new Response('Bad step', { status: 400 });

  const { valid, missing } = parseStep(step, await readForm(request));
  if (Object.keys(valid).length) await saveAnswers(profile.id, valid);
  // After the last step, go to the first unanswered step if any, else on to the sheet.
  const next = step === 4 ? nextPath((await getProfile(profile.id))!) : `/p/${profile.id}/q/${step + 1}`;
  if (wantsJson(request)) return Response.json(missing.length ? { ok: false, missing } : { ok: true, next });
  if (missing.length) return seeOther(`/p/${profile.id}/q/${step}?missing=${missing.join(',')}`);
  return seeOther(next);
};
