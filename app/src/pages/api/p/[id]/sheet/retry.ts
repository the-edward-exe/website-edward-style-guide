import type { APIRoute } from 'astro';
import { getProfile, retrySheet } from '../../../../../lib/profiles';
import { startSheetJob } from '../../../../../lib/jobs';
import { seeOther } from '../../../../../lib/http';

export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  startSheetJob(profile.id, await retrySheet(profile.id));
  return seeOther(`/p/${profile.id}/sheet`);
};
