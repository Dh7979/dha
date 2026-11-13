// Supabase Edge Function: writes DHA's weekly review with Claude.
// The Anthropic API key lives only here, as the ANTHROPIC_API_KEY function secret.
// Only signed-in users of this project can call it (Supabase verifies the JWT).
import Anthropic from 'npm:@anthropic-ai/sdk';

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the function secrets

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', {headers: cors});
  try {
    const {prompt} = await req.json();
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 20000) {
      return Response.json({error: 'bad_prompt'}, {status: 400, headers: cors});
    }
    const response = await client.beta.messages.create({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: {effort: 'low'},
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{role: 'user', content: prompt}],
    });
    if (response.stop_reason === 'refusal') {
      return Response.json({error: 'refusal'}, {status: 422, headers: cors});
    }
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as {text: string}).text)
      .join('')
      .trim();
    return Response.json({text}, {headers: cors});
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return Response.json({error: 'rate_limited'}, {status: 429, headers: cors});
    }
    if (e instanceof Anthropic.APIError) {
      return Response.json({error: 'upstream', status: e.status}, {status: 502, headers: cors});
    }
    return Response.json({error: 'internal'}, {status: 500, headers: cors});
  }
});
