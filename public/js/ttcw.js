// ── TTCW ──
function buildTTCWPrompt(narrative, turn, metrics, cdat) {
  const m = (key, def = 0.0) => parseFloat((metrics[key] || def)).toFixed(3);
  const novelty       = m('Novelty');
  const surprise      = m('Surprise');
  const semantic_div  = m('Semantic_Diversity');
  const momentum      = m('Coherence');
  const coherence     = m('Coherence');
  const cc            = m('Conversation_Completeness');
  const cr            = m('Conversation_Relevancy');
  const ia            = m('Instruction_Absorption');
  const kr            = m('Knowledge_Retention');
  const effective_novelty = cdat.effective_novelty !== undefined ? parseFloat(cdat.effective_novelty).toFixed(3) : novelty;
  const grounded      = cdat.grounded !== undefined ? cdat.grounded : true;

  return `You are an expert creative-writing evaluator.
Evaluate the latest story turn using TTCW dimensions.

NARRATIVE CONTEXT:
${narrative}

CURRENT TURN:
${turn}

METRIC SIGNALS:
- Novelty: ${novelty}
- Surprise: ${surprise}
- Semantic Diversity: ${semantic_div}
- Narrative Momentum: ${momentum}
- Coherence: ${coherence}
- Conversation Completeness: ${cc}
- Conversation Relevancy: ${cr}
- Instruction Absorption: ${ia}
- Knowledge Retention: ${kr}
- Effective Novelty (CDAT): ${effective_novelty}
- Grounded: ${grounded}

TTCW DIMENSIONS:
1. Originality  
Use Novelty + Surprise, but reduce if CR or IA is low.
2. Fluency  
Use Conversation Completeness + Narrative Momentum.
3. Flexibility  
Use Semantic Diversity and variation in direction.
4. Elaboration  
Use Narrative Momentum + Coherence + Knowledge Retention.

IMPORTANT:
- Metrics are signals, not definitions.
- If grounded = False → treat novelty as unreliable.
- Add failure_flag if signal is misleading.

Return ONLY valid JSON, no markdown:
{
  "originality": {
    "score": <integer 1 to 5>,
    "justification": {
      "signals": {"novelty": ${novelty}, "surprise": ${surprise}, "cr": ${cr}, "ia": ${ia}},
      "reasoning": "...",
      "failure_flag": false
    }
  },
  "fluency": {
    "score": <integer 1 to 5>,
    "justification": {
      "signals": {"cc": ${cc}, "momentum": ${momentum}},
      "reasoning": "...",
      "failure_flag": false
    }
  },
  "flexibility": {
    "score": <integer 1 to 5>,
    "justification": {
      "signals": {"semantic_diversity": ${semantic_div}},
      "reasoning": "...",
      "failure_flag": false
    }
  },
  "elaboration": {
    "score": <integer 1 to 5>,
    "justification": {
      "signals": {"momentum": ${momentum}, "coherence": ${coherence}, "kr": ${kr}},
      "reasoning": "...",
      "failure_flag": false
    }
  }
}`;
}

async function runTTCWForModel(modelKey) {
  const logs = STATE.turnLogs;
  if (!logs.length) return null;

  const aggMetrics = {};
  ALL_METRICS.forEach(met => {
    const vals = logs.filter(l => l.metrics?.[modelKey]?.[met] != null).map(l => l.metrics[modelKey][met]);
    aggMetrics[met] = vals.length ? vals.reduce((a,b) => a+b,0)/vals.length : 5;
  });

  const narrative = STATE.globalSummaries.join(' ') || STATE.seed.situation;
  const lastTurn = logs[logs.length-1];
  const lastText = lastTurn.texts?.[modelKey] || '';
  const cdat = {
    effective_novelty: aggMetrics['Novelty'],
    grounded: (lastTurn.gates?.[modelKey]?.result === 'PASS'),
  };

  const prompt = buildTTCWPrompt(narrative, lastText, aggMetrics, cdat);

  try {
    const raw = await groqCall('llama-3.3-70b-versatile', [{ role:'user', content:prompt }], 700, 0.2, `TTCW·${modelKey}`);
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
    TTCW_DIMS.forEach(dim => {
      if (parsed[dim]) parsed[dim].score = Math.min(5, Math.max(1, parseInt(parsed[dim].score) || 3));
    });
    return parsed;
  } catch (e) {
    console.error(`TTCW error for ${modelKey}:`, e);
    return Object.fromEntries(TTCW_DIMS.map(d => [d, { score: 3, justification: { signals:{}, reasoning:'Evaluation unavailable.', failure_flag: false } }]));
  }
}

async function runAllTTCW() {
  const results = {};
  for (const k of Object.keys(MODELS)) {
    setStatus(`TTCW — evaluating ${MODELS[k].label}…`);
    results[k] = await runTTCWForModel(k);
    await sleep(300);
  }
  STATE.ttcwResults = results;
  return results;
}

