const SECTION_WORD: Record<string, string> = { mens: "men's", womens: "women's" };

/** An Amazon search for one clothing item, in its color and the section the person shops. */
export function amazonUrl(piece: { item: string; color: string }, section?: string): string {
  const words = [section && SECTION_WORD[section], piece.color, piece.item].filter(Boolean).join(' ');
  return `https://www.amazon.com/s?${new URLSearchParams({ k: words })}`;
}
