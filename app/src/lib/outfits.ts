import { z } from 'zod/v4';
import { sql } from './db';
import { newProfileId } from './ids';
import { STEPS, stepComplete } from './questionnaire';
import { LookSchema, STYLE_OPTIONS, aboutPerson, styleLabel, type Look } from './looks';
import type { JobStatus, Profile } from './profiles';

export const OUTFIT_COUNT = 10;
export const SEASONS = ['Spring', 'Summer', 'Fall', 'Winter'] as const;

/** What the stylist writes. The season and style come from the outfit's place in the list. */
export const WrittenOutfitSchema = LookSchema.omit({ style: true });
export const WrittenOutfitsSchema = z.object({ looks: z.array(WrittenOutfitSchema).length(OUTFIT_COUNT) });
export type WrittenOutfit = Omit<Look, 'style'>;

export type OutfitSlot = { season: string; style: string };
export type OutfitRun = { id: string; profileId: string; seasons: string[]; styles: string[]; status: JobStatus; error: string | null };
export type Outfit = {
  id: string; runId: string; profileId: string; idx: number; season: string; style: string;
  look: WrittenOutfit; status: JobStatus; path: string | null; error: string | null;
  /** Removed with the X: a new outfit still has to be written for this spot. */
  replacing: boolean;
};

const toRun = (r: Record<string, any>): OutfitRun => ({ id: r.id, profileId: r.profile_id, seasons: r.seasons, styles: r.styles, status: r.status, error: r.error });
const toOutfit = (r: Record<string, any>): Outfit => ({
  id: r.id, runId: r.run_id, profileId: r.profile_id, idx: r.idx, season: r.season, style: r.style,
  look: r.look, status: r.status, path: r.path, error: r.error, replacing: r.replacing,
});

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/**
 * The ten outfits to make. Walks the season and style grid diagonally, so any stretch of it stays
 * even across seasons and across styles, and every pairing comes up before any repeats.
 */
export function outfitSlots(seasons: readonly string[], styles: readonly string[]): OutfitSlot[] {
  const s = seasons.length;
  const t = styles.length;
  const shared = gcd(s, t);
  const cells: OutfitSlot[] = [];
  for (let offset = 0; offset < shared; offset++) {
    for (let i = 0; i < (s * t) / shared; i++) cells.push({ season: seasons[i % s], style: styles[(i + offset) % t] });
  }
  return Array.from({ length: OUTFIT_COUNT }, (_, i) => cells[i % cells.length]);
}

export const slotsFor = (run: Pick<OutfitRun, 'seasons' | 'styles'>): OutfitSlot[] => outfitSlots(run.seasons, run.styles.map(styleLabel));

/** A finished profile: every question answered and a character sheet to dress. */
export function canMakeOutfits(p: Profile): boolean {
  return !!p.photoPath && p.sheetStatus === 'ready' && !!p.sheetPath && STEPS.every((s) => stepComplete(p.answers, s.n));
}

/** The picks from the form, in a fixed order. Null without at least one season and one style. */
export function parseOutfitChoice(form: FormData): { seasons: string[]; styles: string[] } | null {
  const picked = (key: string) => new Set(form.getAll(key).map(String));
  const season = picked('season');
  const style = picked('style');
  const seasons = SEASONS.filter((s) => season.has(s));
  const styles = STYLE_OPTIONS.map((o) => o.value).filter((s) => style.has(s));
  return seasons.length && styles.length ? { seasons, styles } : null;
}

export function outfitsPrompt(p: Profile, slots: OutfitSlot[], previous: string[]): string {
  return `${aboutPerson(p)}

Return exactly ${OUTFIT_COUNT} new outfits, in this exact order, one for each line. Each line gives the season and the style to dress for; it wins over the looks they usually like.
${slots.map((s, i) => `${i + 1}. ${s.season}, ${s.style}`).join('\n')}

Dress for the season as it really feels where they live: fabric weight, layers and footwear should all suit it. Make every outfit a different combination, and spread them across the occasions they named.${previous.length ? `

They already have these outfits, so do not repeat them or come close:
${previous.map((n) => `- ${n}`).join('\n')}` : ''}

Each outfit has:
- name: short, in the style "Olive Field Jacket and Cream Knit".
- why: one sentence on why these colors suit their skin tone and why the outfit suits the season and style.
- pieces: 3 to 5 garments and shoes, each with item, color name and #RRGGBB hex.

Never use colors they never wear or pieces they avoid.`;
}

/** One outfit to take the place of one the person removed. */
export function replacementPrompt(p: Profile, slot: { style: string; season?: string }, previous: string[], rejected: string): string {
  return `${aboutPerson(p)}

They removed the outfit "${rejected}" because they did not like it. Write one new outfit to take its place, clearly different in its main pieces and colors.
Style: ${slot.style}${slot.season ? `
Season: ${slot.season}. Dress for it as it really feels where they live: fabric weight, layers and footwear should all suit it.` : ''}${previous.length ? `

They already have these outfits, so do not repeat them or come close:
${previous.map((n) => `- ${n}`).join('\n')}` : ''}

The outfit has:
- name: short, in the style "Olive Field Jacket and Cream Knit".
- why: one sentence on why these colors suit their skin tone and why the outfit suits the style.
- pieces: 3 to 5 garments and shoes, each with item, color name and #RRGGBB hex.

Never use colors they never wear or pieces they avoid.`;
}

