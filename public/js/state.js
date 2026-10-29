// ── STATE ──
let STATE = {
  running: false, storyId: null, seed: null, numTurns: 5, currentTurn: -1,
  modelHistory: { A:[], B:[], C:[], D:[] },
  modelPassParagraphs: { A:[], B:[], C:[], D:[] },
  globalFacts: [], globalSummaries: [],
  turnLogs: [],
  totalScores: { A:0, B:0, C:0, D:0 },
  metricAccum: { A:{}, B:{}, C:{}, D:{} },
  turnWins: { A:0, B:0, C:0, D:0 },
  ttcwResults: null,
};
