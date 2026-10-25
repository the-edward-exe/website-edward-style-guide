export function seeOther(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location } });
}
