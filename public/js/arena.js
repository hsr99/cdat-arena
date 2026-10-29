// ── RESET ──
function resetAll() {
  STATE.running = false;
  setTimeout(() => {
    STATE = { running:false,storyId:null,seed:null,numTurns:5,currentTurn:-1,modelHistory:{A:[],B:[],C:[],D:[]},modelPassParagraphs:{A:[],B:[],C:[],D:[]},globalFacts:[],globalSummaries:[],turnLogs:[],totalScores:{A:0,B:0,C:0,D:0},metricAccum:{A:{},B:{},C:{},D:{}},turnWins:{A:0,B:0,C:0,D:0},ttcwResults:null };
    // Reset rate limiter counters
    GROQ_RL._queue = [];
    GROQ_RL._running = false;
    GROQ_RL._totalSent = 0;
    GROQ_RL._lastCallTime = 0;
    GROQ_RL._stopCountdown();
    GROQ_RL._updateUI();

    document.getElementById('setupView').style.display = 'flex';
    document.getElementById('storyView').style.display = 'none';
    document.getElementById('storyView').innerHTML = '';
    document.getElementById('turnDots').innerHTML = '';
    document.getElementById('btnDl').disabled = true;
    document.getElementById('btnReset').textContent = '↺ Reset';
    document.getElementById('statTurn').textContent = '0';
    document.getElementById('statLeader').textContent = '—';
    document.getElementById('progressFill').style.width = '0%';
    document.getElementById('statusSec').style.display = 'none';
    document.getElementById('lbDisplay').innerHTML = '<div style="font-size:9.5px;color:var(--text3)">Awaiting turns…</div>';
    document.getElementById('metricMiniDisplay').innerHTML = '<div style="font-size:9.5px;color:var(--text3)">Awaiting data…</div>';
    document.getElementById('ttcwSidePanel').style.display = 'none';
    [0,1,2,3,4,5,6,7].forEach((_, i) => { const el = document.getElementById('ps'+i); if(el){el.classList.remove('s-active','s-done'); if(i===0) el.classList.add('s-active');} });
    initOverallChart();
  }, 100);
}

