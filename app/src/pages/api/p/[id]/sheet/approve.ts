import type { APIRoute } from 'astro';
import { getProfile, approveSheet, beginGuide } from '../../../../../lib/profiles';
import { startGuideJob } from '../../../../../lib/jobs';
import { seeOther } from '../../../../../lib/http';

export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  if (profile.sheetStatus !== 'ready') return new Response('Sheet not ready', { status: 409 });
  await approveSheet(profile.id);
  // Write the guide once; a second approval (or back-button resubmit) doesn't start another run.
  if (profile.guideStatus !== 'pending' && profile.guideStatus !== 'ready') {
    startGuideJob(profile.id, await beginGuide(profile.id));
  }
  return seeOther(`/p/${profile.id}`);
};
