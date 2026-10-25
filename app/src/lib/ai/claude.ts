import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod/v4';
import { aiMode } from './mode';

export type SkinTone = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type PhotoRead = { skinTone: SkinTone; hair: string; eyes: string };

const PhotoReadSchema = z.object({
  skinTone: z.number().int().min(1).max(7),
  hair: z.string(),
  eyes: z.string(),
});

const PROMPT = `This photo is for a personal styling app. Describe the person's coloring so the app can pre-fill a questionnaire.

skinTone: pick the closest of seven swatches, 1 = very light (#F6DCC7), 2 = light (#EBC3A3), 3 = light-medium (#D9A57F), 4 = medium (#C08A62), 5 = medium-deep (#9C6A45), 6 = deep (#74482D), 7 = very deep (#4A2D1C). Judge the face in its natural light.
hair: the hair color in two or three plain words, for example "salt and pepper" or "dark brown". Use "none" if the head is shaved.
eyes: the eye color in one or two plain words, for example "brown" or "hazel". Use "unknown" if the eyes aren't visible.`;

export async function readPhoto(photo: Buffer): Promise<PhotoRead | null> {
  if (aiMode().claude === 'demo') return null;
  const client = new Anthropic();
  const res = await client.messages.parse({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.toString('base64') } },
        { type: 'text', text: PROMPT },
      ],
    }],
    output_config: { effort: 'low', format: zodOutputFormat(PhotoReadSchema) },
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) return null;
  return res.parsed_output as PhotoRead;
}
