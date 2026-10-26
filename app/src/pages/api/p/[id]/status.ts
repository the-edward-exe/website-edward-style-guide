import type { APIRoute } from 'astro';
import { getProfile } from '../../../../lib/profiles';
import { listLookImages } from '../../../../lib/look-images';
import { aiMode } from '../../../../lib/ai/mode';

export const GET: APIRoute = async ({ params }) => {
  const p = await getProfile(params.id!);
  if (!p) return new Response('Not found', { status: 404 });
  // The file name changes on every new picture, so it doubles as a cache-busting version.
  const lookImages = (await listLookImages(p)).map((i) => ({ status: i.status, error: i.error, v: i.path?.match(/look-(\d+)/)?.[1] ?? null }));
  return Response.json(
    { sheetStatus: p.sheetStatus, sheetError: p.sheetError, photoReadStatus: p.photoReadStatus, photoRead: p.photoRead, guideStatus: p.guideStatus, guideError: p.guideError, looksStatus: p.looksStatus, lookImages, demo: aiMode() },
    { headers: { 'Cache-Control': 'no-store' } },
  );
};
