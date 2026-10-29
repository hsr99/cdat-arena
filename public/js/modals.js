// ── MODAL ──
let modalMode = 'overall';
function openModal(mode) {
  modalMode = mode;
  document.getElementById('modalOverlay').classList.add('open');
  renderModalContent(mode);
}
function closeModal(e) { if (e.target === document.getElementById('modalOverlay')) closeModalDirect(); }
function closeModalDirect() {
  document.getElementById('modalOverlay').classList.remove('open');
  Object.values(modalCharts).forEach(c => c.destroy());
  modalCharts = {};
}

function renderModalContent(mode) {
  const logs = STATE.turnLogs;
  if (!logs.length) {
    document.getElementById('modalTitle').textContent = 'No data yet';
    document.getElementById('modalContent').innerHTML = '<div style="color:var(--text3);font-size:11px;padding:20px 0">Run the arena battle first.</div>';
    return;
  }
  if (mode === 'overall') {
    document.getElementById('modalTitle').textContent = 'Score Curves — All Models';
    renderOverallModal(logs);
  } else {
    document.getElementById('modalTitle').textContent = 'Metric Breakdown — All 10 Metrics';
    renderMetricsModal(logs);
  }
}

function renderOverallModal(logs) {
  const content = document.getElementById('modalContent');
  content.innerHTML = `
    <div class="modal-charts-grid">
      <div class="modal-chart-card" style="grid-column:1/-1;">
        <div class="mcc-title">Total Score per Turn (sum of all 10 metrics, max 100)</div>
        <div class="modal-chart-wrap"><canvas id="mcTotalScore"></canvas></div>
        <div class="modal-legend">${Object.entries(MODELS).map(([k,m]) => `<div class="ml-item-full"><div class="cl-dot" style="background:${m.color};border-radius:2px;width:10px;height:10px;"></div>${m.label} — ${m.name.split('/').pop()}</div>`).join('')}</div>
      </div>
      <div class="modal-chart-card">
        <div class="mcc-title">Cumulative Score</div>
        <div class="modal-chart-wrap"><canvas id="mcCumulative"></canvas></div>
      </div>
      <div class="modal-chart-card">
        <div class="mcc-title">Turn Win Rate</div>
        <div class="modal-chart-wrap"><canvas id="mcWinRate"></canvas></div>
      </div>
      <div class="modal-chart-card">
        <div class="mcc-title">PAC Branching per Turn</div>
        <div class="modal-chart-wrap"><canvas id="mcPAC"></canvas></div>
      </div>
    </div>
  `;
  setTimeout(() => {
    const labels = logs.map((_, i) => 'T' + (i+1));
    const common = {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#8892a4', font:{family:'JetBrains Mono',size:9}, boxWidth:10, boxHeight:10, padding:12 } } },
      scales:{
        x:{ ticks:{color:'#50596a',font:{family:'JetBrains Mono',size:9}}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.07)'} },
        y:{ ticks:{color:'#50596a',font:{family:'JetBrains Mono',size:9}}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.07)'} }
      }
    };

    modalCharts.total = new Chart(document.getElementById('mcTotalScore').getContext('2d'), {
      type:'line',
      data:{ labels, datasets: Object.entries(MODELS).map(([k,m]) => ({ label:m.label, data:logs.map(l => l.turnScores?.[k] ?? null), borderColor:m.color, backgroundColor:m.color2, borderWidth:2, pointRadius:4, pointBackgroundColor:m.color, tension:0.35, fill:false })) },
      options:{ ...common, scales:{ ...common.scales, y:{...common.scales.y, min:0, max:100} } }
    });

    let cumul = {A:0,B:0,C:0,D:0};
    const cumulData = {A:[],B:[],C:[],D:[]};
    logs.forEach(l => { Object.keys(MODELS).forEach(k => { cumul[k] += l.turnScores?.[k] ?? 0; cumulData[k].push(cumul[k]); }); });
    modalCharts.cumul = new Chart(document.getElementById('mcCumulative').getContext('2d'), {
      type:'line',
      data:{ labels, datasets: Object.entries(MODELS).map(([k,m]) => ({ label:m.label, data:cumulData[k], borderColor:m.color, backgroundColor:m.color2, borderWidth:2, pointRadius:3, tension:0.35, fill:true })) },
      options:common
    });

    let wins = {A:0,B:0,C:0,D:0};
    logs.forEach(l => { if (l.winner) wins[l.winner] = (wins[l.winner]||0)+1; });
    modalCharts.wins = new Chart(document.getElementById('mcWinRate').getContext('2d'), {
      type:'bar',
      data:{ labels:Object.keys(MODELS).map(k => MODELS[k].label), datasets:[{ label:'Turn Wins', data:Object.keys(MODELS).map(k => wins[k]||0), backgroundColor:Object.values(MODELS).map(m => m.color2), borderColor:Object.values(MODELS).map(m => m.color), borderWidth:1.5, borderRadius:4 }] },
      options:{ ...common, plugins:{...common.plugins, legend:{display:false}}, scales:{...common.scales, y:{...common.scales.y, beginAtZero:true, ticks:{...common.scales.y.ticks, stepSize:1}}} }
    });

    modalCharts.pac = new Chart(document.getElementById('mcPAC').getContext('2d'), {
      type:'bar',
      data:{ labels, datasets: Object.entries(MODELS).map(([k,m]) => ({ label:m.label, data:logs.map(l => l.pac?.[k] != null ? +l.pac[k].toFixed(3) : null), backgroundColor:m.color2, borderColor:m.color, borderWidth:1.5, borderRadius:3 })) },
      options:{ ...common, scales:{ ...common.scales, y:{...common.scales.y, min:0, max:1} } }
    });
  }, 50);
}