/** Starts a run. Null while another run is being written or its pictures are still being made. */
export async function beginOutfits(profileId: string, seasons: string[], styles: string[]): Promise<string | null> {
  const id = newProfileId();
  const rows = await sql`
    insert into outfit_runs (id, profile_id, seasons, styles)
    select ${id}, ${profileId}, ${seasons}::text[], ${styles}::text[]
    where not exists (select 1 from outfits where profile_id = ${profileId} and status = 'pending')
    on conflict do nothing returning id`;
  if (!rows.length) return null;
  await sql`delete from outfit_runs where profile_id = ${profileId} and status = 'failed'`;
  return id;
}

/** Saves the written outfits, or the error. Returns the new outfit ids; none if the run was stopped. */
export async function finishOutfitRun(runId: string, r: { looks: WrittenOutfit[] } | { error: string }): Promise<string[]> {
  if ('error' in r) {
    await sql`update outfit_runs set status = 'failed', error = ${r.error} where id = ${runId} and status = 'pending'`;
    return [];
  }
  return sql.begin(async (tx) => {
    const [row] = await tx`update outfit_runs set status = 'ready', error = null where id = ${runId} and status = 'pending' returning *`;
    if (!row) return [];
    const run = toRun(row);
    const ids: string[] = [];
    const slots = slotsFor(run);
    for (const [idx, look] of r.looks.slice(0, OUTFIT_COUNT).entries()) {
      const id = newProfileId();
      ids.push(id);
      await tx`insert into outfits (id, run_id, profile_id, idx, season, style, look)
        values (${id}, ${runId}, ${run.profileId}, ${idx}, ${slots[idx].season}, ${slots[idx].style}, ${tx.json(look as any)})`;
    }
    return ids;
  });
}

export async function getOutfitRun(id: string): Promise<OutfitRun | null> {
  const [r] = await sql`select * from outfit_runs where id = ${id}`;
  return r ? toRun(r) : null;
}

export async function latestOutfitRun(profileId: string): Promise<OutfitRun | null> {
  const [r] = await sql`select * from outfit_runs where profile_id = ${profileId} order by created_at desc limit 1`;
  return r ? toRun(r) : null;
}

/** The library, newest run first. */
export async function listOutfits(profileId: string): Promise<Outfit[]> {
  const rows = await sql`
    select o.* from outfits o join outfit_runs r on r.id = o.run_id
    where o.profile_id = ${profileId} order by r.created_at desc, o.idx`;
  return rows.map(toOutfit);
}

export async function getOutfit(id: string): Promise<Outfit | null> {
  const [r] = await sql`select * from outfits where id = ${id}`;
  return r ? toOutfit(r) : null;
}

/** Recent outfit names, so a new run doesn't repeat them. */
export async function previousOutfitNames(profileId: string): Promise<string[]> {
  return (await listOutfits(profileId)).slice(0, 40).map((o) => o.look.name);
}

/** Try again on one failed picture. True when it was failed and is now pending again. */
export async function retryOutfit(profileId: string, id: string): Promise<boolean> {
  const rows = await sql`update outfits set status = 'pending', error = null
    where id = ${id} and profile_id = ${profileId} and status = 'failed' returning id`;
  return rows.length > 0;
}

/**
 * The X on an outfit: clears its picture and queues a new outfit for the same spot.
 * Returns the old picture's path holder, or null when it is already being made or isn't this profile's.
 */
export async function replaceOutfit(profileId: string, id: string): Promise<{ oldPath: string | null } | null> {
  const old = await getOutfit(id);
  if (old?.profileId !== profileId) return null;
  const rows = await sql`update outfits set status = 'pending', replacing = true, path = null, error = null
    where id = ${id} and status <> 'pending' and not replacing returning id`;
  return rows.length ? { oldPath: old.path } : null;
}

/** Saves the new outfit for a removed one. False if it was stopped meanwhile. */
export async function finishOutfitRewrite(id: string, look: WrittenOutfit): Promise<boolean> {
  const rows = await sql`update outfits set look = ${sql.json(look as any)}, replacing = false
    where id = ${id} and status = 'pending' and replacing returning id`;
  return rows.length > 0;
}

export async function finishOutfit(id: string, r: { path: string } | { error: string }): Promise<boolean> {
  const rows = 'path' in r
    ? await sql`update outfits set status = 'ready', path = ${r.path}, error = null where id = ${id} and status = 'pending' returning id`
    : await sql`update outfits set status = 'failed', error = ${r.error} where id = ${id} and status = 'pending' returning id`;
  return rows.length > 0;
}
