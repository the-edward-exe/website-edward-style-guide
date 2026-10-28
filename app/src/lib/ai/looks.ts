import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { aiMode, demoDelay } from './mode';
import { DEMO_LOOKS } from './demo-looks';
import { LooksSchema, looksPrompt, type Looks } from '../looks';
import type { Profile } from '../profiles';

export async function generateLooks(p: Profile, photo: Buffer, signal?: AbortSignal): Promise<Looks> {
  if (aiMode().claude === 'demo') {
    await demoDelay(signal);
    return DEMO_LOOKS;
  }
  const client = new Anthropic();
  const res = await client.messages.parse({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    max_tokens: 8000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.toString('base64') } },
        { type: 'text', text: looksPrompt(p) },
      ],
    }],
    output_config: { effort: 'low', format: zodOutputFormat(LooksSchema) },
  }, { signal });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error("THE LOOKS DIDN'T COME BACK. TRY AGAIN.");
  return res.parsed_output;
}