function renderTTCWSection(results) {
  const sv = document.getElementById('storyView');

  const sec = document.createElement('div');
  sec.className = 'ttcw-section';
  sec.id = 'ttcwSection';

  const totals = {};
  Object.keys(MODELS).forEach(k => {
    totals[k] = results[k] ? TTCW_DIMS.reduce((s,d) => s + (results[k][d]?.score||0), 0) : 0;
  });
  const ttcwWinner = Object.entries(totals).sort((a,b) => b[1]-a[1])[0];

  sec.innerHTML = `
    <div class="ttcw-title">
      <span>🧠</span> TTCW — Torrance Test for Creative Writing
      <div class="badge" style="background:rgba(179,136,255,0.12);border-color:rgba(179,136,255,0.3);color:var(--purple);">post-battle</div>
    </div>
    <div class="ttcw-sub">Evaluating all 4 models across Originality · Fluency · Flexibility · Elaboration (1–5 each). Scores are derived from aggregated CDAT metrics with signal-aware reasoning.</div>
    <div class="ttcw-grid" id="ttcwGrid"></div>
    <div class="ttcw-winner-bar">
      <div class="ttcw-winner-trophy">🏆</div>
      <div class="ttcw-winner-info">
        <div class="ttcw-winner-name" style="color:${MODELS[ttcwWinner[0]].color}">${MODELS[ttcwWinner[0]].label} — TTCW Champion</div>
        <div class="ttcw-winner-detail">${MODELS[ttcwWinner[0]].name} · Total TTCW Score: ${ttcwWinner[1]}/20 · ${Object.entries(totals).map(([k,v]) => `${MODELS[k].label}: ${v}`).join(' · ')}</div>
      </div>
    </div>
  `;
  sv.appendChild(sec);

  const grid = document.getElementById('ttcwGrid');
  Object.keys(MODELS).forEach(k => {
    const r = results[k];
    if (!r) return;
    const total = TTCW_DIMS.reduce((s,d) => s + (r[d]?.score||0), 0);
    const isChamp = k === ttcwWinner[0];

    const card = document.createElement('div');
    card.className = 'ttcw-model-block';
    if (isChamp) card.style.boxShadow = `0 0 0 2px ${MODELS[k].color}`;

    card.innerHTML = `
      <div class="ttcw-model-header" style="background:${MODELS[k].color2}">
        <div style="width:8px;height:8px;border-radius:2px;background:${MODELS[k].color}"></div>
        <span style="color:${MODELS[k].color}">${MODELS[k].label}</span>
        ${isChamp ? '<span style="margin-left:auto;font-size:9px;color:var(--amber)">★ TTCW WINNER</span>' : ''}
      </div>
      <div class="ttcw-dims">
        ${TTCW_DIMS.map(dim => {
          const dimData = r[dim];
          const score = dimData?.score || 0;
          const reason = dimData?.justification?.reasoning || '';
          const flag = dimData?.justification?.failure_flag;
          const pct = (score/5*100).toFixed(0);
          const colorMap = { originality:'#ff79c6', fluency:'#5b9cf6', flexibility:'#00d4aa', elaboration:'#ffb347' };
          const stars = '★'.repeat(score) + '☆'.repeat(5-score);
          return `
            <div class="ttcw-dim">
              <div class="ttcw-dim-header">
                <div class="ttcw-dim-name">${dim}</div>
                <div class="ttcw-dim-score" style="color:${colorMap[dim]}">${score}<span style="font-size:9px;color:var(--text3)">/5</span></div>
              </div>
              <div class="ttcw-dim-stars" style="color:${colorMap[dim]}">${stars.split('').map(s => `<span class="ttcw-star">${s}</span>`).join('')}</div>
              <div class="ttcw-dim-bar-wrap"><div class="ttcw-dim-bar" style="width:${pct}%;background:${colorMap[dim]}"></div></div>
              ${reason ? `<div class="ttcw-dim-reasoning">${reason.slice(0,120)}${reason.length>120?'…':''}</div>` : ''}
              ${flag ? `<div class="ttcw-flag">⚑ signal unreliable</div>` : ''}
            </div>
          `;
        }).join('')}
        <div class="ttcw-total-row">
          <div class="ttcw-total-label">Total TTCW</div>
          <div class="ttcw-total-val" style="color:${MODELS[k].color}">${total}<span style="font-size:9px;color:var(--text3)">/20</span></div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  sec.scrollIntoView({ behavior:'smooth', block:'start' });
  updateTTCWSidePanel(results, totals);
}

function updateTTCWSidePanel(results, totals) {
  const panel = document.getElementById('ttcwSidePanel');
  const content = document.getElementById('ttcwSideContent');
  panel.style.display = 'block';

  const sorted = Object.entries(totals).sort((a,b) => b[1]-a[1]);
  content.innerHTML = sorted.map(([k, total]) => `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
      <div style="width:6px;height:6px;border-radius:2px;background:${MODELS[k].color};flex-shrink:0;"></div>
      <div style="font-size:10px;color:${MODELS[k].color};flex:1;">${MODELS[k].label}</div>
      <div style="font-family:var(--syne);font-size:14px;font-weight:700;color:${MODELS[k].color}">${total}<span style="font-size:8px;color:var(--text3)">/20</span></div>
    </div>
    <div style="display:flex;gap:4px;margin-bottom:10px;">
      ${TTCW_DIMS.map(d => {
        const score = results[k]?.[d]?.score || 0;
        const colors = {originality:'#ff79c6',fluency:'#5b9cf6',flexibility:'#00d4aa',elaboration:'#ffb347'};
        return `<div style="flex:1;height:4px;background:${colors[d]};opacity:${0.2+score/6.25};border-radius:2px;" title="${d}: ${score}/5"></div>`;
      }).join('')}
    </div>
  `).join('');
}
