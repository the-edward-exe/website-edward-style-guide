export function formRequest(url: string, fields: Record<string, string>): Request {
  return new Request(`http://localhost${url}`, { method: 'POST', body: new URLSearchParams(fields) });
}
