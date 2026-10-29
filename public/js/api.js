// ── GROQ API (raw — called only through GROQ_RL.enqueue) ──
async function _groqCallRaw(model, messages, maxTokens = 500, temp = 0.75) {
  const r = await fetch('/api/groq', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: temp, max_tokens: maxTokens })
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`Groq ${r.status}: ${t.slice(0,150)}`); }
  const d = await r.json();
  return (d.choices[0].message.content || '').trim();
}

// ── PUBLIC groqCall — all Groq requests go through the rate limiter ──
function groqCall(model, messages, maxTokens = 500, temp = 0.75, label = '') {
  const callLabel = label || `${model.split('-').slice(0,2).join('-')} · ${maxTokens}tok`;
  return GROQ_RL.enqueue(() => _groqCallRaw(model, messages, maxTokens, temp), callLabel);
}

// ── HF API (no rate limiter needed — HF throttles differently) ──
async function hfCall(model, messages, maxTokens = 500, temp = 0.6) {
  const r = await fetch('/api/hf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, temperature: temp, max_tokens: maxTokens })
  });
  if (!r.ok) { const t = await r.text(); throw new Error(`HF ${r.status}: ${t.slice(0,150)}`); }
  const d = await r.json();
  let content = (d.choices[0].message.content || '').trim();
  if (content.includes('<think>')) content = content.split('</think>').pop().trim();
  return content;
}

async function callModel(modelKey, messages) {
  const m = MODELS[modelKey];
  if (m.provider === 'groq') return groqCall(m.name, messages, 350, 0.78, `${m.label} · generate`);
  return hfCall(m.name, messages, 350, 0.65);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
