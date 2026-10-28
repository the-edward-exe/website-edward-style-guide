import { sql } from './db';

export const STOPPED = 'STOPPED. TRY AGAIN WHEN YOU ARE READY.';

export const STOP_KINDS = ['sheet', 'looks', 'guide', 'tryon'] as const;
export type StopKind = (typeof STOP_KINDS)[number];

// Model calls in flight, by what Stop cancels: a profile's sheet, looks (text and pictures) or guide, or one try-on.
const running = new Map<string, Set<AbortController>>();

export const stopKey = {
  sheet: (id: string) => `sheet:${id}`,
  looks: (id: string) => `looks:${id}`,
  guide: (id: string) => `guide:${id}`,
  tryon: (tryonId: string) => `tryon:${tryonId}`,
};

/** Runs work with a signal that Stop aborts. */
export async function stoppable<T>(key: string, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const c = new AbortController();
  const set = running.get(key) ?? new Set();
  running.set(key, set.add(c));
  try {
    return await work(c.signal);
  } finally {
    set.delete(c);
    if (set.size === 0 && running.get(key) === set) running.delete(key);
  }
}

function abort(key: string): void {
  for (const c of running.get(key) ?? []) c.abort();
}

/**
 * Marks the work stopped first, so the cancelled call's own error can't overwrite it, then cancels
 * the call. Work that already finished is left alone. True when something was stopped.
 */
export async function stopGeneration(id: string, kind: StopKind, tryonId?: string): Promise<boolean> {
  let rows: readonly unknown[];
  if (kind === 'sheet') {
    rows = await sql`update profiles set sheet_status = 'failed', sheet_error = ${STOPPED} where id = ${id} and sheet_status = 'pending' returning id`;
    abort(stopKey.sheet(id));
  } else if (kind === 'looks') {
    const text = await sql`update profiles set looks_status = 'failed', looks_error = ${STOPPED} where id = ${id} and looks_status = 'pending' returning id`;
    const pictures = await sql`update look_images set status = 'failed', error = ${STOPPED} where profile_id = ${id} and status = 'pending' returning idx`;
    rows = [...text, ...pictures];
    abort(stopKey.looks(id));
  } else if (kind === 'guide') {
    rows = await sql`update profiles set guide_status = 'failed', guide_error = ${STOPPED} where id = ${id} and guide_status = 'pending' returning id`;
    abort(stopKey.guide(id));
  } else {
    if (!tryonId) return false;
    rows = await sql`update tryons set status = 'failed', error = ${STOPPED} where id = ${tryonId} and profile_id = ${id} and status = 'pending' returning id`;
    if (rows.length) abort(stopKey.tryon(tryonId));
  }
  return rows.length > 0;
}
