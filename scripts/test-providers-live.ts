import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { GeminiAdapter } from '../packages/ai/src';

async function main() {
  console.log('Testing GeminiAdapter with default gemini-3.8-flash...');
  const gemini = new GeminiAdapter(process.env.GEMINI_API_KEY, 'gemini-3.8-flash');
  const res = await gemini.generate({
    messages: [{ role: 'user', content: 'Say hello in 3 words' }],
    maxTokens: 20,
  });
  console.log('Gemini generate SUCCESS:', res.content.trim(), 'Model:', res.model);

  console.log('\nTesting GeminiAdapter streaming...');
  const stream = gemini.stream({
    messages: [{ role: 'user', content: 'Count from 1 to 3' }],
    maxTokens: 20,
  });
  let streamed = '';
  for await (const chunk of stream) {
    streamed += chunk.content;
  }
  console.log('Gemini stream SUCCESS:', streamed.trim());
}

main().catch(console.error);
