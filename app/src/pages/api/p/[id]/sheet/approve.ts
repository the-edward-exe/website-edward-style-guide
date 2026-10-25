import type { APIRoute } from 'astro';
import { getProfile, approveSheet } from '../../../../../lib/profiles';
import { seeOther } from '../../../../../lib/http';

export const POST: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  if (profile.sheetStatus !== 'ready') return new Response('Sheet not ready', { status: 409 });
  await approveSheet(profile.id);
  return seeOther(`/p/${profile.id}`);
};
