# ADR: Season Metric Framework

## Status
Accepted

## Context
The scouting analysis tool needs to ingest scouting datasets whose shape changes from season to season while still presenting a stable experience across Team Detail, Analysis, Matchup, Picklists, Alliance Selection, and future workflows.

We want future seasons to require as little friction as possible. A core question is whether point summations and derived values should live in spreadsheets before import, or whether the app should own those calculations after import.

The current needs include:
- multiple FRC seasons with different scouting schemas
- arbitrary event-code loading even when no scouting dataset is attached
- historical support for at least 2024 onward
- future seasons whose scoring model is not yet known
- consistent derived metrics and badges across all app surfaces
- import tolerance for schema evolution, legacy templates, and canonical JSON feeds

## Decisions

### Application Owns Scoring And Derived Logic
- The app is the primary source of truth for scoring totals, derived metrics, normalization rules, and badge inputs.
- Scouting exports are the primary source of raw observations.
- Spreadsheet-provided precomputed values may be imported as optional external or validation fields, but they do not replace app-owned calculations as the default truth.

### Event Workspace Owns Source Composition
- Each loaded event is represented by an event workspace.
- An event workspace may combine:
  - TBA data
  - Statbotics data
  - pRidge data
  - zero or more attached scouting datasets
- The app must remain useful when only external sources are available.
- Scouting attachments are event-scoped durable assets, not transient import sessions.

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
- Every scouting row is normalized into one canonical submission shape before any metric calculation.
- The canonical row includes:
  - event identity
  - season identity
  - team and match identity
  - scout identity
  - alliance and station
  - notes
  - normalized raw field bag
  - provenance metadata
  - review and confidence metadata
- Canonical import and export format is JSON.
- Legacy spreadsheet and CSV inputs are supported through thin translators into the canonical submission shape.
- Importers are responsible for mapping source fields into canonical fields, not for owning game-specific business meaning beyond unavoidable parsing.

### Derived Metric Engine Is Shared Infrastructure
- A shared metric engine computes match-level values, team aggregates, trend series, sortable metrics, and badge inputs from canonical rows plus season config and external-source overlays.
- All screens consume the same computed metric model.
- The engine should support multiple scouting aggregation windows, including full-event and recent-match windows, without reimplementing formulas per screen.
- Metric definitions, not view-specific code, decide whether a value is:
  - displayable
  - trendable
  - sortable
  - numeric, percent, count, rating, or categorical

### Schema Drift Is First-Class
- The app tracks the active scouting schema per attached dataset.
- Field additions, removals, and type changes update the metric registry automatically.
- Removed fields do not silently coerce to zero.
- Renames are treated as remove-plus-add unless an explicit migration mapping exists.
- Derived equations, filters, and picklists are dependency-checked against the active field registry and flagged transitively when inputs disappear.

### Importers Stay Mapping-Focused
- Importers should:
  - detect or select a template profile where applicable
  - map source fields into canonical field ids
  - parse booleans, numerics, enums, and notes
  - preserve provenance
  - flag schema gaps and duplicates
- Importers should not duplicate season scoring rules where a season config can express them instead.

### Metrics Registry Powers The UI
- Team Detail selectors, Analysis selectors, Sort Builder, comparison views, and future filters are powered from a registry built from:
  - scouting source metrics
  - external source metrics
  - derived metrics
- Adding a new season metric should usually require:
  - season config update
  - optional translator mapping update
  - validation
  - not UI rewiring

## Consequences

### Benefits
- One authoritative implementation of season scoring rules reduces drift between JSON feeds, legacy sheet imports, and app displays.
- Derived metrics remain consistent across every app surface.
- Future seasons can be introduced mostly by adding season config and optional translator mappings.
- Historical and evolving scouting sources remain supportable through canonical submissions plus mapping/alias layers.
- Confidence, duplicate handling, and review state stay coupled to the same canonical data model as all downstream analysis.

### Costs
- The app must carry a more deliberate event-workspace, season-config, and metric-evaluation layer.
- Initial implementation effort is higher than simply reading spreadsheet totals.
- Some spreadsheet formulas may still be useful during migration or validation, so dual-running may be needed temporarily.

### Rejected Alternative
- Rejected: spreadsheets own official point totals and most derived values.
- Reason:
  - business logic would be duplicated across sheets and app
  - seasonal changes would be harder to test centrally
  - mismatches between Team Detail, Analysis, and imported totals would be more likely
  - future UI features would remain coupled to source-specific outputs

## Implementation Shape

### Season Package
- Define raw field metadata and aliases.
- Define scoring components and how totals are computed.
- Define derived formulas such as:
  - sums
  - averages
  - success rates
  - weighted scores
  - categorical or distribution summaries
  - threshold-driven badge inputs

### Canonical Submission
- Persist a normalized `rawMetrics` bag for each submission.
- Preserve review state separately from raw observations.
- Keep raw notes accessible for team pages and comparisons.
- Preserve per-source provenance so users can tell whether data came from JSON export, legacy sheet translation, or another attached source.

### Event Workspace Overlay
- Build an event overlay that exposes:
  - source totals
  - source components
  - source trends
  - derived metrics
  - derived trends
  - review and confidence state
  - source freshness state
  - schema and dependency warnings

### Validation Strategy
- For each season, validate app-derived totals against trusted sample rows or exported spreadsheet outputs where they exist.
- During migration, allow spreadsheet-computed fields to act as comparison targets rather than primary truth.
- For 2025 and 2026 specifically, the spreadsheet `TeamCalculations` tab is an intended verification source for derived metrics when exported values are available.
- Current migration behavior treats flagged duplicate scouting rows as review-only inputs: they remain visible for confidence and admin workflows, but they do not contribute to authoritative team aggregates by default.

## Current Implementation Alignment
- The app now partially follows this direction by:
  - expanding season definitions into richer scouted metric definitions
  - driving import headers from season metric definitions
  - storing broader canonical raw metric bags
  - computing some derived metrics from normalized scouting inputs
- Remaining work includes:
  - event workspaces for arbitrary event-code loading
  - attached scouting-source persistence
  - JSON-first canonical import/export
  - schema and dependency diagnostics
  - categorical and histogram-style metrics
  - badge rule configuration
  - refresh and freshness tooling
  - validation tooling for season-rule changes

## Next Implementation Targets
- Build an event workspace module and source registry.
- Separate import mapping metadata from scoring and derived formula metadata.
- Add canonical scouting JSON schemas and validators.
- Add dependency validation for derived equations, filters, and picklists.
- Add configurable badge rules and percentile thresholds.
- Add explicit validation fixtures comparing canonical rows to expected computed outputs.
