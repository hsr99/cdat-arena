# Refactor scope

## Preserved

- HTML layout and CSS styling.
- Four original model identifiers and provider assignments.
- All evaluation and generation prompts, temperatures and token budgets.
- Groq's original 2.2-second serialized queue.
- Shared facts/summaries, gate rules and failure behaviour.
- Ten judge-scored metrics, PAC, scoring, ranking, TTCW and JSON schema.
- Existing inline handlers and shared browser state.

## Deliberate changes

- Removed both embedded credentials entirely. The original file is not included.
- Browser requests now go to same-origin `/api/groq` and `/api/hf`. The Node server adds credentials from `.env` and forwards only the fixed provider endpoints and allowed model IDs.
- Server binds only to `127.0.0.1`, rejects foreign Host headers and cross-origin API requests, restricts request size and parameters, times out upstream calls, and does not serve files outside `public/`.
- Raw provider errors and metadata are not forwarded to the browser. Errors are reported with HTTP status and a generic message instead.
- Added a no-cost configuration check before a run. Missing local credentials now stop the run instead of entering the prototype's fallback scoring path.
- Added local setup, upload instructions and offline tests.

## Existing issues left unchanged

These affect research interpretation or robustness and are not fixed by moving files:

- Gate parsing errors default to PASS. Judge failures produce default scores of 5; TTCW failures produce default scores of 3. These can look like genuine evaluation outcomes. Do not treat runs with errors as valid evidence.
- Facts and summaries are extracted preferentially from Model B and shared with all models, so context is not independent between models.
- Generation still has a 350-token cap, including for the reasoning model. Empty or truncated answers can be budget artifacts, not model-quality results.
- Scores are LLM judgments, not implementations of the paper's separate IA/NM formulas or embedding-based metrics.
- Ties are resolved by model order. All-zero turns can still receive a winner label in parts of the UI.
- Reset/Stop does not cancel in-flight network requests or fully isolate old asynchronous work from a new run. For a clean new run after stopping, reload the page.
- Some form text, judge explanations and errors are interpolated into `innerHTML`. This is not hardened for hostile input. Use trusted local input only; public or multi-user deployment needs output escaping/sanitization and a security review.
- The rate limiter is a fixed spacing mechanism, not a guarantee about current provider quotas. There is no retry/backoff policy. Some UI estimates of call counts and time are inherited approximations; fact extraction, gates and TTCW add calls.
- The original desktop layout, low-contrast small labels and external font/chart loading remain. This was not a mobile redesign or accessibility pass.

The local proxy is a safer credential boundary, not a production backend. It has no user login, persistent results storage, spending budget, global rate limiter or deployment configuration. Do not port-forward it or bind it to a public interface as-is.
