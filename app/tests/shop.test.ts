import { describe, it, expect } from 'vitest';
import { amazonUrl } from '../src/lib/shop';

const search = (url: string) => new URL(url).searchParams.get('k');

describe('Amazon links', () => {
  const piece = { item: 'Chore coat', color: 'Olive & tan' };

  it('searches Amazon for the color and item', () => {
    const url = amazonUrl(piece);
    expect(url.startsWith('https://www.amazon.com/s?')).toBe(true);
    expect(search(url)).toBe('Olive & tan Chore coat');
  });

  it('uses the section the person shops', () => {
    expect(search(amazonUrl(piece, 'mens'))).toBe("men's Olive & tan Chore coat");
    expect(search(amazonUrl(piece, 'womens'))).toBe("women's Olive & tan Chore coat");
    expect(search(amazonUrl(piece, 'both'))).toBe('Olive & tan Chore coat');
  });
});
