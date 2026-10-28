import type { APIRoute } from 'astro';
import { getProfile, beginGuide } from '../../../../../lib/profiles';
import { startGuideJob } from '../../../../../lib/jobs';
import { seeOther } from '../../../../../lib/http';

export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  if (!profile.sheetApproved) return new Response('Approve the sheet first', { status: 409 });
  const attempt = await beginGuide(profile.id, ['pending']);
  if (attempt !== null) startGuideJob(profile.id, attempt);
  return seeOther(`/p/${profile.id}`);
};
