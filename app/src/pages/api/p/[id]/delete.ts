import type { APIRoute } from 'astro';
import { getProfile, deleteProfile } from '../../../../lib/profiles';
import { removeProfileFiles } from '../../../../lib/storage';
import { seeOther, readForm } from '../../../../lib/http';

export const POST: APIRoute = async ({ params, request }) => {
  const profile = await getProfile(params.id!);
  if (!profile) return new Response('Not found', { status: 404 });
  const confirm = String((await readForm(request)).get('confirm') ?? '').trim().toUpperCase();
  if (confirm !== 'DELETE') return new Response('Type DELETE to confirm', { status: 400 });
  await deleteProfile(profile.id);
  await removeProfileFiles(profile.id);
  return seeOther('/');
};
