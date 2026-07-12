# ADR: Import And Confidence Foundation

## Status
Accepted

## Context
The scouting analysis tool needs to support multiple FRC seasons, including future seasons with unknown scoring breakdowns. We also want to support historical events from 2024 onward, allow loading any event code even when no scouting data is attached yet, absorb mid-season scouting-schema evolution, and preserve trust in the face of missing data, duplicate submissions, and partially stale external sources.

## Decisions

### Season And Metric Modeling
- Season definitions live in versioned code/config first, not admin-editable UI.
- Each season requires a package with:
  - season id
  - display name
  - metric definitions
  - component definitions
  - import mapping rules
  - season-specific derived-metric heuristics or exclusions
- TBA and Statbotics are expected to have stable season metrics before the first event of the year.
- Team scouting schema may evolve during the season and must be explicitly versioned within the season.
- Mid-season scouting-schema changes are allowed and may be backward-incompatible at the field-name level.
- Schema drift is handled by explicit diffing and dependency diagnostics rather than by assuming backward compatibility.
- Missing older fields are treated as `missing`, not `0`.

### Raw Data And Provenance
- Each event is represented by an event-scoped workspace that can exist with:
  - external sources only
  - scouting sources only
  - both external and scouting sources
- Raw scouting is stored at the atomic grain of one scout submission for one team in one match.
- Pit scouting is a separate but parallel entry type rather than the same submission record as match scouting.
- Imported and external values remain immutable with provenance.
- Derived metrics are stored separately from imported and external values.
- Derived metrics recompute automatically after imports or syncs.
- Each external or scouting source records refresh metadata, provenance, and freshness state separately.

### Validation And Duplicate Handling
- Submission validity uses three states:
  - `valid`
  - `flagged`
  - `excluded`
- Admins can manually override those states.
- Overrides are stored as separate audit records, not mutations of raw submissions.
- Overrides persist until an admin clears them manually.
- The expected rule of one scout per team per match is a soft constraint.
- Duplicate submissions are retained and flagged for review.
- Until explicit merge rules are defined, flagged duplicate submissions should not contribute to authoritative aggregates by default.

### Import Strategy
- The app supports loading any event code from external providers even when no scouting dataset is attached.
- Imports use a normalized schema with stable identity fields plus a flexible raw-metric bag.
- Canonical scouting import/export format is JSON.
- Legacy spreadsheet and CSV imports are supported through thin translators that normalize into the canonical JSON-aligned submission model.
- Required identity fields must map successfully.
- Unknown scoring fields may pass through as unmapped raw metrics rather than blocking import.
- Every event may have zero or more attached scouting sources, each keyed to the event and loaded automatically when that event is revisited.
- The thin import translator remains the only place that performs source-specific column remapping for legacy sheet inputs.

### Auto-Detection
- Importer profile auto-detection is allowed.
- Ambiguous auto-detection must block the import and require an admin choice.
- A successful admin choice may teach the detector for future imports.
- Learned hints are reusable across events in the same season, but not across different seasons.
- Header fingerprints should be normalized before matching.
- Header normalization should include a small explicit synonym dictionary.
- Synonym dictionaries should be scoped per season or import profile, not global.

### Schema Drift And Dependency Diagnostics
- Scouting schema changes are evaluated as explicit diffs between field sets.
- Added fields become newly available metrics.
- Removed fields disappear from available metrics and trigger dependency warnings where used.
- Renamed fields are treated as one removal plus one addition unless an explicit migration mapping is provided.
- Derived equations that depend on missing fields are flagged transitively.
- Picklists and filters that depend on missing fields or broken derived equations are flagged transitively.
- Dependency warnings are event-scoped and recomputed after every scouting-source refresh.

### Confidence Model
- Confidence is a first-class output at multiple layers:
  - metric
  - team summary
  - ranking
- Confidence is represented as simple tiers:
  - `high`
  - `medium`
  - `low`
- UI should show the tier by default and expose contributing reasons on hover.
- Reasons are system-generated only in v1.
- Initial standardized reasons include:
  - `missing_metric`
  - `sparse_matches`
  - `flagged_submission`
  - `duplicate_submission`
  - `schema_gap`
  - `manual_override`
  - `derived_from_partial_inputs`
  - `external_source_stale`
- The displayed tier is the worst contributing tier, while hover details show all reasons.
- Weighted rankings inherit confidence from their inputs only.
- Inputs count toward ranking confidence only if they have at least `10%` effective weight after renormalization.
- The `10%` threshold is global in v1.
- If an input is skipped due to missing-data handling, it should not lower final ranking confidence.
- External-source gaps should use distinct reasons from internal scouting gaps.
- External-source confidence staleness uses one global freshness rule in v1.

### Refresh And Polling
- TBA, Statbotics, pRidge, and attached scouting sources may all refresh while an event is in progress.
- Refresh behavior is source-specific and records:
  - last successful sync
  - last attempted sync
  - freshness status
  - fetch or parse errors
- Refreshing a scouting source triggers:
  - canonical re-import
  - schema diffing
  - duplicate re-evaluation
  - dependency re-evaluation
  - downstream metric recomputation

### Missing Data In Rankings
- Weighted criteria with missing inputs should skip the missing term and renormalize the remaining weights.

## Consequences
- We can support multiple seasons without hard-coding season-specific scouting fields into the core model.
- Historical and current scouting sheets can coexist through thin translators and versioned mappings.
- Any event can be explored from external sources before scouting data is available.
- Scouting attachments become durable event assets instead of one-off imports.
- Confidence becomes explainable and operationally useful during live event strategy.
- Import behavior favors auditability and recoverability over silent guessing.

## Next Implementation Target
- Build the event workspace model and source registry for:
  - arbitrary event-code loading
  - external-source snapshots and freshness metadata
  - scouting-source attachments
  - canonical scouting JSON payloads
  - schema diff and dependency diagnostics
  - validation and confidence records
- After that, implement JSON-first scouting import plus legacy thin translators for existing sheet formats.
