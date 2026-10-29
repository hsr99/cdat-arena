// ── PAC ──
const STOPWORDS = new Set(['the','a','an','in','on','at','to','for','of','and','or','but','is','was','are','were','be','been','have','has','had','do','does','did','will','would','could','should','that','this','these','those','it','its','he','she','they','we','you','i','his','her','their','our','your','my','with','from','by','as','into','about','up','out','so','then','than','when','where','who','which','what','how','not','all','some','one','two','no','just','very','also','more','over','still','even','much','here','there','now','only','back','down','after','if','while']);
function textToWords(t) { return new Set((t.toLowerCase().match(/\b[a-z]{3,}\b/g)||[]).filter(w=>!STOPWORDS.has(w))); }
function computePAC(cur, prevs) {
  if (!prevs.length) return 0.5;
  const c = textToWords(cur);
  const dists = prevs.map(p => { const pw = textToWords(p); const inter = [...c].filter(w=>pw.has(w)).length; const uni = new Set([...c,...pw]).size; return uni > 0 ? 1 - inter/uni : 0; });
  return dists.reduce((a,b) => a+b, 0) / dists.length;
}

function totalScore(metrics) {
  if (!metrics) return 0;
  return ALL_METRICS.reduce((s, m) => s + (metrics[m] || 0), 0);
}
