import type { APIRoute } from 'astro';
import { getProfile, beginLooks } from '../../../../lib/profiles';
import { startLooksJob } from '../../../../lib/jobs';
import { seeOther } from '../../../../lib/http';

// Try again for the ten looks on the sheet page.
export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  const attempt = await beginLooks(profile.id, ['pending']);
  if (attempt !== null) startLooksJob(profile.id, attempt);
  return seeOther(`/p/${profile.id}/sheet`);
};
