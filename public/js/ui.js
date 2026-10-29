// ── STAGE ──
function activateStage(n) {
  [0,1,2,3,4,5,6,7].forEach(i => {
    const el = document.getElementById('ps' + i);
    if (!el) return;
    el.classList.remove('s-active','s-done');
    if (i < n) el.classList.add('s-done');
    if (i === n) el.classList.add('s-active');
  });
}

function setStatus(txt, note = '', noteType = '') {
  document.getElementById('statusSec').style.display = 'block';
  document.getElementById('statusTxt').textContent = txt;
  const n = document.getElementById('stageNote');
  n.textContent = note;
  n.className = 'stage-note' + (noteType ? ' ' + noteType : '');
}

function buildTurnDots(n) {
  const wrap = document.getElementById('turnDots');
  wrap.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'turn-dot' + (i === 0 ? ' td-active' : '');
    d.id = 'td-' + i; d.textContent = i + 1;
    d.onclick = () => document.getElementById('ts-' + i)?.scrollIntoView({ behavior:'smooth', block:'start' });
    wrap.appendChild(d);
  }
}

function updateTurnDot(i, winner) {
  const d = document.getElementById('td-' + i);
  if (!d) return;
  d.classList.remove('td-active');
  d.classList.add(winner ? 'td-win' : 'td-mixed');
  const next = document.getElementById('td-' + (i+1));
  if (next) next.classList.add('td-active');
}

function updateLeaderboard() {
  const scores = STATE.totalScores;
  const sorted = Object.entries(scores).sort((a,b) => b[1]-a[1]);
  const max = sorted[0]?.[1] || 1;
  const leader = sorted[0]?.[0] || '—';
  document.getElementById('statLeader').textContent = leader;
  document.getElementById('statLeader').style.color = MODELS[leader]?.color || 'var(--teal)';

  const lb = document.getElementById('lbDisplay');
  const ranks = ['🥇','🥈','🥉',''];
  lb.innerHTML = sorted.map(([k, total], i) => `
    <div class="lb-row">
      <div class="lb-rank ${i===0?'r1':i===1?'r2':i===2?'r3':''}">${ranks[i]||''} ${i+1}</div>
      <div class="lb-name" style="color:${MODELS[k].color}">${MODELS[k].label}<br><span style="font-size:9px;color:var(--text3)">${STATE.turnWins[k]} turn wins</span></div>
      <div class="lb-score" style="color:${MODELS[k].color}">${total}</div>
      <div class="lb-bar-wrap"><div class="lb-bar" style="width:${(total/Math.max(max,1)*100).toFixed(0)}%;background:${MODELS[k].color}"></div></div>
    </div>
  `).join('');
}

