## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues. External PRs are not part of the triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default triage label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo is configured as a single-context repo. See `docs/agents/domain.md`.

### Checkout preference

- Prefer doing normal ticket work in the shared `dev` checkout at `D:\FIRST\Scouting\Bovine-Scouting-Analysis` so the user's existing localhost/browser session sees changes immediately.
- Do not create or use a separate Codex worktree/session for ordinary ticket implementation unless the user explicitly asks for isolation or the task genuinely requires it.
- When work must happen in a separate worktree, call that out clearly and tell the user that they will need to run/view that checkout separately.

### Browser testing

- The Codex in-app browser blocks `file:` URLs, so it cannot open this app directly from `index.html`.
- For in-app browser checks, use the shared checkout's localhost server (or start a local HTTP server) and navigate to its `http://localhost` URL. Run the repository's Playwright scripts only in an environment where the `playwright` package is available to the project runtime.

### Deployment guidance

- Before deploying Firebase Hosting or directing someone to a development or production deployment, read `docs/development-and-deployment-workflow.md`.

### Live data truthfulness

- Treat live external provider data and canonical scouting submissions as the source of truth.
- Keep the translation layer thin: pass through real event/scouting fields so they remain available as plotting options, formula inputs, and metrics across pages for all seasons and events.
- Do not invent or preserve prototype-era synthetic data paths when a live-backed field is unavailable. Prefer showing the live scalar value, or showing that a trend/component is unavailable, over fabricating derived match-by-match series or season-specific placeholders.
- Do not introduce or preserve pseudo-events that stand in for real events, seasons, or live-backed source states. Prefer wiring the app to real event identities and real source-backed data, and treat pseudo-events as cleanup targets.
- When touching event, metric, or plotting code, actively look for older demo/prototype logic that can leak bogus values into the UI and remove or replace it with live-backed data.
