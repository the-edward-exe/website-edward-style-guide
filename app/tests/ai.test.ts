import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateCharacterSheet, CHARACTER_SHEET_PROMPT } from '../src/lib/ai/gemini';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

function geminiReply(parts: object[]) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts } }] }), { status: 200 });
}

describe('generateCharacterSheet (live)', () => {
  it('decodes the returned image', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const fetchMock = vi.fn().mockResolvedValue(
      geminiReply([{ inlineData: { mimeType: 'image/png', data: Buffer.from('PNGDATA').toString('base64') } }]),
    );
    vi.stubGlobal('fetch', fetchMock);
    const out = await generateCharacterSheet(Buffer.from([1, 2, 3]));
    expect(out.toString()).toBe('PNGDATA');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.contents[0].parts[0].text).toBe(CHARACTER_SHEET_PROMPT);
    expect(body.generationConfig.imageConfig).toEqual({ aspectRatio: '3:4', imageSize: '2K' });
  });

  it('explains when no image comes back', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(geminiReply([{ text: 'sorry' }])));
    await expect(generateCharacterSheet(Buffer.from([1]))).rejects.toThrow('NO IMAGE CAME BACK. TRY ANOTHER PHOTO.');
  });

  it('passes on Google error messages', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'API key not valid' } }), { status: 400 }),
    ));
    await expect(generateCharacterSheet(Buffer.from([1]))).rejects.toThrow('API key not valid');
  });
});

describe('generateCharacterSheet (demo)', () => {
  it('returns a plain placeholder layout, not a photo', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    vi.stubEnv('DEMO_DELAY_MS', '0');
    const sharp = (await import('sharp')).default;
    const meta = await sharp(await generateCharacterSheet(Buffer.from([1]))).metadata();
    expect(meta.format).toBe('png');
    expect([meta.width, meta.height]).toEqual([1200, 1600]);
  });
});
