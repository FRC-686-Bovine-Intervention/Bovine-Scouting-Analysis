# ADR: Season Metric Framework

## Status
Accepted

## Context
The scouting analysis tool needs to ingest scouting spreadsheets whose shape changes from season to season while still presenting a stable experience across Team Detail, Analysis, Matchup, Picklists, Alliance Selection, and future workflows.

We want future seasons to require as little friction as possible. A core question is whether point summations and derived values should live in spreadsheets before import, or whether the app should own those calculations after import.

The current needs include:
- multiple FRC seasons with different scouting schemas
- historical support for at least 2024 onward
- future seasons whose scoring model is not yet known
- consistent derived metrics and badges across all app surfaces
- import tolerance for sheet evolution and legacy templates

## Decisions

### Application Owns Scoring And Derived Logic
- The app is the primary source of truth for scoring totals, derived metrics, normalization rules, and badge inputs.
- Spreadsheets are the primary source of raw observations.
- Spreadsheet-provided precomputed values may be imported as optional external or validation fields, but they do not replace app-owned calculations as the default truth.

### Season Config Drives Behavior
- Each season is defined by versioned code or config, not by scattered logic across views.
- A season package contains:
  - season id
  - display name
  - raw scouting field definitions
  - field aliases for import matching
  - scoring component definitions
  - point-summation rules
  - derived metric definitions
  - badge or threshold rule definitions
  - external metric mapping hints where needed

### Canonical Raw Submission Format
- Every imported scouting row is normalized into one canonical submission shape before any metric calculation.
- The canonical row includes:
  - event identity
  - season identity
  - team and match identity
  - scout identity
  - alliance and station
  - notes
  - normalized raw field bag
  - review and confidence metadata
- Importers are responsible for mapping spreadsheet columns into canonical fields, not for owning game-specific business meaning beyond unavoidable parsing.

### Derived Metric Engine Is Shared Infrastructure
- A shared metric engine computes match-level values, team aggregates, trend series, sortable metrics, and badge inputs from canonical rows plus season config.
- All screens consume the same computed metric model.
- The engine should support multiple scouting aggregation windows, including full-event and recent-match windows, without reimplementing formulas per screen.
- Metric definitions, not view-specific code, decide whether a value is:
  - displayable
  - trendable
  - sortable
  - numeric, percent, count, or rating

### Importers Stay Mapping-Focused
- Importers should:
  - detect or select a template profile
  - map headers into canonical field ids
  - parse booleans, numerics, and enums
  - preserve notes and provenance
  - flag schema gaps and duplicates
- Importers should not duplicate season scoring rules where a season config can express them instead.

### Metrics Registry Powers The UI
- Team Detail selectors, Analysis selectors, Sort Builder, comparison views, and future filters are powered from a registry built from:
  - scouted source metrics
  - external source metrics
  - derived metrics
- Adding a new season metric should usually require:
  - season config update
  - importer mapping update
  - validation
  - not UI rewiring

## Consequences

### Benefits
- One authoritative implementation of season scoring rules reduces drift between spreadsheets, imports, and app displays.
- Derived metrics remain consistent across every app surface.
- Future seasons can be introduced mostly by adding season config and importer mappings.
- Historical and evolving scouting sheets remain supportable through mapping and aliases.
- Confidence, duplicate handling, and review state stay coupled to the same canonical data model as all downstream analysis.

### Costs
- The app must carry a more deliberate season-config and metric-evaluation layer.
- Initial implementation effort is higher than simply reading spreadsheet totals.
- Some spreadsheet formulas may still be useful during migration or validation, so dual-running may be needed temporarily.

### Rejected Alternative
- Rejected: spreadsheets own official point totals and most derived values.
- Reason:
  - business logic would be duplicated across sheets and app
  - seasonal changes would be harder to test centrally
  - mismatches between Team Detail, Analysis, and imported totals would be more likely
  - future UI features would remain coupled to sheet-specific outputs

## Implementation Shape

### Season Package
- Define raw field metadata and aliases.
- Define scoring components and how totals are computed.
- Define derived formulas such as:
  - sums
  - averages
  - success rates
  - percentiles or threshold-driven badge inputs

### Canonical Submission
- Persist a normalized `rawMetrics` bag for each submission.
- Preserve review state separately from raw observations.
- Keep raw notes accessible for team pages and comparisons.

### Computed Team Overlay
- Build a team overlay that exposes:
  - source totals
  - source components
  - source trends
  - derived metrics
  - derived trends
  - review and confidence state

### Validation Strategy
- For each season, validate app-derived totals against trusted sample rows or spreadsheet outputs.
- During migration, allow spreadsheet-computed fields to act as comparison targets rather than primary truth.
- For 2025 and 2026 specifically, the spreadsheet `TeamCalculations` tab is an intended verification source for derived metrics when exported values are available.
- The current verification harness reads exported `TeamCalculations` CSVs from [tests/fixtures](D:/FIRST/Scouting/Scouting-Analysis/tests/fixtures) and compares representative stable metrics while broader denominator-sensitive columns are still being mapped.
- Current migration behavior treats flagged duplicate scouting rows as review-only inputs: they remain visible for confidence and admin workflows, but they do not contribute to authoritative team aggregates.

## Current Implementation Alignment
- The app now partially follows this direction by:
  - expanding season definitions into richer scouted metric definitions
  - driving import headers from season metric definitions
  - storing broader canonical raw metric bags
  - computing some derived metrics from normalized scouting inputs
- Remaining work includes:
  - categorical and histogram-style metrics
  - badge rule configuration
  - TBA-linked derived metrics and ranking-point displays
  - role and distribution metrics for seasons like 2026
  - validation tooling for season-rule changes

## Next Implementation Targets
- Extract season metric definitions into a clearer standalone schema module.
- Separate import mapping metadata from scoring and derived formula metadata.
- Add categorical metric support for:
  - starting position distributions
  - role frequencies
  - note and badge views
- Add configurable badge rules and percentile thresholds.
- Add explicit validation fixtures comparing canonical rows to expected computed outputs.
