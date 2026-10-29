// ── CHART ──
let chartOverall;
let modalCharts = {};

function initOverallChart() {
  const ctx = document.getElementById('chartOverall').getContext('2d');
  if (chartOverall) chartOverall.destroy();
  chartOverall = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: Object.entries(MODELS).map(([k,m]) => ({
        label: k, data: [], borderColor: m.color, backgroundColor: m.color2,
        borderWidth: 1.5, pointRadius: 2.5, pointBackgroundColor: m.color, tension: 0.35,
      }))
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color:'#50596a', font:{family:'JetBrains Mono',size:7} }, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.07)'} },
        y: { min:0, max:100, ticks:{color:'#50596a',font:{family:'JetBrains Mono',size:7},stepSize:25}, grid:{color:'rgba(255,255,255,0.04)'}, border:{color:'rgba(255,255,255,0.07)'} }
      }
    }
  });
}
initOverallChart();

function chartPushTurn(turnIdx, scores) {
  chartOverall.data.labels.push('T' + (turnIdx + 1));
  Object.entries(MODELS).forEach(([k], i) => {
    chartOverall.data.datasets[i].data.push(scores[k] ?? null);
  });
  chartOverall.update('none');
}
