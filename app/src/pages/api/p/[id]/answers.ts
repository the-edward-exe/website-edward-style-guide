import type { APIRoute } from 'astro';
import { getProfile, saveAnswers, renameProfile } from '../../../../lib/profiles';
import { parseStep, nextPath } from '../../../../lib/questionnaire';
import { seeOther, readForm, wantsJson } from '../../../../lib/http';

export const POST: APIRoute = async ({ params, url, request }) => {
  const profile = await getProfile(params.id!);
  const step = Number(url.searchParams.get('step'));
  if (!profile) return new Response('Not found', { status: 404 });
  if (![1, 2, 3, 4].includes(step)) return new Response('Bad step', { status: 400 });

  const form = await readForm(request);
  const { valid, missing } = parseStep(step, form);
  // Step 1 also asks for the first name (the home page no longer does).
  if (step === 1) {
    const name = String(form.get('name') ?? '').trim().slice(0, 40);
    if (name) await renameProfile(profile.id, name);
    else missing.unshift('name' as never);
  }
  if (Object.keys(valid).length) await saveAnswers(profile.id, valid);
  // After the last step, go to the first unanswered step if any, else on to the sheet.
  const next = step === 4 ? nextPath((await getProfile(profile.id))!) : `/p/${profile.id}/q/${step + 1}`;
  if (wantsJson(request)) return Response.json(missing.length ? { ok: false, missing } : { ok: true, next });
  if (missing.length) return seeOther(`/p/${profile.id}/q/${step}?missing=${missing.join(',')}`);
  return seeOther(next);
};
