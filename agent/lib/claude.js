// Claude API wrapper
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function ask(prompt, { system, model = 'claude-haiku-4-5-20251001', maxTokens = 2000 } = {}) {
  const messages = [{ role: 'user', content: prompt }];
  const params = { model, max_tokens: maxTokens, messages };
  if (system) params.system = system;

  const res = await client.messages.create(params);
  return res.content[0].text;
}

export async function summarize(text, instruction = '以下を日本語で簡潔に要約してください。') {
  return ask(`${instruction}\n\n${text}`);
}
