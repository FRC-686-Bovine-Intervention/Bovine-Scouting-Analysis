# ADR: Import And Confidence Foundation

## Status
Accepted

## Context
The scouting analysis tool needs to support multiple FRC seasons, including future seasons with unknown scoring breakdowns. We also want to support historical events from 2024 onward, absorb mid-season scouting-sheet evolution, and preserve trust in the face of missing data, duplicate submissions, and partially stale external sources.

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
- Mid-season scouting-schema changes should remain backward-compatible.
- Missing older fields are treated as `missing`, not `0`.

### Raw Data And Provenance
- Raw scouting is stored at the atomic grain of one scout submission for one team in one match.
- Pit scouting is a separate but parallel entry type rather than the same submission record as match scouting.
- Imported and external values remain immutable with provenance.
- Derived metrics are stored separately from imported and external values.
- Derived metrics recompute automatically after imports or syncs.

### Validation And Duplicate Handling
- Submission validity uses three states:
  - `valid`
  - `flagged`
  - `excluded`
- Admins can manually override those states.
- Overrides are stored as separate audit records, not mutations of raw submissions.
- Overrides persist until an admin clears them manually.
- The expected rule of one scout per team per match is a soft constraint.
- Duplicate submissions are retained, flagged, and included in normal analysis with a `needs review` style signal rather than hidden by default.

### Import Strategy
- Imports use a normalized schema with stable identity fields plus a flexible raw-metric bag.
- Required identity fields must map successfully.
- Unknown scoring fields may pass through as unmapped raw metrics rather than blocking import.
- The first importer should be mapping-driven, not a one-off parser for one sheet.
- The proof of concept should support two scouting sheet variants:
  - one current template
  - one representative legacy template

### Auto-Detection
- Importer profile auto-detection is allowed.
- Ambiguous auto-detection must block the import and require an admin choice.
- A successful admin choice may teach the detector for future imports.
- Learned hints are reusable across events in the same season, but not across different seasons.
- Header fingerprints should be normalized before matching.
- Header normalization should include a small explicit synonym dictionary.
- Synonym dictionaries should be scoped per season or import profile, not global.

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

### Missing Data In Rankings
- Weighted criteria with missing inputs should skip the missing term and renormalize the remaining weights.

## Consequences
- We can support multiple seasons without hard-coding season-specific scouting fields into the core model.
- Historical and current scouting sheets can coexist through versioned mappings.
- Confidence becomes explainable and operationally useful during live event strategy.
- Import behavior favors auditability and recoverability over silent guessing.

## Next Implementation Target
- Build schema definitions and validators for:
  - season package
  - raw match scouting submission
  - raw pit scouting submission
  - external metric ingest
  - validation and confidence records
  - reconciled team-match aggregate
- After that, implement the first mapping-driven CSV import path using the current template plus one legacy variant.
