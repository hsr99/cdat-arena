// ── PROVIDER MAP ──
const MODELS = {
  A: { label: 'Model A', name: 'llama-3.1-8b-instant',                 provider: 'groq', color: '#5b9cf6', color2: 'rgba(91,156,246,0.15)' },
  B: { label: 'Model B', name: 'llama-3.3-70b-versatile',              provider: 'groq', color: '#00d4aa', color2: 'rgba(0,212,170,0.15)' },
  C: { label: 'Model C', name: 'Qwen/Qwen2.5-7B-Instruct:fastest',     provider: 'hf',   color: '#b388ff', color2: 'rgba(179,136,255,0.15)' },
  D: { label: 'Model D', name: 'deepseek-ai/DeepSeek-R1:fastest',      provider: 'hf',   color: '#ffb347', color2: 'rgba(255,179,71,0.15)' },
};

const SINGLE_METRICS = ['Surprise','Novelty','Lexical_Diversity','Syntactic_Complexity','Semantic_Diversity','Coherence'];
const MULTI_METRICS  = ['Knowledge_Retention','Conversation_Completeness','Conversation_Relevancy','Instruction_Absorption'];
const ALL_METRICS    = [...SINGLE_METRICS, ...MULTI_METRICS];

const METRIC_COLORS = {
  Surprise:'#ff79c6', Novelty:'#5b9cf6', Lexical_Diversity:'#00d4aa',
  Syntactic_Complexity:'#ffb347', Semantic_Diversity:'#b388ff', Coherence:'#50fa7b',
  Knowledge_Retention:'#ff5555', Conversation_Completeness:'#8be9fd',
  Conversation_Relevancy:'#f1fa8c', Instruction_Absorption:'#ff79c6',
};

const TTCW_COLORS = { originality:'#ff79c6', fluency:'#5b9cf6', flexibility:'#00d4aa', elaboration:'#ffb347' };
const TTCW_DIMS   = ['originality','fluency','flexibility','elaboration'];
