import type { APIRoute } from 'astro';
import { z } from 'zod';
import { getProfile, setCapsuleOwned } from '../../../../lib/profiles';

const Body = z.object({ owned: z.array(z.number().int().min(0).max(50)).max(50) });

export const POST: APIRoute = async ({ params, request }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  await setCapsuleOwned(profile.id, [...new Set(parsed.data.owned)].sort((a, b) => a - b));
  return Response.json({ ok: true });
};
