import type { APIRoute } from 'astro';
import { getProfile } from '../../../../../lib/profiles';
import { beginOutfits, canMakeOutfits, latestOutfitRun, listOutfits, parseOutfitChoice } from '../../../../../lib/outfits';
import { startOutfitsJob } from '../../../../../lib/jobs';
import { readForm, seeOther } from '../../../../../lib/http';

// Progress for the outfits page. The file name changes with each picture, so it doubles as a version.
export const GET: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  const run = await latestOutfitRun(profile.id);
  const outfits = (await listOutfits(profile.id)).map((o) => ({ id: o.id, status: o.status, replacing: o.replacing, v: o.path?.match(/outfit-(\d+)/)?.[1] ?? null }));
  return Response.json({ run: run && { status: run.status, error: run.error }, outfits }, { headers: { 'Cache-Control': 'no-store' } });
};

// Makes ten new outfits for the chosen seasons and styles.
export const POST: APIRoute = async ({ params, request }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  if (!canMakeOutfits(profile)) return new Response('Finish the profile first', { status: 409 });
  const choice = parseOutfitChoice(await readForm(request));
  if (!choice) return new Response('Pick at least one season and one style', { status: 400 });
  const run = await beginOutfits(profile.id, choice.seasons, choice.styles);
  if (run) startOutfitsJob(run);
  return seeOther(`/p/${profile.id}/dressing#outfits`);
};
