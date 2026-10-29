// ── PIPELINE HELPERS ──
async function generateParagraph(modelKey, turnIdx) {
  const s = STATE.seed;
  const isFirst = turnIdx === 0;
  const passParas = STATE.modelPassParagraphs[modelKey];

  const factStr = STATE.globalFacts.length > 0
    ? 'Committed facts:\n' + STATE.globalFacts.slice(-12).map(f => '• ' + f).join('\n') : '';

  let contextStr = '';
  if (!isFirst && passParas.length > 0) {
    const recent = passParas.slice(-3);
    const oldSummaries = STATE.globalSummaries.slice(0, STATE.globalSummaries.length - 3);
    contextStr = oldSummaries.length > 0
      ? 'Earlier (summaries):\n' + oldSummaries.map((s,i) => `${i+1}. ${s}`).join('\n') + '\n\nRecent:\n' + recent.map((p,i) => `[${i+1}]: ${p}`).join('\n\n')
      : 'Story so far:\n' + recent.map((p,i) => `[P${i+1}]: ${p}`).join('\n\n');
  }

  const systemPrompt = `You are a literary fiction writer specializing in ${s.genre} fiction. Write in third person. Tone: ${s.tone}. ONE paragraph of 90–160 words. Sensory, atmospheric, specific. No clichés. Maintain committed facts. Advance story. NO headers or labels.`;
  const userMsg = isFirst
    ? `Begin the story:\nCharacters: ${s.characters}\nSituation: ${s.situation}\nWrite only the opening paragraph.`
    : `Continue exactly from where it left off.\nCharacters: ${s.characters}\n${factStr}\n${contextStr}\nWrite only the next paragraph. Do not recap.`;

  return callModel(modelKey, [{ role:'system', content:systemPrompt }, { role:'user', content:userMsg }]);
}

async function extractFacts(paragraph) {
  const prompt = `Analyze this story paragraph. Return ONLY valid JSON, no markdown.\n\nParagraph: "${paragraph.slice(0,600)}"\n\nExtract:\n1. "facts": array of 0–4 brief committed narrative facts\n2. "summary": one sentence max 18 words\n\nJSON: {"facts": [...], "summary": "..."}`;
  try {
    const raw = await groqCall('llama-3.1-8b-instant', [{ role:'user', content:prompt }], 250, 0.25, 'extractFacts');
    return JSON.parse(raw.replace(/```json|```/g,'').trim());
  } catch { return { facts:[], summary:'Turn summary unavailable.' }; }
}

async function gateCheck(modelKey, paragraph, turnIdx) {
  if (STATE.modelPassParagraphs[modelKey].length === 0) return { result:'PASS', reason:'First turn, no prior context.' };
  const recent = STATE.modelPassParagraphs[modelKey].slice(-2);
  const factStr = STATE.globalFacts.slice(-8).map(f => '• ' + f).join('\n') || 'None.';
  const prompt = `You are a narrative coherence judge.
PASS: character consistent, no fact contradictions, narrative connects. Surprises are OK.
FAIL: direct fact contradiction, core trait violation, zero narrative connection.

Genre: ${STATE.seed.genre} | Characters: ${STATE.seed.characters}
Facts:\n${factStr}
Recent (model ${modelKey}):\n${recent.map((p,i) => `[${i+1}]: ${p.slice(0,250)}`).join('\n\n')}
New paragraph:\n"${paragraph.slice(0,500)}"

Return ONLY JSON: {"result":"PASS","reason":"brief sentence"} or {"result":"FAIL","reason":"specific issue"}`;
  try {
    const raw = await groqCall('llama-3.1-8b-instant', [{ role:'user', content:prompt }], 150, 0.2, `gate·${modelKey}`);
    return JSON.parse(raw.replace(/```json|```/g,'').trim());
  } catch { return { result:'PASS', reason:'Parse error — defaulting PASS.' }; }
}

// ── JUDGE: ALL 10 METRICS ──
async function judgeAllMetrics(turnIdx, modelResponses) {
  const s = STATE.seed;
  const summaryStr = STATE.globalSummaries.slice(-4).join('. ') || 'Story beginning.';
  const prevTurnData = STATE.turnLogs.length > 0 ? STATE.turnLogs[STATE.turnLogs.length - 1] : null;

  const systemPrompt = `You are an expert literary critic and AI evaluation analyst in an arena-style evaluation framework.
Evaluate 4 anonymous models (A, B, C, D) comparatively under identical constraints. Scores reflect *relative* quality.

SINGLE-TURN METRICS (per paragraph, 1–10):
1. Surprise: Unexpected yet meaningful deviation from predictable narrative trajectories.
2. Novelty: Originality vs clichés and predictable tropes.
3. Lexical_Diversity: Richness and variation of vocabulary.
4. Syntactic_Complexity: Sentence structure depth and variation.
5. Semantic_Diversity: Variety of distinct concepts and ideas.
6. Coherence: Logical flow and internal narrative consistency.

MULTI-TURN METRICS (conversation quality, 1–10):
7. Knowledge_Retention: How well model uses info from Turn 1 context.
8. Conversation_Completeness: Are all user intentions across turns satisfied?
9. Conversation_Relevancy: Contextual alignment across turns, no drift.
10. Instruction_Absorption: New instruction incorporated while preserving prior context.

RULES: Integers 1–10 only. 5 = competent but unremarkable. Use full scale. Be consistent.

Return ONLY valid JSON. No markdown. No commentary.
{
  "A": {"Surprise":7,"Novelty":6,"Lexical_Diversity":7,"Syntactic_Complexity":6,"Semantic_Diversity":7,"Coherence":8,"Knowledge_Retention":9,"Conversation_Completeness":8,"Conversation_Relevancy":9,"Instruction_Absorption":8},
  "B": {...}, "C": {...}, "D": {...}
}`;

  let userContent = `GENRE: ${s.genre} | TONE: ${s.tone}\nCHARACTERS: ${s.characters}\nSTORY CONTEXT: ${summaryStr}\nTURN NUMBER: ${turnIdx + 1}\n\n`;
  Object.entries(modelResponses).forEach(([k, v]) => {
    userContent += `MODEL ${k} (turn ${turnIdx + 1}):\n${(v || 'No response').slice(0, 700)}\n\n`;
  });
  if (prevTurnData) {
    userContent += `PREVIOUS TURN RESPONSES (for multi-turn scoring):\n`;
    Object.entries(prevTurnData.texts || {}).forEach(([k, v]) => {
      userContent += `MODEL ${k} PREV: ${(v || '').slice(0, 300)}\n`;
    });
  }

  try {
    const raw = await groqCall('llama-3.3-70b-versatile', [
      { role:'system', content:systemPrompt },
      { role:'user', content:userContent }
    ], 600, 0.15, `judge·T${turnIdx+1}`);
    const parsed = JSON.parse(raw.replace(/```json|```/g,'').trim());
    const result = {};
    Object.keys(MODELS).forEach(k => {
      result[k] = {};
      ALL_METRICS.forEach(m => {
        const v = parseInt(parsed[k]?.[m]) || 5;
        result[k][m] = Math.min(10, Math.max(1, v));
      });
    });
    return result;
  } catch {
    const fallback = {};
    Object.keys(MODELS).forEach(k => { fallback[k] = {}; ALL_METRICS.forEach(m => { fallback[k][m] = 5; }); });
    return fallback;
  }
}
