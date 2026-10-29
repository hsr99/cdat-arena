# CDAT Arena

A four-model, multi-turn creative-writing evaluation prototype. This is a folder-based refactor of the supplied single-file app, not a new implementation of the research paper.

The original interface, model identifiers, prompts, token limits, Groq request queue, gate logic, ten judge-scored metrics, PAC calculation, charts, TTCW analysis and JSON export are retained. API credentials now live only on a local Node server.

## Start here

1. Install Node.js 22 or later.
2. Extract this folder.
3. Copy `.env.example` to `.env` in the project root.
4. Add **fresh** Groq and Hugging Face credentials to `.env`. Never put them in `public/`.
5. Open a terminal in the project root and run:

   ```sh
   npm start
   ```

6. Open the `http://127.0.0.1:3000` address printed in the terminal.

There are no npm dependencies to install. Use the printed `127.0.0.1` address, not `localhost` or a double-clicked HTML file. To use another port, change `PORT` in `.env`.

You can view the setup screen without credentials. Starting a battle requires both credentials. A real battle sends the story seed and generated text to Groq and Hugging Face and can consume paid quota or credits. No real provider calls were made to test this refactor. Model availability, access permissions and pricing have not been verified.

**Do not reuse the credentials in the original attachment.** They must be revoked or rotated through their owners' provider accounts. Removing them here does not invalidate copies or erase the old repository's history.

## Files

```text
cdat-arena/
  public/
    index.html            Page markup and script load order
    css/styles.css        Original visual styling
    js/
      config.js           Models, metric names and colors (no secrets)
      rate-limiter.js     Original serialized Groq queue and status UI
      state.js            Shared run state
      charts.js           Overview chart
      api.js              Browser calls to the local proxy
      pipeline.js         Generation, facts, gate and metric judge
      metrics.js          PAC and summed score helpers
      ttcw.js             TTCW prompts, evaluation and display
      ui.js               Stages, model cards, leaderboard and logs
      modals.js           Expanded charts
      export.js           Downloadable JSON
      arena.js            Reset and run orchestration
  server/
    app.mjs               Static server and restricted provider proxy
    index.mjs             Loopback-only startup
  tests/                  Offline server and metric tests
  scripts/check.mjs       Syntax and common credential-pattern checks
  docs/                   Refactor notes, test results and upload guide
  .env.example            Blank configuration template
  .gitignore              Excludes local credentials and generated results
  package.json
```

The frontend deliberately uses ordered classic scripts with shared scope to avoid changing how existing inline button handlers and shared state work. These are responsibility-based files, not isolated ES modules. Keep the script order in `index.html` intact.

## Check the project

```sh
npm run check
npm test
```

The tests use fake responses and do not call a model provider. See `docs/VERIFICATION.md` for the browser checks already performed.

## Upload to GitHub

See `docs/GITHUB_UPLOAD.md`. The source can be uploaded as a repository, but **GitHub Pages cannot run the Node server**. This package is for local use. Do not expose the proxy to the internet without authentication, spending controls, request throttling and a security review.

## Research and security limits

See `docs/REFACTOR_NOTES.md`. This refactor is not a claim that the prototype implements the paper or that its evaluation has been validated.

## Credits and rights

The evaluation prototype comes from the team's supplied code associated with the `sannidhayj20/Research` capstone work. This refactor reorganizes that implementation; it does not transfer authorship or ownership. Keep existing team attribution and confirm contributor credit and permission with the team before publishing shared work. No license is added because the supplied file did not establish licensing terms.

The interface loads Chart.js 4.4.1 from cdnjs and fonts from Google Fonts. Those third-party resources retain their own terms and require network access.
