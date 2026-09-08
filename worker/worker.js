/**
 * Chester-Nutricio · proxy IA
 * -----------------------------------------------------------------
 * Worker de Cloudflare que fa de pont entre la app estàtica (index.html,
 * servida via GitHub Pages) i l'API de Anthropic.
 *
 * La API key REAL viu només aquí, com a secret del Worker
 * (wrangler secret put ANTHROPIC_API_KEY). Mai al repo, mai al navegador.
 *
 * Capes de protecció (pragmàtiques, no militars — app d'ús personal):
 *  1. CORS restringit a l'origen configurat (ALLOWED_ORIGIN).
 *  2. Clau d'aplicació opcional (X-App-Key) per filtrar bots que trobin
 *     la URL però no la clau — no és un secret fort (viatja al JS del
 *     client), és fricció extra, no seguretat real.
 *  3. Whitelist de models permesos + límit dur de max_tokens, perquè
 *     encara que algú manipuli el body de la petició no pugui disparar
 *     la factura.
 *  4. Per a protecció real contra abús (algú fent servir la URL fora
 *     del navegador), activa "Rate Limiting Rules" al dashboard de
 *     Cloudflare sobre la ruta d'aquest Worker (pla gratuït ho permet).
 */

const DEFAULT_ALLOWED_MODELS = 'claude-sonnet-5,claude-haiku-4-5-20251001';
const DEFAULT_MAX_TOKENS_CAP = 1024;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = isAllowedOrigin(origin, env.ALLOWED_ORIGIN);

    const corsHeaders = {
      'Access-Control-Allow-Origin': allowed ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-App-Key',
      'Vary': 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    if (!allowed) {
      return new Response('Forbidden origin', { status: 403, headers: corsHeaders });
    }

    if (env.APP_SHARED_SECRET) {
      const key = request.headers.get('X-App-Key');
      if (key !== env.APP_SHARED_SECRET) {
        return new Response('Forbidden', { status: 403, headers: corsHeaders });
      }
    }

    if (!env.ANTHROPIC_API_KEY) {
      return new Response('Worker mal configurat: falta ANTHROPIC_API_KEY', { status: 500, headers: corsHeaders });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
    }

    const allowedModels = (env.ALLOWED_MODELS || DEFAULT_ALLOWED_MODELS).split(',').map(s => s.trim());
    if (!allowedModels.includes(body.model)) {
      return new Response(`Model no permès. Permesos: ${allowedModels.join(', ')}`, { status: 400, headers: corsHeaders });
    }

    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response('Falten missatges', { status: 400, headers: corsHeaders });
    }

    const maxTokensCap = parseInt(env.MAX_TOKENS_CAP || String(DEFAULT_MAX_TOKENS_CAP), 10);
    const safeBody = {
      model: body.model,
      max_tokens: Math.min(Number(body.max_tokens) || 512, maxTokensCap),
      messages: body.messages.slice(-20),
    };
    if (typeof body.system === 'string') {
      safeBody.system = body.system.slice(0, 4000);
    }

    let upstream;
    try {
      upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(safeBody),
      });
    } catch (err) {
      return new Response('Error connectant amb Anthropic', { status: 502, headers: corsHeaders });
    }

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};

function isAllowedOrigin(origin, allowedEnv) {
  if (!allowedEnv || allowedEnv === '*') return true;
  return allowedEnv.split(',').map(s => s.trim()).includes(origin);
}
