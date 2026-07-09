# Season Metric Framework Checklist

## Purpose
Turn the decisions in [adr-season-metric-framework.md](D:/FIRST/Scouting/Scouting-Analysis/docs/adr-season-metric-framework.md) into an implementation sequence we can execute incrementally without losing working app behavior.

## Current Position
- Season definitions now drive more than just scoring components.
- Imports can already carry richer normalized `rawMetrics`.
- The app can already compute some season-derived metrics from normalized scouting data.
- Team overlay and trend shaping now live in [src/metric-engine.js](D:/FIRST/Scouting/Scouting-Analysis/src/metric-engine.js) instead of being embedded directly in [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js).
- The metric engine now supports authoritative `All Matches` and `Recent N` scouting windows, with `N` configurable in the app.
- Flagged duplicate scouting rows no longer contribute to authoritative scouting aggregates, but they still drive low-confidence review signals.
- A focused regression harness exists in [tests/metric-engine.test.mjs](D:/FIRST/Scouting/Scouting-Analysis/tests/metric-engine.test.mjs) for core engine behavior.
- The remaining work is mostly about structure, validation, categorical displays, and badge/config support.

## Phase 1: Stabilize The Foundation
- [x] Extract season definitions from [src/real-event-data.js](D:/FIRST/Scouting/Scouting-Analysis/src/real-event-data.js) into a dedicated schema module.
- [ ] Separate these concerns inside season config:
  - raw field definitions
  - import aliases
  - scoring rules
  - derived metric formulas
  - badge rules
- [ ] Define one explicit TypeScript-like contract in docs for a canonical scouting submission.
- [ ] Define one explicit contract in docs for a metric registry entry.
- [~] Reduce duplicated helper logic between [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js) and [src/import-foundation.js](D:/FIRST/Scouting/Scouting-Analysis/src/import-foundation.js).
Shared season helpers, metric-engine logic, and raw sheet adapters are extracted, but some analysis/distribution helpers still live only in the app.

## Phase 2: Make Metric Computation More General
- [x] Move season-derived metric evaluation out of team overlay code into a dedicated metric-engine helper.
- [ ] Support formula types beyond the current first-pass set:
  - sum
  - average
  - success rate
  - weighted score
  - enum mapping
  - percentile input
- [ ] Distinguish clearly between:
  - point totals
  - scouting counts
  - percentages
  - ratings
  - categorical distributions
- [ ] Add support for derived metrics that consume external metrics and scouting metrics together.

## Phase 3: Finish Raw Field Coverage
- [ ] Audit 2024 prompt requirements against implemented fields.
- [ ] Audit 2025 prompt requirements against implemented fields.
- [ ] Audit 2026 prompt requirements against implemented fields.
- [ ] Add missing numeric fields where they are still absent from normalized imports.
- [ ] Preserve categorical raw fields needed for histogram or frequency displays, even when they are not directly numeric.
- [ ] Ensure note fields remain queryable by match and team for later display surfaces.

## Phase 4: Add Categorical And Distribution Metrics
- [ ] Add starting-position distribution support for seasons that need it.
- [ ] Add role-frequency support for 2026 shifts and future role-based games.
- [ ] Add histogram or percentage-summary rendering for categorical metrics in Team Detail.
- [ ] Decide which categorical metrics should also appear in Analysis and how they should be visualized there.
- [ ] Add support for note rollups on Team Detail and comparison surfaces.

## Phase 5: Badge Framework
- [ ] Define configurable badge rules in season config or global config.
- [ ] Support threshold types such as:
  - top percentile
  - fixed numeric threshold
  - rolling recent-match condition
  - sticky-until-cleared state
- [ ] Implement prompt-driven badge cases first:
  - broken
  - no-show
  - defense
  - defense avoidance
  - foul warning
- [ ] Make badge evidence text derive from the same metric engine outputs.

## Phase 6: Spreadsheet And Import Hardening
- [ ] Support raw spreadsheet imports as the primary mode.
- [ ] Support optional spreadsheet-precomputed columns as comparison or fallback inputs.
- [ ] Mark precomputed spreadsheet values with provenance so they are not mistaken for app-derived truth.
- [ ] Improve importer tolerance for mid-season column renames through alias sets.
- [ ] Add season-scoped profile detection hints rather than relying only on global header matching.

## Phase 7: Validation And Trust
- [~] Create season validation fixtures with trusted rows and expected computed outputs.
Core engine regression coverage exists, representative trusted fixtures now exist for 2024, 2025, and 2026 in [tests/season-metric-fixtures.json](D:/FIRST/Scouting/Scouting-Analysis/tests/season-metric-fixtures.json), and normalized real-row samples now exist in [tests/season-import-row-fixtures.json](D:/FIRST/Scouting/Scouting-Analysis/tests/season-import-row-fixtures.json), but broader season sample sets are still missing.
- [ ] Add regression tests for:
  - import normalization
  - season scoring totals
  - derived metrics
  - duplicate handling
  - confidence propagation
- [ ] Add explicit validation cases comparing app-derived values against trusted spreadsheet outputs during migration.
- [~] Add explicit validation cases comparing app-derived values against trusted spreadsheet outputs during migration.
A local comparison harness now exists in [tests/spreadsheet-comparison.test.mjs](D:/FIRST/Scouting/Scouting-Analysis/tests/spreadsheet-comparison.test.mjs) with fixture-backed expected outputs plus representative `All Matches` and `Recent` checks against the exported 2025 and 2026 `TeamCalculations` tabs in [tests/fixtures](D:/FIRST/Scouting/Scouting-Analysis/tests/fixtures). The exported `Recent` windows currently align best with `N = 4`. The remaining work is to widen those representative comparisons into broader exact migration checks for columns whose denominator semantics are still unresolved, especially 2025 defense-related ratings and several 2026 role-rating averages.
- [ ] Decide acceptable drift thresholds for floating-point or estimation-based metrics.

## Phase 8: External Metrics Integration
- [ ] Define how TBA-only values enter the metric registry.
- [ ] Define how ranking-point bonuses and co-op style values appear in Team Detail and Analysis.
- [ ] Distinguish raw external metrics from app-derived external metrics.
- [ ] Add provenance labels so users can tell whether a metric came from scouting, TBA, Statbotics, or local derivation.

## Phase 9: UI Follow-Through
- [ ] Group Team Detail metric selectors by category for usability.
- [ ] Group Analysis selector options by source and type.
- [ ] Prevent selector overload by hiding unsupported visualizations for certain metric types.
- [ ] Add lightweight explanation text for percent, rating, and distribution metrics where needed.
- [ ] Confirm Picklists, Matchup, and comparison views can consume the expanded metric registry cleanly.

## Recommended Near-Term Sequence
1. Extract season schema and shared helpers.
2. Create a dedicated metric engine module.
3. Add validation fixtures for 2024, 2025, and 2026.
4. Finish missing raw-field coverage from the prompt.
5. Add categorical/distribution rendering.
6. Add badge configuration and evidence generation.

## Definition Of Done For The Framework
- A new season can be introduced mostly by:
  - adding a season config
  - adding importer aliases or mappings
  - validating trusted sample outputs
- No UI screen needs bespoke season-specific logic for ordinary metrics.
- The same metric definition drives import, storage, trending, sorting, and display behavior.
- Spreadsheet formulas are optional validation aids, not the app's primary source of truth.
