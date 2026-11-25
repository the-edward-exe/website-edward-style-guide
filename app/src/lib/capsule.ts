import type { Guide } from './guide';
import type { Profile } from './profiles';

/** The capsule pieces the person ticked. They are left out of everything made from now on. */
export function excludedItems(p: Pick<Profile, 'guide' | 'capsuleOwned'>): string[] {
  const capsule = p.guide?.capsule ?? [];
  return (p.capsuleOwned ?? []).flatMap((i) => (capsule[i] ? [capsule[i].item] : []));
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g)?.map((w) => w.replace(/s$/, '')) ?? []);
const within = (a: Set<string>, b: Set<string>) => a.size > 0 && [...a].every((w) => b.has(w));

/** The same piece, however it's worded: "Navy overshirt" matches navy "Wool overshirt", not camel. */
export function isExcluded(piece: { color: string; item: string }, excluded: string[]): boolean {
  const named = words(`${piece.color} ${piece.item}`);
  return excluded.some((x) => {
    const item = words(x);
    return within(item, named) || within(named, item);
  });
}

/** A line for the stylist's brief, empty when nothing is ticked. */
export function excludedLine(p: Pick<Profile, 'guide' | 'capsuleOwned'>): string {
  const out = excludedItems(p);
  return out.length ? `\n- Never put these pieces, or anything close to them, in an outfit: ${out.join('; ')}` : '';
}

/** What a picture may show, and the instruction that keeps ticked pieces out of it. */
export function picturePieces<T extends { color: string; item: string }>(p: Pick<Profile, 'guide' | 'capsuleOwned'>, pieces: T[]): { kept: T[]; rule: string } {
  const out = excludedItems(p);
  if (!out.length) return { kept: pieces, rule: '' };
  return {
    kept: pieces.filter((x) => !isExcluded(x, out)),
    rule: ` Do not show any of these items or anything that looks like them: ${out.join('; ')}. Fill any gap with a different piece that suits the outfit.`,
  };
}

/** A rewritten guide keeps the ticked pieces in its capsule, and the ticks follow them to their new places. */
export function keepExcluded(guide: Guide, excluded: string[]): { guide: Guide; owned: number[] } {
  const capsule = [...guide.capsule];
  const owned = excluded.map((item) => {
    const found = capsule.findIndex((c) => c.item.trim().toLowerCase() === item.trim().toLowerCase());
    if (found >= 0) return found;
    capsule.push({ item, category: 'owned' });
    return capsule.length - 1;
  });
  return { guide: { ...guide, capsule }, owned: [...new Set(owned)].sort((a, b) => a - b) };
}
