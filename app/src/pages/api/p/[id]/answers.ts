import type { APIRoute } from 'astro';
import { getProfile, saveAnswers } from '../../../../lib/profiles';
import { parseStep } from '../../../../lib/questionnaire';
import { seeOther, readForm } from '../../../../lib/http';

export const POST: APIRoute = async ({ params, url, request }) => {
  const profile = await getProfile(params.id!);
  const step = Number(url.searchParams.get('step'));
  if (!profile) return new Response('Not found', { status: 404 });
  if (![1, 2, 3, 4].includes(step)) return new Response('Bad step', { status: 400 });

  const { valid, missing } = parseStep(step, await readForm(request));
  if (Object.keys(valid).length) await saveAnswers(profile.id, valid);
  if (missing.length) return seeOther(`/p/${profile.id}/q/${step}?missing=${missing.join(',')}`);
  return seeOther(step === 4 ? `/p/${profile.id}/sheet` : `/p/${profile.id}/q/${step + 1}`);
};
