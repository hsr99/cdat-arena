# Uploading the source

## Before uploading

- Confirm the team is comfortable with this code being in your repository and with the intended audience. The refactor does not grant permission to publish a teammate's work.
- Keep the repository private until the authorship and credential issues are settled.
- Revoke or rotate the credentials from the original file through their owners' accounts. Do not copy the original file into this project.
- Run `npm run check` and `npm test`.
- Keep `.env` local. The blank `.env.example` belongs in the repository.

## GitHub website

1. Create or open the repository you intend to use.
2. Extract the ZIP on your computer. Upload the **contents** of `cdat-arena/`, so `README.md` and `package.json` are at the repository root.
3. Include `public/`, `server/`, `scripts/`, `tests/`, `docs/`, `.gitignore`, `.env.example`, `README.md` and `package.json`. Hidden files may need to be shown in your file manager.
4. Do not upload `.env`, generated JSON results, the original attachment, API credentials or `node_modules/`.
5. Inspect the staged file list and source before committing. `.gitignore` does not protect a file you manually upload in the browser.

## Git command line

Inside the extracted project, before adding a remote or pushing:

```sh
git init
git add .
git status --short
git diff --cached --name-only
```

Check that `.env` and the original source file are absent. Commit and add your chosen repository remote only after that review. No repository has been created or pushed as part of this package.

## Running versus publishing

Uploading the source does not deploy the application. Run `npm start` locally. GitHub Pages serves static files only and will not provide `/api/groq`, `/api/hf` or `/api/status`.
