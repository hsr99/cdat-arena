import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.mjs';

async function fixture(t, options = {}) {
  const app = createApp(options);
  await new Promise(resolve => app.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => app.close(resolve)));
  const base = `http://127.0.0.1:${app.address().port}`;
  const chat = { model: 'llama-3.1-8b-instant', messages: [{ role: 'user', content: 'Test' }], max_tokens: 350, temperature: 0.78 };
  const post = (body = chat, headers = {}) => fetch(`${base}/api/groq`, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { base, chat, post };
}

test('serves only public assets, never configuration or server source', async t => {
  const { base } = await fixture(t);
  for (const path of ['/', '/css/styles.css', '/js/api.js']) assert.equal((await fetch(base + path)).status, 200);
  for (const path of ['/.env', '/server/app.mjs', '/%2e%2e%2fserver/app.mjs', '/package.json']) assert.equal((await fetch(base + path)).status, 404);
});
test('missing configuration is actionable and performs no upstream calls', async t => {
  const { post } = await fixture(t, { env: {}, fetchImpl: () => { assert.fail('Must not call provider'); } });
  assert.equal((await post()).status, 503);
});
test('rejects foreign origins and Host headers', async t => {
  const { post, base } = await fixture(t);
  assert.equal((await post(undefined, { Origin: 'https://example.invalid' })).status, 403);
  assert.equal((await post(undefined, { Origin: '' })).status, 403);
  const status = await new Promise(resolve => { const req = http.get(base, { headers: { Host: 'foreign.invalid:3000' } }, res => { res.resume(); resolve(res.statusCode); }); });
  assert.equal(status, 403);
});
test('forwards only allowed model parameters and keeps credentials server-side', async t => {
  let seen;
  const { post, chat } = await fixture(t, { env: { GROQ_API_KEY: 'unit-test-placeholder' }, fetchImpl: async (url, options) => {
    seen = { url, options };
    return Response.json({ choices: [{ message: { content: 'mock completion' } }], private_metadata: 'not relayed' });
  } });
  const r = await post({ ...chat, extra: 'discard me' });
  assert.equal(r.status, 200);
  const body = await r.text();
  assert.ok(!body.includes('unit-test-placeholder'));
  assert.ok(!body.includes('private_metadata'));
  assert.equal(seen.options.headers.Authorization, 'Bearer unit-test-placeholder');
  assert.deepEqual(JSON.parse(seen.options.body), chat);
  assert.equal(seen.url, 'https://api.groq.com/openai/v1/chat/completions');
});
test('invalid model and parameters never reach provider', async t => {
  const { post, chat } = await fixture(t, { env: { GROQ_API_KEY: 'placeholder' }, fetchImpl: () => assert.fail('Must not forward') });
  assert.equal((await post({ ...chat, model: 'unapproved-model' })).status, 400);
  assert.equal((await post({ ...chat, max_tokens: 0 })).status, 400);
  assert.equal((await post({ ...chat, messages: [{ role: 'user', content: 5 }] })).status, 400);
});
test('upstream errors are redacted', async t => {
  const { post } = await fixture(t, { env: { GROQ_API_KEY: 'placeholder' }, fetchImpl: async () => new Response('private upstream error', { status: 429 }) });
  const r = await post();
  assert.equal(r.status, 429);
  assert.ok(!(await r.text()).includes('private upstream error'));
});
test('HF route preserves its configured endpoint and response content', async t => {
  const { base } = await fixture(t, { env: { HF_TOKEN: 'placeholder' }, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://router.huggingface.co/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer placeholder');
    return Response.json({ choices: [{ message: { content: '<think>mock</think>story' } }] });
  } });
  const r = await fetch(base + '/api/hf', { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'deepseek-ai/DeepSeek-R1:fastest', messages: [{ role: 'user', content: 'Test' }], max_tokens: 350, temperature: 0.65 }) });
  assert.equal(r.status, 200);
  assert.equal((await r.json()).choices[0].message.content, '<think>mock</think>story');
});