function renderMetricsModal(logs) {
  const content = document.getElementById('modalContent');
  const avgMetrics = { A:{}, B:{}, C:{}, D:{} };
  Object.keys(MODELS).forEach(k => {
    ALL_METRICS.forEach(m => {
      const vals = logs.filter(l => l.metrics?.[k]?.[m] != null).map(l => l.metrics[k][m]);
      avgMetrics[k][m] = vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0;
    });
  });

  content.innerHTML = `
    <div class="modal-charts-grid">
      <div class="modal-chart-card" style="grid-column:1/-1;">
        <div class="mcc-title">Average Score per Metric — all models compared</div>
        <div class="modal-chart-wrap"><canvas id="mcMetricAvg"></canvas></div>
        <div class="modal-legend">${Object.entries(MODELS).map(([k,m]) => `<div class="ml-item-full"><div class="cl-dot" style="background:${m.color};border-radius:2px;width:10px;height:10px;"></div>${m.label}</div>`).join('')}</div>
      </div>
      <div class="modal-chart-card">
        <div class="mcc-title">Single-Turn Metrics — Radar</div>
        <div class="modal-chart-wrap"><canvas id="mcRadarSingle"></canvas></div>
      </div>
      <div class="modal-chart-card">
        <div class="mcc-title">Multi-Turn Metrics — Radar</div>
        <div class="modal-chart-wrap"><canvas id="mcRadarMulti"></canvas></div>
      </div>
      <div class="modal-chart-card">
        <div class="mcc-title">Surprise vs Novelty (per turn)</div>
        <div class="modal-chart-wrap"><canvas id="mcSurpNovelty"></canvas></div>
      </div>
      <div class="modal-chart-card">
        <div class="mcc-title">Coherence vs Knowledge Retention</div>
        <div class="modal-chart-wrap"><canvas id="mcCoherKR"></canvas></div>
      </div>
    </div>
  `;
  setTimeout(() => {
    const labels = logs.map((_, i) => 'T'+(i+1));
    const common = {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#8892a4', font:{family:'JetBrains Mono',size:9}, boxWidth:10, boxHeight:10, padding:10 } } },
      scales:{
        x:{ ticks:{color:'#50596a',font:{family:'JetBrains Mono',size:9}}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.07)'} },
        y:{ ticks:{color:'#50596a',font:{family:'JetBrains Mono',size:9}}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.07)'} }
      }
    };

    modalCharts.metricAvg = new Chart(document.getElementById('mcMetricAvg').getContext('2d'), {
      type:'bar',
      data:{ labels:ALL_METRICS.map(m => m.replace(/_/g,' ')), datasets: Object.entries(MODELS).map(([k,m]) => ({ label:m.label, data:ALL_METRICS.map(met => +avgMetrics[k][met].toFixed(2)), backgroundColor:m.color2, borderColor:m.color, borderWidth:1.5, borderRadius:3 })) },
      options:{ ...common, scales:{...common.scales, y:{...common.scales.y, min:0, max:10}} }
    });

    const radarOpts = {
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{ labels:{ color:'#8892a4', font:{family:'JetBrains Mono',size:9}, boxWidth:8, boxHeight:8, padding:8 } } },
      scales:{ r:{ min:0, max:10, ticks:{backdropColor:'transparent',color:'#50596a',font:{family:'JetBrains Mono',size:7},stepSize:2}, grid:{color:'rgba(255,255,255,0.07)'}, pointLabels:{color:'#8892a4',font:{family:'JetBrains Mono',size:8}}, angleLines:{color:'rgba(255,255,255,0.07)'} } }
    };
    modalCharts.radarS = new Chart(document.getElementById('mcRadarSingle').getContext('2d'), {
      type:'radar',
      data:{ labels:SINGLE_METRICS.map(m => m.replace(/_/g,' ')), datasets:Object.entries(MODELS).map(([k,m]) => ({ label:m.label, data:SINGLE_METRICS.map(met => +avgMetrics[k][met].toFixed(2)), borderColor:m.color, backgroundColor:m.color2, borderWidth:1.5, pointRadius:2 })) },
      options:radarOpts
    });
    modalCharts.radarM = new Chart(document.getElementById('mcRadarMulti').getContext('2d'), {
      type:'radar',
      data:{ labels:MULTI_METRICS.map(m => m.replace(/_/g,' ')), datasets:Object.entries(MODELS).map(([k,m]) => ({ label:m.label, data:MULTI_METRICS.map(met => +avgMetrics[k][met].toFixed(2)), borderColor:m.color, backgroundColor:m.color2, borderWidth:1.5, pointRadius:2 })) },
      options:radarOpts
    });

    modalCharts.sn = new Chart(document.getElementById('mcSurpNovelty').getContext('2d'), {
      type:'line',
      data:{ labels, datasets:Object.entries(MODELS).flatMap(([k,m]) => [
        { label:`${m.label} Surprise`, data:logs.map(l => l.metrics?.[k]?.Surprise ?? null), borderColor:m.color, borderWidth:1.5, borderDash:[], pointRadius:2, tension:0.3 },
        { label:`${m.label} Novelty`,  data:logs.map(l => l.metrics?.[k]?.Novelty ?? null),  borderColor:m.color, borderWidth:1, borderDash:[4,3], pointRadius:1, tension:0.3 },
      ]) },
      options:{ ...common, scales:{...common.scales, y:{...common.scales.y, min:0, max:10}} }
    });

    modalCharts.ckr = new Chart(document.getElementById('mcCoherKR').getContext('2d'), {
      type:'line',
      data:{ labels, datasets:Object.entries(MODELS).flatMap(([k,m]) => [
        { label:`${m.label} Coherence`, data:logs.map(l => l.metrics?.[k]?.Coherence ?? null), borderColor:m.color, borderWidth:1.5, borderDash:[], pointRadius:2, tension:0.3 },
        { label:`${m.label} KR`,        data:logs.map(l => l.metrics?.[k]?.Knowledge_Retention ?? null), borderColor:m.color, borderWidth:1, borderDash:[4,3], pointRadius:1, tension:0.3 },
      ]) },
      options:{ ...common, scales:{...common.scales, y:{...common.scales.y, min:0, max:10}} }
    });
  }, 50);
}
