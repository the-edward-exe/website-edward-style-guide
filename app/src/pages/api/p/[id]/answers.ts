import type { APIRoute } from 'astro';
import { getProfile, saveAnswers, renameProfile, beginLooks } from '../../../../lib/profiles';
import { startLooksJob } from '../../../../lib/jobs';
import { parseStep, nextPath, stepFields } from '../../../../lib/questionnaire';
import { stopGeneration } from '../../../../lib/stop';
import { seeOther, readForm, wantsJson } from '../../../../lib/http';

// Compares answers so order, an empty list and no answer don't count as a change.
const same = (v: unknown) => JSON.stringify(Array.isArray(v) ? (v.length ? [...v].sort() : null) : v ?? null);

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
  // Your taste changed after the looks were written: replace them with new looks and pictures.
  const tasteChanged = step === 3 && !missing.length && profile.looksStatus !== 'none'
    && stepFields(3).some((k) => same(profile.answers[k]) !== same(valid[k]));
  if (tasteChanged) {
    await stopGeneration(profile.id, 'looks');
    startLooksJob(profile.id, await beginLooks(profile.id));
  }
  // After the last step, go to the first unanswered step if any, else on to the sheet.
  const next = step === 4 ? nextPath((await getProfile(profile.id))!) : `/p/${profile.id}/q/${step + 1}`;
  // Headed for the sheet: start the ten looks now so they're ready while the sheet builds.
  if (next === `/p/${profile.id}/sheet`) {
    const attempt = await beginLooks(profile.id, ['pending']);
    if (attempt !== null) startLooksJob(profile.id, attempt);
  }
  if (wantsJson(request)) return Response.json(missing.length ? { ok: false, missing } : { ok: true, next });
  if (missing.length) return seeOther(`/p/${profile.id}/q/${step}?missing=${missing.join(',')}`);
  return seeOther(next);
};
