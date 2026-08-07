# Bovine Scouting Analysis Tool Review Plan

## Summary
Build a responsive, browser-first scouting analysis app for FRC event strategy. The app supports multiple simultaneous users, uses an internal database as the source of truth, and focuses v1 on one active event at a time: team analysis, event-wide comparison, matchup planning, picklists, alliance selection, and data quality review.

The system should be season-adaptable. Game-specific scoring components are configured per season, while the app's core data model, metric engine, weighted evaluation criteria, and UI workflows remain reusable across FRC games.

## Core Product Decisions
- Use lightweight username-based login with no password for normal users.
- Show existing users at login and allow creating a new user.
- Persist user preferences, including light/dark theme.
- Include admin capability for destructive actions, imports, external sync settings, users, shared picklists, and alliance-selection state.
- Treat picklists and alliance-selection data as live shared event state.
- Keep v1 event-first, while designing data structures to support future season-wide analysis.
- Store planning artifacts in `docs/`, including the original prompt and box-and-whisker reference image.

## Data And Metrics
- Scouter data enters through manual Google Sheets/CSV/XLSX-style imports.
- Import rows must identify event, match, team, scout/user, raw scoring fields, defense indicators, robot-status indicators, and notes.
- External metric sources are app-managed syncs:
  - Statbotics EPA: https://www.statbotics.io/docs/rest
  - TBA OPR/DPR/CCWM and event data: https://www.thebluealliance.com/apidocs
- pRidge via `scoutR`, referenced from: https://www.chiefdelphi.com/t/introducing-prior-ridge-regularization-for-frc-rating/519531
  - Treat pRidge as a per-event total-only external artifact, not a locally synthesized component model.
- TBA credentials are stored in admin settings.
- External refresh is manually triggered by admins to avoid rankings changing unexpectedly during strategy discussion.
- All imports and syncs record provenance, timestamps, validation status, and source metadata.
- Derived metrics recompute after imports/syncs, including summaries, trends, consistency, broken-robot signals, defensive impact, and data-quality flags.

## Season Abstraction Strategy
- Treat each event as belonging to a season definition that describes only the scoring components available that year.
- Store external and scouter statistics as generic `source -> total + components` data rather than hard-coded per-season fields.
- Keep derived metrics such as consistency and defensive impact outside the season scoring schema so they can be reused every year.
- Seed and validate the framework with event catalogs from 2024 onward.
- Future seasons may use generic placeholder components until a real game breakdown is known; the UI and criteria builder should still function.

## Key Data Concepts
- `User`
- `Event`
- `Team`
- `Match`
- `Alliance`
- `ScoutingMatchEntry`
- `PitEntry`
- `ImportedDataset`
- `ExternalSyncConfig`
- `MetricSource`
- `MetricDefinition`
- `MetricValue`
- `EvaluationCriteria`
- `Picklist`
- `PicklistVersion`
- `AllianceSelectionState`
- `TeamFlag`

`EvaluationCriteria` is a saved named weighted sum over any numeric metric, including scouter components, EPA, OPR/DPR/CCWM, pRidge, and derived app metrics. These criteria are reusable across Analysis, Teams, Picklists, Matchups, and Alliance Selection.

`TeamFlag` supports `broken`, `declining`, `inconsistent`, `defense_specialist`, `data_suspect`, and `do_not_pick`, each with severity and evidence text.

## Main Workflows
- Login page with user selection, user creation, and theme toggle.
- Event home with navigation to Teams, Analysis, Match Schedule, Matchup, Data Quality, Picklists, and Alliance Selection.
- Teams view lists teams numerically with TBA or pit-photo thumbnails and links to team pages.
- Team page shows metric breakdowns, metric-over-match charts, configurable radar charts, notes, and flags.
- Analysis tab shows event-wide ranked horizontal distribution charts inspired by `docs/box and whisker example.png`.
- Match Schedule lists event matches; clicking a match opens the alliance-vs-alliance matchup view.
- Matchup view shows red alliance over blue alliance, with team tiles, summary stats, radar charts, and links to team pages.
- Data Quality reviews outliers, missing data, impossible values, conflicting scout entries, and suspicious performance swings.
- Picklists support criteria-edit mode, drag-and-drop manual mode, named saves, and warnings before criteria mode overwrites manual ordering.
- Alliance Selection loads multiple picklists as columns, shows the selection board, supports drag/drop or manual team entry, and marks picked teams across all visible lists.

## Analysis Tab Details
- The default chart is a ranked horizontal box-and-whisker-style event comparison.
- Users can select raw metrics, component metrics, saved weighted criteria, pRidge, EPA, OPR/DPR/CCWM, or derived metrics.
- Each team row shows team identity, distribution across matches, center marker, summary value, and flags.
- Include an event-average vertical reference line for the selected metric.
- Default sort is selected metric descending.
- Sparse or suspect data remains visible but clearly flagged.
- Defense-marked matches are excluded or discounted from offensive decline and consistency penalties.

## Test Plan
- Import accepts a known-good scouting spreadsheet and rejects rows missing event/team/match identity.
- External sync stores Statbotics and TBA data with provenance and visible refresh status.
- pRidge sync stores an event-total value that works like any other numeric metric, while missing pRidge remains an explicit source-gap state.
- Weighted criteria produce consistent rankings across Analysis and Picklists.
- Defense-marked matches do not unfairly penalize offensive trend or consistency.
- Analysis handles complete data, sparse data, no-data teams, outliers, and suspect entries.
- Team flags render consistently across Analysis, Teams, Picklists, Matchups, and Alliance Selection.
- Shared picklists and alliance-selection state remain consistent across multiple simultaneous users.

## Assumptions
- Normal users can create saved weighted criteria unless later restricted by admin settings.
- Any numeric metric can be used in weighted criteria.
- V1 is browser-first rather than native-app-first.
- The active UI is scoped to one event at a time.
- Season-wide analysis is supported by the data model but deferred in the UI.
