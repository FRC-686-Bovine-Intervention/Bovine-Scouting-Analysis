## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues. External PRs are not part of the triage surface. See `docs/agents/issue-tracker.md`.

### GitHub account routing

- This repository uses the `RichSims686` GitHub account. Use `pwsh -NoProfile -File scripts/gh.ps1 ...` for all GitHub CLI operations so the wrapper selects the account from this repository's local `codex.githubAccount` setting without changing the machine-wide active account.
- Do not call `gh auth switch`. Never store, print, or pass a token as a command-line argument; the wrapper reads it from GitHub CLI's secure credential store and sets `GH_TOKEN` only for that process.
- Verify the selected account without exposing credentials with `pwsh -NoProfile -File scripts/gh.ps1 api user --jq .login`; expected output is `RichSims686`.
- Local Git commits do not need GitHub authentication. For Git operations over HTTPS, `origin` includes `RichSims686` as the username selector so Git Credential Manager can use that account's credential without changing GitHub CLI's active account.
- If a Git push cannot open the credential prompt in a noninteractive shell, use `pwsh -NoProfile -File scripts/git-push.ps1 origin dev` (replace the remote and branch as needed). The helper obtains the mapped account's credential from GitHub CLI's secure store and supplies it through a temporary askpass process; it removes the temporary helper and environment variables afterward. Never put a token in a remote URL, command-line argument, repository file, or saved Git configuration.

### Triage labels

This repo uses the default triage label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo is configured as a single-context repo. See `docs/agents/domain.md`.

### Checkout preference

- Prefer doing normal ticket work in the shared `dev` checkout at `D:\FIRST\Scouting\Bovine-Scouting-Analysis` so the user's existing localhost/browser session sees changes immediately.
- Do not create or use a separate Codex worktree/session for ordinary ticket implementation unless the user explicitly asks for isolation or the task genuinely requires it.
- When work must happen in a separate worktree, call that out clearly and tell the user that they will need to run/view that checkout separately.
- After verifying and committing a focused change on `dev`, push that commit to `origin/dev` unless the user explicitly asks not to. This lets the development deployment reflect completed work without waiting for a separate push.

### Browser testing

- The Codex in-app browser blocks `file:` URLs, so it cannot open this app directly from `index.html`.
- For in-app browser checks, use the shared checkout's localhost server (or start a local HTTP server) and navigate to its `http://localhost` URL. Run the repository's Playwright scripts only in an environment where the `playwright` package is available to the project runtime.
- For authenticated local browser checks without production authentication, follow [`docs/authenticated-local-browser-test-harness.md`](docs/authenticated-local-browser-test-harness.md) and run `node .browser-test/authenticated-local-harness.mjs` after starting the local stack.

### Local simulator and emulator lifecycle

- When working with the Event Simulator and Firebase local emulators, restart the local emulator stack after every commit so the running process uses the committed code. Refresh the local build revision and verify emulator readiness before handing work back.

### Deployment guidance

- Before deploying Firebase Hosting or directing someone to a development or production deployment, read `docs/development-and-deployment-workflow.md`.

### Live data truthfulness

- Treat live external provider data and canonical scouting submissions as the source of truth.
- Keep the translation layer thin: pass through real event/scouting fields so they remain available as plotting options, formula inputs, and metrics across pages for all seasons and events.
- Do not invent or preserve prototype-era synthetic data paths when a live-backed field is unavailable. Prefer showing the live scalar value, or showing that a trend/component is unavailable, over fabricating derived match-by-match series or season-specific placeholders.
- Do not introduce or preserve pseudo-events that stand in for real events, seasons, or live-backed source states. Prefer wiring the app to real event identities and real source-backed data, and treat pseudo-events as cleanup targets.
- When touching event, metric, or plotting code, actively look for older demo/prototype logic that can leak bogus values into the UI and remove or replace it with live-backed data.

