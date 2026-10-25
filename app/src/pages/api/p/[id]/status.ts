import type { APIRoute } from 'astro';
import { getProfile } from '../../../../lib/profiles';
import { aiMode } from '../../../../lib/ai/mode';

export const GET: APIRoute = async ({ params }) => {
  const p = await getProfile(params.id!);
  if (!p) return new Response('Not found', { status: 404 });
  return Response.json(
    { sheetStatus: p.sheetStatus, sheetError: p.sheetError, photoReadStatus: p.photoReadStatus, photoRead: p.photoRead, guideStatus: p.guideStatus, guideError: p.guideError, demo: aiMode() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
};
