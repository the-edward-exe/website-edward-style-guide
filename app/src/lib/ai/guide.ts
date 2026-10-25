import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { aiMode } from './mode';
import { DEMO_GUIDE } from './demo-guide';
import { GuideSchema, guidePrompt, type Guide } from '../guide';
import type { Profile } from '../profiles';

export async function generateGuide(p: Profile, photo: Buffer): Promise<Guide> {
  if (aiMode().claude === 'demo') {
    await new Promise((r) => setTimeout(r, Number(process.env.DEMO_DELAY_MS ?? 3000)));
    return DEMO_GUIDE;
  }
  const client = new Anthropic();
  const res = await client.messages.parse({
    model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
    max_tokens: 16000,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.toString('base64') } },
        { type: 'text', text: guidePrompt(p) },
      ],
    }],
    output_config: { effort: 'medium', format: zodOutputFormat(GuideSchema) },
  });
  if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error("THE GUIDE DIDN'T COME BACK. TRY AGAIN.");
  return res.parsed_output;
}
