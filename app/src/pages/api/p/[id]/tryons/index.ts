import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getProfile } from '../../../../../lib/profiles';
import { createTryon, listTryons } from '../../../../../lib/tryons';
import { tryonPrompt } from '../../../../../lib/ai/tryon';
import { startTryonJob } from '../../../../../lib/jobs';

const Body = z.object({ outfitId: z.string(), prompt: z.string().trim().max(4000).optional() });

export const GET: APIRoute = async ({ params }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  return Response.json({ tryons: await listTryons(profile.id) }, { headers: { 'Cache-Control': 'no-store' } });
};

export const POST: APIRoute = async ({ params, request }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  if (!profile.sheetApproved || profile.guideStatus !== 'ready' || !profile.guide) {
    return Response.json({ error: 'APPROVE YOUR SHEET AND WAIT FOR YOUR GUIDE FIRST.' }, { status: 409 });
  }
  const body = Body.safeParse(await request.json().catch(() => null));
  const outfit = body.success ? profile.guide.outfits.find((o) => o.id === body.data.outfitId) : undefined;
  if (!body.success || !outfit) return Response.json({ error: 'UNKNOWN OUTFIT.' }, { status: 400 });

  const tryon = await createTryon(profile.id, outfit.id, body.data.prompt || tryonPrompt(profile, outfit));
  startTryonJob(tryon.id);
  return Response.json({ tryon });
};
