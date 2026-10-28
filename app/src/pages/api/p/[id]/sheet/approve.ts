import type { APIRoute } from 'astro';
import { getProfile, approveSheet, beginGuide } from '../../../../../lib/profiles';
import { startGuideJob } from '../../../../../lib/jobs';
import { seeOther } from '../../../../../lib/http';

export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  if (profile.sheetStatus !== 'ready') return new Response('Sheet not ready', { status: 409 });
  await approveSheet(profile.id);
  // Write the guide once; a double-click or second tab doesn't start another run.
  const attempt = await beginGuide(profile.id, ['pending', 'ready']);
  if (attempt !== null) startGuideJob(profile.id, attempt);
  return seeOther(`/p/${profile.id}`);
};
