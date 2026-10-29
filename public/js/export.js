// ── DOWNLOAD ──
function downloadJSON() {
  const payload = {
    story_id: STATE.storyId, seed: STATE.seed,
    generated_at: new Date().toISOString(),
    final_scores: STATE.totalScores,
    turn_wins: STATE.turnWins,
    ttcw_results: STATE.ttcwResults,
    groq_rl_stats: { total_calls: GROQ_RL._totalSent, interval_ms: GROQ_RL.INTERVAL_MS },
    turns: STATE.turnLogs
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `cdat_arena_${STATE.storyId}.json`; a.click();
  URL.revokeObjectURL(url);
}
