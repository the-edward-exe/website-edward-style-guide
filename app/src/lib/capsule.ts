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

export type CapsuleGroupKey = 'tops' | 'bottoms' | 'shoes' | 'accessories';

const GROUPS: { key: CapsuleGroupKey; label: string }[] = [
  { key: 'tops', label: 'Tops' },
  { key: 'bottoms', label: 'Bottoms' },
  { key: 'shoes', label: 'Shoes' },
  { key: 'accessories', label: 'Accessories' },
];

const SHOES = /\b(shoes?|footwear|sneakers?|trainers?|boots?|loafers?|sandals?|heels?|flats?|mules?|chukkas?|oxfords? shoes?|derbys?|slides?)\b/;
const BOTTOMS = /\b(bottoms?|trousers?|pants?|jeans?|denim|chinos?|shorts?|skirts?|joggers?|leggings?|sweatpants?|slacks?)\b/;
const ACCESSORIES = /\b(accessor(y|ies)|bags?|totes?|belts?|watch(es)?|jewel(le)?ry|chains?|necklaces?|rings?|bracelets?|earrings?|hats?|caps?|beanies?|scarf|scarves|sunglasses|glasses|eyewear|ties?|socks?|gloves?)\b/;
const TOPS = /\b(tops?|outer(wear)?|tailoring|shirts?|knits?|knitwear|dress(es)?|jackets?|coats?|sweaters?|sweatshirts?|hoodies?|blazers?|tees?|t-shirts?|blouses?|cardigans?|vests?)\b/;

/** Which of the four capsule groups a piece sits in: by its category, or by its name when the category is vague. */
export function capsuleGroup(piece: { category: string; item: string }): CapsuleGroupKey {
  const sort = (text: string): CapsuleGroupKey | null => {
    const t = text.toLowerCase();
    if (SHOES.test(t)) return 'shoes';
    if (ACCESSORIES.test(t)) return 'accessories';
    if (BOTTOMS.test(t)) return 'bottoms';
    if (TOPS.test(t)) return 'tops';
    return null;
  };
  return sort(piece.category) ?? sort(piece.item) ?? 'tops';
}

/** The capsule in Tops, Bottoms, Shoes, Accessories order. Each piece keeps its index in the guide's list. */
export function groupCapsule<T extends { category: string; item: string }>(capsule: T[]) {
  const indexed = capsule.map((c, index) => ({ ...c, index }));
  return GROUPS.map((g) => ({ ...g, pieces: indexed.filter((c) => capsuleGroup(c) === g.key) })).filter((g) => g.pieces.length > 0);
}
