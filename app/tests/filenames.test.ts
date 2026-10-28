import { describe, it, expect } from 'vitest';
import { downloadName } from '../src/lib/filenames';

describe('downloadName', () => {
  it('slugs the person and kind', () => {
    expect(downloadName('Ana María', 'character-sheet')).toBe('ana-mar-a-character-sheet.png');
  });
  it('appends a version', () => {
    expect(downloadName('Ana María', 'character-sheet', 2)).toBe('ana-mar-a-character-sheet-2.png');
  });
});
