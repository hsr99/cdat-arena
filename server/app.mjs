import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PUBLIC = resolve(fileURLToPath(new URL('../public/', import.meta.url)));
const PROVIDERS = {
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', key: 'GROQ_API_KEY', models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile'] },
  hf: { url: 'https://router.huggingface.co/v1/chat/completions', key: 'HF_TOKEN', models: ['Qwen/Qwen2.5-7B-Instruct:fastest', 'deepseek-ai/DeepSeek-R1:fastest'] },
};
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
function json(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

// Dependency injection permits offline tests. No mock mode is exposed in the UI.
export function createApp({ env = process.env, fetchImpl = fetch } = {}) {
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    // Bind to loopback AND reject foreign Host headers (DNS rebinding protection).
    const host = req.headers.host || '';
    if (!/^127\.0\.0\.1:\d+$/.test(host)) return json(res, 403, { error: 'Use the printed 127.0.0.1 address.' });
    let url;
    try { url = new URL(req.url, `http://${host}`); }
    catch { return json(res, 400, { error: 'Invalid URL.' }); }
    if (url.pathname === '/api/status' && req.method === 'GET') {
      return json(res, 200, { configured: Boolean(env.GROQ_API_KEY && env.HF_TOKEN) });
    }
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'POST') return json(res, 405, { error: 'POST required.' });
      if (req.headers.origin !== `http://${host}` || req.headers['sec-fetch-site'] === 'cross-site') {
        return json(res, 403, { error: 'Same-origin local requests only.' });
      }
      if (!(req.headers['content-type'] || '').startsWith('application/json')) return json(res, 415, { error: 'JSON required.' });
      const provider = PROVIDERS[url.pathname.slice(5)];
      if (!provider) return json(res, 404, { error: 'Unknown provider.' });
      const key = env[provider.key];
      if (!key) return json(res, 503, { error: `Set ${provider.key} in your local .env file and restart the server.` });
      let raw = '';
      try {
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 256 * 1024) return json(res, 413, { error: 'Request too large.' });
        }
        const body = JSON.parse(raw);
        if (!provider.models.includes(body.model) || !Array.isArray(body.messages) || !body.messages.length ||
            body.messages.some(m => !m || !['system', 'user', 'assistant'].includes(m.role) || typeof m.content !== 'string') ||
            !Number.isInteger(body.max_tokens) || body.max_tokens < 1 || body.max_tokens > 8192 ||
            !Number.isFinite(body.temperature) || body.temperature < 0 || body.temperature > 2) {
          return json(res, 400, { error: 'Invalid model or chat parameters.' });
        }
        const upstream = await fetchImpl(provider.url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: body.model, messages: body.messages, temperature: body.temperature, max_tokens: body.max_tokens }),
          signal: AbortSignal.timeout(120_000),
        });
        // Never relay raw upstream errors: they can echo request data or credentials.
        if (!upstream.ok) return json(res, upstream.status, { error: `Provider returned HTTP ${upstream.status}. Check model access, quota and local credentials.` });
        const data = await upstream.json();
        const content = data?.choices?.[0]?.message?.content;
        if (typeof content !== 'string') return json(res, 502, { error: 'Provider returned no text completion.' });
        return json(res, 200, { choices: [{ message: { content } }] });
      } catch (error) {
        return json(res, error instanceof SyntaxError ? 400 : 502, { error: error instanceof SyntaxError ? 'Invalid JSON.' : 'Provider request failed or timed out.' });
      }
    }
    if (!['GET', 'HEAD'].includes(req.method)) return json(res, 405, { error: 'Method not allowed.' });
    let path;
    try { path = resolve(PUBLIC, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); }
    catch { return json(res, 400, { error: 'Invalid path.' }); }
    if (!path.startsWith(PUBLIC + sep) || !TYPES[extname(path)]) return json(res, 404, { error: 'Not found.' });
    try {
      const bytes = await readFile(path);
      res.writeHead(200, { 'Content-Type': TYPES[extname(path)], 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch { json(res, 404, { error: 'Not found.' }); }
  });
}
