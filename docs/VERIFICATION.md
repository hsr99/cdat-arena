# Verification

## Automated checks

- `npm run check`: JavaScript syntax checks and common credential-pattern scan passed.
- `npm test`: 9 tests passed. Covers static serving, private-file exclusion, missing configuration, cross-origin/Host rejection, provider allowlists and payload validation, server-only credential handling, redacted upstream errors, both provider routes, summed metric scores and PAC behaviour.
- The delivered tree was separately checked against the original credentials without printing their values. Neither credential is present.

## Browser check

Chrome at 1440 x 1000, with deterministic fake provider responses:

- Setup screen and all four model cards loaded.
- Completed three turns across all four models.
- Exercised 30 fake provider requests, with no real provider requests.
- Produced expected score totals, including 210 for Model A.
- Rendered all four TTCW cards and the metric chart modal.
- Downloaded JSON and confirmed three turns and the expected totals.
- Reset returned to setup.
- No uncaught page errors or unexpected network requests.

For this test only, the queue interval and animation delays were shortened in the test browser. The shipped queue and timing values were not changed. The actual Chart.js file was supplied locally to the test browser; Google Fonts were blocked, so screenshots show fallback fonts. No provider keys were used. Screenshots of setup, results and the metric modal were visually inspected for layout and content.

## Not verified

- Live provider access, model availability, account permissions, pricing or quota.
- Real model output quality, reproducibility or agreement with the paper.
- Mobile layout, accessibility compliance or production deployment security.
- That the credentials in the original file have been revoked.
