# FRC Scouting Analysis Tool Plan

## Summary
Build a responsive, browser-first scouting analysis app for FRC event strategy. The app uses an internal database as the source of truth, supports multiple simultaneous users, and focuses first on live event workflows: team analysis, event-wide comparison, matchup planning, picklists, and alliance selection. The data model and metric engine should already support later season-wide views, but the initial UI remains event-first.

## Core product decisions
- The canonical project root is `D:\FIRST\Scouting\Scouting-Analysis`.
- Preserve the existing git repository and work from it directly.
- Keep the existing `initial prompt.txt` and `box and whisker example.png` as project artifacts.
- Use lightweight username-based login for normal users.
- Add admin capability for destructive actions such as deleting imports, shared picklists, alliance-selection state, and users.
- Treat mutable strategy artifacts as live shared state across users.
- Scope the primary UI to one event at a time.
- Design the data model to support future season-wide statistics even though that UI is deferred.

## Main workflows
- Landing/login page with existing-user selection, new-user creation, and theme preference persistence.
- Event home with navigation to Teams, Analysis, Match Schedule, Matchup, Data Quality, Picklists, and Alliance Selection.
- Teams view with numerical ordering, TBA or pit-photo thumbnail, and click-through team summary pages.
- Individual team page with metric-over-match charts, metric component breakdowns, configurable radar charts, and team status flags.
- Analysis view with event-wide horizontal box-and-whisker comparison, selectable driving metric, event-average reference line, and visible annotations for broken, inconsistent, or defense-affected teams.
- Match schedule and alliance-vs-alliance views for six-team matchup planning.
- Shared picklists with criteria-edit mode, drag-and-drop mode, and saveable named lists.
- Alliance selection board with multiple picklist columns, live shared state, drag-and-drop/manual entry, and picked-team highlighting.
- Data quality review for outliers, suspect data, and conflicting scouting signals.

## Data model direction
Primary entities:
- `User`
- `Event`
- `Team`
- `Match`
- `Alliance`
- `ScoutingMatchEntry`
- `PitEntry`
- `ImportedDataset`
- `MetricDefinition`
- `MetricValue`
- `Picklist`
- `PicklistVersion`
- `AllianceSelectionState`
- `TeamFlag`

Important contracts:
- Scouting import rows should carry event id, team number, match number, scout id, raw scoring fields, defense indicators, robot-status indicators, and notes.
- Metric definitions should support source, scope, components, weights or formulas, display format, and chartability flags.
- Shared picklists and alliance-selection artifacts should store event id, name, version, ordering payload, annotations, and editor timestamps.
- Team flags should cover `broken`, `declining`, `inconsistent`, `defense_specialist`, `data_suspect`, and `do_not_pick`, each with evidence text.

## Data ingestion and metrics
- Admins manually import scouting spreadsheets into the internal database per event.
- External metrics such as EPA, OPR, DPR, CCWM, and pRidge should be integrated in v1, not postponed.
- All imports should record provenance and import timestamps.
- Derived metrics should be recomputed after imports, including summary values, consistency indicators, decline detection, broken-robot heuristics, defensive-impact signals, and data-quality flags.

## Validation checklist
- Future implementation and git work should run from `D:\FIRST\Scouting\Scouting-Analysis`.
- `git status` should continue to reflect the existing repo state without overwriting history.
- No bulk copy from the Codex scratch workspace should occur.
- Planning artifacts needed for implementation should live in this repo rather than only in the temporary thread.
