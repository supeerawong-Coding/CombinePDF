# Working on CombinePDF

## Project

- Browser-only PDF merger, with Thai UI, vanilla JavaScript, Vite and `pdf-lib`.
- Keep PDF contents on the user's device. Do not add uploads, analytics or external runtime CDNs.
- Preserve keyboard access, responsive layouts, Thai labels and useful error messages.
- Keep upload, file ordering/removal, output naming and merge actions inside one viewport. Long file lists scroll inside their own panel; do not turn the workspace into a vertically scrolling landing page. Put secondary help in the help dialog.
- Load encrypted PDFs with the library's default checks; never use `ignoreEncryption` to bypass them.
- Use `textContent` for file names and other user-controlled strings.
- Keep dependencies pinned and commit `package-lock.json` with dependency changes.
- Production assets use `/CombinePDF/`; update `vite.config.js`, tests and documentation together if the repository path changes.

## Git rules

1. Before editing, inspect `git status --short`, the current branch, remotes and applicable instructions. Preserve existing user changes and untracked files.
2. Use a focused `codex/<description>` branch for normal changes. Do not implement normal changes directly on `main`.
3. Do not commit, push, merge, create tags or publish unless the user's request authorizes that action. Preparing deployment files alone does not authorize a push or a production deployment. Read-only Git checks and creating a local branch are allowed.
4. An empty repository may be bootstrapped to `main` only when the user explicitly requests its first commit/push/publication. After that, use a feature branch and a pull request.
5. Stage explicit file paths after reviewing them. Do not use `git add .` or `git add -A` without first verifying every included change. Never include private PDF files, credentials, `.env` files, `node_modules`, `dist` or test outputs.
6. Never discard unrelated work, auto-stash it, rewrite shared history, force-push, run `git reset --hard`, run `git clean -fd`, or delete branches without explicit authorization. Do not bypass Git hooks or checks with `--no-verify`.
7. Do not change remote URLs, repository visibility, Git identity or credential settings unless requested. Never put tokens in URLs, source files, logs or commit messages.
8. Before an authorized commit/push, inspect the staged diff and run the relevant checks below. Use concise Conventional Commit messages, such as `feat: improve PDF merge workspace`. Report checks, branch and commit SHA when a commit is made.
9. Before an authorized push to an existing branch, fetch and inspect divergence. Resolve conflicts without deleting the user's changes. Do not merge a pull request or enable production settings merely because a branch was pushed.

## Development and verification

- Node.js 24 LTS; install with `npm ci`.
- `npm run dev` serves the app at `http://localhost:5173/CombinePDF/`.
- `npm run check` checks JavaScript syntax.
- `npm run build` builds only deployable assets into `dist/`.
- `npm test` runs browser tests against the production build. Run `npx playwright install chromium` once first. For a local installed Edge browser, set `PLAYWRIGHT_CHANNEL=msedge`.
- For behavior changes, verify valid merging and page order, invalid/encrypted PDFs, removing/reordering files, download naming, keyboard access and mobile layout as applicable. Use generated test PDFs, never real user documents.
- Review desktop and mobile rendering after meaningful visual changes. Do not add tests that merely repeat static markup.
- The GitHub Pages workflow validates and tests pull requests, and deploys successful `main` builds only. Keep deployment permissions scoped to the deploy job and publish only `dist/`.