// ── MAIN RUNNER ──
async function beginArena() {
  const genre   = document.getElementById('fGenre').value.trim();
  const tone    = document.getElementById('fTone').value;
  const chars   = document.getElementById('fChars').value.trim();
  const sit     = document.getElementById('fSit').value.trim();
  const numTurns = parseInt(document.getElementById('fTurns').value);

  if (!genre || !chars || !sit) { alert('Please fill in Genre, Characters, and Opening Situation.'); return; }

  // Refactor safeguard: missing server credentials must not look like a scored run.
  try {
    const status = await fetch('/api/status').then(r => { if (!r.ok) throw new Error(); return r.json(); });
    if (!status.configured) { alert('Set fresh GROQ_API_KEY and HF_TOKEN values in the local .env file, then restart the server.'); return; }
  } catch { alert('Start the local Node server and open its printed address first.'); return; }

  STATE = {
    running:true, storyId:Math.random().toString(36).slice(2,10),
    seed:{ genre, tone, characters:chars, situation:sit },
    numTurns, currentTurn:-1,
    modelHistory:{A:[],B:[],C:[],D:[]},
    modelPassParagraphs:{A:[],B:[],C:[],D:[]},
    globalFacts:[], globalSummaries:[],
    turnLogs:[], totalScores:{A:0,B:0,C:0,D:0},
    metricAccum:{A:{},B:{},C:{},D:{}},
    turnWins:{A:0,B:0,C:0,D:0},
    ttcwResults:null,
  };

  document.getElementById('setupView').style.display = 'none';
  const sv = document.getElementById('storyView');
  sv.style.display = 'flex'; sv.innerHTML = '';
  document.getElementById('btnDl').disabled = true;
  document.getElementById('btnReset').textContent = '⏹ Stop';

  const hdr = document.createElement('div');
  hdr.className = 'story-header';
  hdr.innerHTML = `
    <div class="sh-top">
      <div class="sh-title">${genre.charAt(0).toUpperCase()+genre.slice(1)} — Arena Battle</div>
      <div class="sh-pill sh-genre">${genre.toUpperCase()}</div>
      <div class="sh-pill sh-tone">${tone}</div>
    </div>
    <div class="sh-desc">${sit}</div>
    <div class="sh-chars">${chars.split(/[·,;]/).map(c => `<div class="sh-char">${c.trim()}</div>`).join('')}</div>
  `;
  sv.appendChild(hdr);
  buildTurnDots(numTurns);
  initOverallChart();
  activateStage(0);
  await sleep(300);

  // ── TURN LOOP ──
  for (let t = 0; t < numTurns; t++) {
    if (!STATE.running) break;
    STATE.currentTurn = t;
    document.getElementById('statTurn').textContent = t + 1;
    document.getElementById('progressFill').style.width = ((t/numTurns)*100) + '%';

    const section = buildTurnSection(t);
    sv.appendChild(section);
    section.scrollIntoView({ behavior:'smooth', block:'nearest' });

    // Stage 1: Generate — HF models run freely, Groq calls go through RL queue
    activateStage(1);
    setStatus(`Turn ${t+1}/${numTurns} — generating all 4 models…`);

    const texts = {};
    await Promise.allSettled(Object.keys(MODELS).map(async k => {
      try { texts[k] = await generateParagraph(k, t); }
      catch (e) { texts[k] = null; console.error(`Model ${k} gen error:`, e.message); }
    }));
    await sleep(150);

    // Stage 2: Extract facts
    activateStage(2);
    setStatus('Extracting facts & summaries…');
    const primaryText = texts.B || texts.A || Object.values(texts).find(t => t);
    if (primaryText) {
      try {
        const fe = await extractFacts(primaryText);
        if (fe.facts?.length) STATE.globalFacts.push(...fe.facts);
        if (fe.summary) STATE.globalSummaries.push(fe.summary);
      } catch {}
    }
    await sleep(100);

    // Stage 3: Gate check
    activateStage(3);
    setStatus('Running gate checks…');
    const gates = {};
    await Promise.allSettled(Object.keys(MODELS).map(async k => {
      if (!texts[k]) { gates[k] = { result:'FAIL', reason:'No response generated.' }; return; }
      gates[k] = await gateCheck(k, texts[k], t);
    }));
    await sleep(100);

    // Stage 4: Judge
    activateStage(4);
    setStatus('Judge scoring — 10 metrics × 4 models…');
    let judgeScores = null;
    try { judgeScores = await judgeAllMetrics(t, texts); }
    catch (e) { console.error('Judge error:', e); }
    await sleep(100);

    // Stage 5: Score & rank
    activateStage(5);
    const turnScores = {};
    const pacScores  = {};

    Object.keys(MODELS).forEach(k => {
      const isPass = gates[k]?.result === 'PASS';
      const metrics = isPass ? judgeScores?.[k] : null;
      const pac = isPass ? computePAC(texts[k] || '', STATE.modelPassParagraphs[k]) : null;
      const score = isPass ? totalScore(metrics) : 0;

      turnScores[k] = score;
      pacScores[k]  = pac;
      STATE.totalScores[k] += score;

      if (metrics) {
        ALL_METRICS.forEach(m => {
          if (!STATE.metricAccum[k][m]) STATE.metricAccum[k][m] = { sum:0, count:0 };
          STATE.metricAccum[k][m].sum   += metrics[m] || 0;
          STATE.metricAccum[k][m].count += 1;
        });
      }

      if (texts[k]) {
        STATE.modelHistory[k].push({ role:'assistant', content:texts[k] });
        if (isPass) STATE.modelPassParagraphs[k].push(texts[k]);
      }
    });

    const winner = Object.entries(turnScores).sort((a,b) => b[1]-a[1])[0]?.[0];
    if (winner && turnScores[winner] > 0) STATE.turnWins[winner]++;

    Object.keys(MODELS).forEach(k => {
      const isPass = gates[k]?.result === 'PASS';
      populateModelCard(t, k, {
        text: texts[k] || '[Generation failed]',
        gate: gates[k]?.result || 'FAIL',
        gateReason: gates[k]?.reason || '',
        metrics: isPass ? judgeScores?.[k] : null,
        pac: pacScores[k] ?? 0,
        isWinner: winner === k && turnScores[k] > 0,
      });
    });

    const winnerEl = document.getElementById(`tswinner-${t}`);
    if (winnerEl && winner) {
      winnerEl.textContent = `★ ${MODELS[winner].label} wins (${turnScores[winner]}pts)`;
      winnerEl.className = 'ts-badge ts-winner';
      winnerEl.style.color = MODELS[winner].color;
    }

    chartPushTurn(t, turnScores);

    STATE.turnLogs.push({
      turn: t, timestamp: new Date().toISOString(),
      texts, gates, metrics: judgeScores,
      pac: pacScores, turnScores, winner,
    });

    updateTurnDot(t, winner);
    updateLeaderboard();
    updateMetricMini();
    document.getElementById('btnDl').disabled = false;
    setStatus(`Turn ${t+1} done — ${winner ? MODELS[winner].label + ' wins' : 'tie'}`, '', winner ? 'ok' : '');
    await sleep(400);
  }

  // ── DONE: AGGREGATE ──
  activateStage(6);
  STATE.running = false;
  document.getElementById('progressFill').style.width = '100%';
  document.getElementById('btnReset').textContent = '↺ Reset';
  const top = Object.entries(STATE.totalScores).sort((a,b) => b[1]-a[1])[0];

  // Final leaderboard in feed
  const lb = document.createElement('div');
  lb.className = 'leaderboard-section';
  const sorted = Object.entries(STATE.totalScores).sort((a,b) => b[1]-a[1]);
  const max = sorted[0]?.[1] || 1;
  lb.innerHTML = `
    <div class="lb-title">🏆 Final Leaderboard — CDAT</div>
    ${sorted.map(([k,total],i) => `
      <div class="lb-row">
        <div class="lb-rank ${i===0?'r1':i===1?'r2':i===2?'r3':''}">${['🥇','🥈','🥉','4'][i]}</div>
        <div class="lb-name" style="color:${MODELS[k].color}">${MODELS[k].label}<br><span style="font-size:9px;color:var(--text3)">${MODELS[k].name.split('/').pop()} · ${STATE.turnWins[k]} turn wins</span></div>
        <div class="lb-score" style="color:${MODELS[k].color}">${total}<span style="font-size:10px;color:var(--text3)">pts</span></div>
        <div class="lb-bar-wrap" style="width:100px;"><div class="lb-bar" style="width:${(total/max*100).toFixed(0)}%;background:${MODELS[k].color}"></div></div>
      </div>
    `).join('')}
    <div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;">
      <button class="btn btn-dl" onclick="openModal('overall')" style="flex:1;">⤢ Score Curves</button>
      <button class="btn btn-dl" style="background:var(--purple2);border-color:rgba(179,136,255,0.35);color:var(--purple);flex:1;" onclick="openModal('metrics')">⤢ Metric Breakdown</button>
    </div>
  `;
  sv.appendChild(lb);
  lb.scrollIntoView({ behavior:'smooth', block:'start' });

  // ── STAGE 7: TTCW ──
  activateStage(7);
  setStatus('Running TTCW — Torrance Test for Creative Writing…', 'Evaluating 4 dimensions × 4 models via judge LLM');

  const ttcwPlaceholder = document.createElement('div');
  ttcwPlaceholder.className = 'ttcw-section';
  ttcwPlaceholder.innerHTML = `
    <div class="ttcw-title"><span>🧠</span> TTCW — Torrance Test for Creative Writing</div>
    <div class="ttcw-loading">
      <div class="gen-spin" style="width:14px;height:14px;border-width:2px;border-top-color:var(--purple);border-color:rgba(179,136,255,0.2);"></div>
      <span>Running TTCW evaluation across all 4 models — Originality · Fluency · Flexibility · Elaboration…</span>
    </div>
  `;
  sv.appendChild(ttcwPlaceholder);
  ttcwPlaceholder.scrollIntoView({ behavior:'smooth', block:'start' });

  try {
    const ttcwResults = await runAllTTCW();
    sv.removeChild(ttcwPlaceholder);
    renderTTCWSection(ttcwResults);
    setStatus('Battle + TTCW complete!', 'Click ⤢ expand charts for full analysis', 'ok');
  } catch (e) {
    console.error('TTCW failed:', e);
    ttcwPlaceholder.innerHTML = `
      <div class="ttcw-title"><span>🧠</span> TTCW — Torrance Test for Creative Writing</div>
      <div style="font-size:10px;color:var(--red);padding:10px 0;">TTCW evaluation failed: ${e.message}</div>
    `;
    setStatus('Battle complete (TTCW error)', '', 'err');
  }
}