function updateMetricMini() {
  const accum = STATE.metricAccum;
  const turnCount = STATE.currentTurn + 1;
  if (turnCount === 0) return;

  const avg = (k, m) => {
    const v = accum[k][m];
    if (!v || v.count === 0) return 0;
    return (v.sum / v.count).toFixed(1);
  };

  const groups = [
    { label:'Single-Turn', metrics:SINGLE_METRICS },
    { label:'Multi-Turn',  metrics:MULTI_METRICS },
  ];

  document.getElementById('metricMiniDisplay').innerHTML = groups.map(g => `
    <div style="margin-bottom:10px;">
      <div class="mg-label">${g.label}</div>
      ${g.metrics.map(m => `
        <div class="mini-metric">
          <div class="mm-name">${m.replace(/_/g,' ')}</div>
          <div class="mm-bars">
            ${Object.keys(MODELS).map(k => {
              const v = parseFloat(avg(k, m));
              return `<div class="mm-seg" style="background:${MODELS[k].color};opacity:${0.3+v/14}" title="${MODELS[k].label}: ${v}"></div>`;
            }).join('')}
          </div>
          <div class="mm-vals">
            ${Object.keys(MODELS).map(k => `<div class="mm-v" style="color:${MODELS[k].color}">${avg(k,m)}</div>`).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function buildTurnSection(turnIdx) {
  const sec = document.createElement('div');
  sec.className = 'turn-section';
  sec.id = 'ts-' + turnIdx;
  const hdr = document.createElement('div');
  hdr.className = 'turn-section-header';
  hdr.innerHTML = `
    <div class="ts-num">TURN ${String(turnIdx+1).padStart(2,'0')}</div>
    <div class="ts-badge ts-processing" id="tswinner-${turnIdx}">running…</div>
  `;
  const grid = document.createElement('div');
  grid.className = 'arena-grid';
  grid.id = 'ag-' + turnIdx;

  Object.keys(MODELS).forEach(k => {
    const card = document.createElement('div');
    card.className = `model-battle-card`;
    card.id = `mbc-${turnIdx}-${k}`;
    card.innerHTML = `
      <div class="mbc-header">
        <div class="mbc-label" style="color:${MODELS[k].color}">${MODELS[k].label}</div>
        <div class="mbc-pill pill-running" id="pill-${turnIdx}-${k}">generating…</div>
      </div>
      <div id="mbcbody-${turnIdx}-${k}">
        <div class="mbc-gen"><div class="gen-spin"></div>${MODELS[k].name}</div>
      </div>
    `;
    grid.appendChild(card);
  });

  sec.appendChild(hdr);
  sec.appendChild(grid);
  return sec;
}

function populateModelCard(turnIdx, modelKey, data) {
  const { text, gate, gateReason, metrics, pac, isWinner } = data;
  const isPass = gate === 'PASS';
  const k = modelKey;

  const pill = document.getElementById(`pill-${turnIdx}-${k}`);
  if (pill) {
    pill.textContent = isWinner ? '★ WINNER' : (isPass ? '✓ PASS' : '✗ FAIL');
    pill.className = 'mbc-pill ' + (isWinner ? 'pill-winner' : isPass ? 'pill-pass' : 'pill-fail');
  }

  const card = document.getElementById(`mbc-${turnIdx}-${k}`);
  if (card) { card.classList.add(isPass ? 'mbc-pass' : 'mbc-fail'); if (isWinner) card.classList.add('mbc-winner'); }

  const body = document.getElementById(`mbcbody-${turnIdx}-${k}`);
  if (!body) return;

  const t = totalScore(metrics);

  const metricsHtml = metrics ? `
    <div class="metrics-bar">
      <div class="metrics-bar-title">Single-Turn</div>
      ${SINGLE_METRICS.map(m => `
        <div class="metric-row">
          <div class="mr-label">${m.replace(/_/g,' ')}</div>
          <div class="mr-bar-wrap"><div class="mr-bar" style="width:${(metrics[m]||0)*10}%;background:${METRIC_COLORS[m]}"></div></div>
          <div class="mr-val">${metrics[m]||0}</div>
        </div>
      `).join('')}
      <div class="metrics-bar-title" style="margin-top:8px;">Multi-Turn</div>
      ${MULTI_METRICS.map(m => `
        <div class="metric-row">
          <div class="mr-label">${m.replace(/_/g,' ')}</div>
          <div class="mr-bar-wrap"><div class="mr-bar" style="width:${(metrics[m]||0)*10}%;background:${METRIC_COLORS[m]}"></div></div>
          <div class="mr-val">${metrics[m]||0}</div>
        </div>
      `).join('')}
      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:6px;border-top:1px solid var(--border);">
        <div style="font-size:9px;color:var(--text3)">Total Score</div>
        <div style="font-family:var(--syne);font-size:15px;font-weight:700;color:${MODELS[k].color}">${t}<span style="font-size:9px;color:var(--text3)">/100</span></div>
      </div>
      <div class="metric-row" style="margin-top:4px;">
        <div class="mr-label">PAC Branching</div>
        <div class="mr-bar-wrap"><div class="mr-bar" style="width:${(pac||0)*100}%;background:#b388ff"></div></div>
        <div class="mr-val">${(pac||0).toFixed(2)}</div>
      </div>
    </div>` : (!isPass ? '<div style="padding:8px 12px;font-size:9px;color:var(--red)">Metrics skipped (FAIL)</div>' : '');

  const failNote = !isPass ? `<div class="fail-note">✕ ${gateReason || 'Narrative incoherence detected.'}<br><span style="font-size:8.5px;color:var(--text3)">↳ Not added to story context</span></div>` : '';

  const logRows = metrics ? ALL_METRICS.map(m => `<tr><td style="color:var(--text3)">${m}</td><td><span class="code-val">${metrics[m]}</span></td></tr>`).join('') : '';

  body.innerHTML = `
    <div class="mbc-text" id="mbctxt-${turnIdx}-${k}"></div>
    ${failNote}
    ${metricsHtml}
    <div class="log-toggle" id="lgt-${turnIdx}-${k}" onclick="toggleLog('${turnIdx}-${k}')">
      <span class="lt-arrow">▶</span>
      <span>Inspect log</span>
      ${metrics ? `<span style="margin-left:4px;font-size:8px;color:${MODELS[k].color}">· ${t}pts</span>` : ''}
    </div>
    <div class="log-body" id="lgb-${turnIdx}-${k}">
      <table class="log-table">
        <thead><tr><th>Metric</th><th>Score</th></tr></thead>
        <tbody>
          <tr><td style="color:var(--text3)">gate</td><td><span style="color:${isPass?'var(--teal)':'var(--red)'};font-size:9px">${gate}</span></td></tr>
          <tr><td style="color:var(--text3)">pac_branching</td><td><span class="code-val">${(pac||0).toFixed(4)}</span></td></tr>
          ${logRows}
        </tbody>
      </table>
    </div>
  `;

  const el = document.getElementById(`mbctxt-${turnIdx}-${k}`);
  if (el) animateText(el, text || '[No response]', MODELS[k].color);
}

function toggleLog(id) {
  const b = document.getElementById('lgb-' + id);
  const tg = document.getElementById('lgt-' + id);
  if (!b) return;
  const o = b.classList.contains('open');
  b.classList.toggle('open', !o);
  tg.classList.toggle('open', !o);
}

async function animateText(el, text, cursorColor = '#00d4aa') {
  el.innerHTML = '';
  const cursor = document.createElement('span');
  cursor.className = 'cursor-blink';
  cursor.style.background = cursorColor;
  el.appendChild(cursor);
  const chunk = 4;
  const delay = Math.max(4, Math.floor(1800 / text.length));
  for (let i = 0; i < text.length; i += chunk) {
    el.insertBefore(document.createTextNode(text.slice(i, i+chunk)), cursor);
    if (i % 40 === 0) await sleep(delay * chunk);
  }
  cursor.remove();
}
