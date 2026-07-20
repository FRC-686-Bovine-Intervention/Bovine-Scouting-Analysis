## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues. External PRs are not part of the triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

This repo uses the default triage label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This repo is configured as a single-context repo. See `docs/agents/domain.md`.

### Live data truthfulness

- Treat live external provider data and canonical scouting submissions as the source of truth.
- Keep the translation layer thin: pass through real event/scouting fields so they remain available as plotting options, formula inputs, and metrics across pages for all seasons and events.
- Do not invent or preserve prototype-era synthetic data paths when a live-backed field is unavailable. Prefer showing the live scalar value, or showing that a trend/component is unavailable, over fabricating derived match-by-match series or season-specific placeholders.
- Do not introduce or preserve pseudo-events that stand in for real events, seasons, or live-backed source states. Prefer wiring the app to real event identities and real source-backed data, and treat pseudo-events as cleanup targets.
- When touching event, metric, or plotting code, actively look for older demo/prototype logic that can leak bogus values into the UI and remove or replace it with live-backed data.
