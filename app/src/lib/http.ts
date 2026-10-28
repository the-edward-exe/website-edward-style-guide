export function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}

/** Reads a form body; a missing or non-form body reads as an empty form instead of throwing. */
export async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    return new FormData();
  }
}

export function wantsJson(request: Request): boolean {
  return (request.headers.get('Accept') ?? '').includes('application/json');
}
