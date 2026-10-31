# Working on CombinePDF

## Project

- Browser-only PDF merger with Thai UI, plain HTML/CSS/JavaScript and a local, pinned `pdf-lib` browser bundle.
- Keep the website buildless. Do not add Node.js, npm, Vite, package imports or a required compilation step. Opening `index.html` directly and serving the repository root must both work.
- Keep PDF contents on the user's device. Do not add uploads, analytics or external runtime CDNs.
- Preserve keyboard access, responsive layouts, Thai labels and useful error messages.
- Keep upload, file ordering/removal, output naming and merge actions inside one viewport. Long file lists scroll inside their own panel; do not turn the workspace into a vertically scrolling landing page. Put secondary help in the help dialog.
- Load encrypted PDFs with the library's default checks; never use `ignoreEncryption` to bypass them.
- Use `textContent` for file names and other user-controlled strings.
- Keep browser dependencies and fonts in `assets/`, preserve their licenses, and record versions and hashes when changing them. Optional Python dependencies are for developer tests only.
- Use relative asset URLs. GitHub Pages publishes `main` / repository root at `/CombinePDF/`; test that exact source tree and path, never a generated substitute.

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

- No installation or build is needed to run or deploy the website. Open `index.html`, or optionally use `python tests/serve.py` for a local HTTP preview.
- Run `python tests/check_static.py` to verify every referenced runtime asset and the pinned PDF library. This check uses Python's standard library only.
- Optional browser tests: `python -m pip install -r requirements-dev.txt`, `python -m playwright install chromium`, then `python -m unittest discover -s tests -p "test_*.py" -v`. On Windows, an installed Edge browser can be used by setting `PLAYWRIGHT_CHANNEL=msedge`.
- For behavior changes, verify valid merging and page order, invalid/encrypted PDFs, removing/reordering files, download naming, keyboard access and mobile layout as applicable. Use generated test PDFs, never real user documents.
- Review desktop and mobile rendering after meaningful visual changes. Do not add tests that merely repeat static markup.
- GitHub Pages uses the existing branch publishing source (`main`, `/ (root)`). The check workflow validates source assets and runs browser tests; it must not replace or race the Pages deployment with a separate built artifact.
- Before declaring a deployment fixed, inspect the actual public URL, confirm its version and asset responses, and test an actual PDF download there. A successful push or local test is insufficient.
