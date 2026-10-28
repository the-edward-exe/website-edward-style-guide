import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { aiMode, demoDelay } from './mode';
import { DEMO_LOOKS } from './demo-looks';
import { looksPrompt, looksSchemaFor, matchesSplit, orderBySplit, styleSplit, type Looks, type StyleSplit } from '../looks';
import type { Profile } from '../profiles';

/** Demo mode: the fixed looks, relabeled so they follow the person's split. */
function demoLooks(split: StyleSplit): Looks {
  const styles = split.flatMap((s) => Array<string>(s.count).fill(s.style));
  return { looks: DEMO_LOOKS.looks.map((l, i) => ({ ...l, style: styles[i] })) };
}

export async function generateLooks(p: Profile, photo: Buffer, signal?: AbortSignal): Promise<Looks> {
  const split = styleSplit(p.answers.styles);
  if (aiMode().claude === 'demo') {
    await demoDelay(signal);
    return demoLooks(split);
  }
  const client = new Anthropic();
  const schema = looksSchemaFor(split);
  let prompt = looksPrompt(p);
  let looks: Looks['looks'] = [];
  // The schema keeps every style to their tastes and the count at ten; the split per taste is checked here,
  // with one more try when it's off. A second miss is kept as is rather than failing the person.
  for (let tries = 0; tries < 2; tries++) {
    const res = await client.messages.parse({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-5-5',
      max_tokens: 8000,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photo.toString('base64') } },
          { type: 'text', text: prompt },
        ],
      }],
      output_config: { effort: 'low', format: zodOutputFormat(schema) },
    }, { signal });
    if (res.stop_reason === 'refusal' || !res.parsed_output) throw new Error("THE LOOKS DIDN'T COME BACK. TRY AGAIN.");
    looks = res.parsed_output.looks;
    if (matchesSplit(looks, split)) break;
    prompt += `\n\nYour last answer did not follow the split. Follow it exactly: ${split.map((s) => `${s.count} ${s.style}`).join(', ')}.`;
  }
  return { looks: orderBySplit(looks, split) };
}
