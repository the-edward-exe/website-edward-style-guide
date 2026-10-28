export function downloadName(person: string, kind: string, version?: number, ext = 'png'): string {
  const slug = `${person}-${kind}${version ? `-${version}` : ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${slug}.${ext}`;
}
