import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { aiMode, demoDelay } from './mode';
import { DEMO_LOOKS } from './demo-looks';
import { WrittenOutfitSchema, WrittenOutfitsSchema, outfitsPrompt, replacementPrompt, type OutfitSlot, type WrittenOutfit } from '../outfits';
import type { Profile } from '../profiles';

/** Writes one new outfit for a spot whose outfit was removed. */
export async function generateReplacement(
  p: Profile, photo: Buffer, slot: { style: string; season?: string }, previous: string[], rejected: string, signal?: AbortSignal,
): Promise<WrittenOutfit> {
  if (aiMode().claude === 'demo') {
    await demoDelay(signal);
    const looks = DEMO_LOOKS.looks.map(({ style: _style, ...look }) => look);
    return looks.find((l) => l.name !== rejected && !previous.includes(l.name)) ?? looks.find((l) => l.name !== rejected) ?? looks[0];
  }
  const res = await new Anthropic().messages.parse({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    max_tokens: 2000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.toString('base64') } },
        { type: 'text', text: replacementPrompt(p, slot, previous, rejected) },
      ],
    }],
    output_config: { effort: 'low', format: zodOutputFormat(WrittenOutfitSchema) },
  }, { signal });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error("THE NEW OUTFIT DIDN'T COME BACK. TRY AGAIN.");
  return res.parsed_output;
}

/** Writes one outfit per slot, in slot order. */
export async function generateOutfits(p: Profile, photo: Buffer, slots: OutfitSlot[], previous: string[], signal?: AbortSignal): Promise<WrittenOutfit[]> {
  if (aiMode().claude === 'demo') {
    await demoDelay(signal);
    return DEMO_LOOKS.looks.map(({ style: _style, ...look }) => look);
  }
  const res = await new Anthropic().messages.parse({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.toString('base64') } },
        { type: 'text', text: outfitsPrompt(p, slots, previous) },
      ],
    }],
    output_config: { effort: 'low', format: zodOutputFormat(WrittenOutfitsSchema) },
  }, { signal });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error("THE OUTFITS DIDN'T COME BACK. TRY AGAIN.");
  return res.parsed_output.looks;
}
