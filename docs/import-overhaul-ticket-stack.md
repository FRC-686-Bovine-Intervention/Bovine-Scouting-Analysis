# Import Overhaul Ticket Stack

## Purpose
This is a publish-ready ticket stack for the import overhaul described in [import-overhaul-implementation-spec.md](D:/FIRST/Scouting/Scouting-Analysis/docs/import-overhaul-implementation-spec.md).

The intended issue style is tracer-bullet tickets with clear dependencies, tight scope, and explicit acceptance criteria.

## Recommended Labels
- `ready-for-agent`
- `enhancement`
- `import`
- `architecture`

Add additional labels per ticket where useful, for example:
- `research`
- `data-model`
- `external-sync`
- `ui`
- `tests`

## Ticket 1

### Title
Import overhaul: introduce EventWorkspace and source registry

### Why
The current app hydrates event state from a static event model plus imported scouting submissions. We need an event-scoped workspace that can represent arbitrary event codes, external-source state, scouting attachments, freshness metadata, and downstream issue state.

### Scope
- Define the `EventWorkspace` model.
- Define source-state contracts for TBA, Statbotics, pRidge, and scouting attachments.
- Add storage contracts for event workspaces.
- Refactor event hydration entry points to load through a workspace layer.
- Keep existing sample-backed events working during the transition.

### Dependencies
- None

### Acceptance Criteria
- An event workspace can be created for any event key.
- Workspace state can represent external-only events with no scouting attachment.
- Existing sample-backed event flows still function.
- [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js) no longer owns the full event hydration flow directly.

## Ticket 2

### Title
Import overhaul: load arbitrary event codes from external providers

### Why
Users should be able to type any event code and immediately work with team stats, matchups, and analysis even when scouting data is unavailable.

### Scope
- Add event-code lookup flow.
- Resolve season and event identity from external sources.
- Load TBA data into the event workspace.
- Load Statbotics data into the event workspace.
- Load pRidge data into the event workspace.
- Handle partial-source failures gracefully with freshness and provenance warnings.

### Dependencies
- Blocked by: Ticket 1

### Acceptance Criteria
- Entering a valid event code creates or loads a workspace.
- Team list, schedule, matchup, and analysis views work without scouting data.
- Missing one external source does not prevent the event from loading.
- Source freshness and last refresh metadata are available in workspace state.

## Ticket 3

### Title
Import overhaul: define canonical scouting JSON schema and validators

### Why
We want to move from spreadsheet-first imports toward a generic scouting framework with JSON as the canonical import/export format.

### Scope
- Define the canonical scouting JSON format.
- Define required `meta`, `schema`, and `entries` sections.
- Validate identity fields and raw metrics.
- Define canonical shapes for match scouting entries.
- Add fixture-backed validation tests.

### Dependencies
- Blocked by: Ticket 1

### Acceptance Criteria
- A canonical JSON file can be validated before import.
- Invalid files produce actionable validation errors.
- Canonical entries map cleanly onto the current normalized submission model.
- Tests cover valid and invalid canonical JSON payloads.

## Ticket 4

### Title
Import overhaul: convert legacy sheet adapters into canonical thin translators

### Why
Existing spreadsheet imports should remain usable, but only as thin translators into the canonical scouting model.

### Scope
- Define a translator contract that outputs canonical schema plus canonical entries.
- Update 2024, 2025, and 2026 sheet adapters to use that contract.
- Preserve current profile detection where still needed.
- Preserve translator version metadata for refresh and repair logic.
- Keep source-specific remapping out of the core metric engine.

### Dependencies
- Blocked by: Ticket 3

### Acceptance Criteria
- Existing sheet imports normalize into canonical entries rather than ad hoc CSV-only flows.
- Translator version metadata is preserved.
- Current 2024, 2025, and 2026 imports remain supported.
- Tests prove parity for representative legacy rows.

## Ticket 5

### Title
Import overhaul: support event-scoped scouting attachments and auto-load

### Status
Completed for the current browser-app scope.

### Why
A scouting file should be attachable to an event and should reload automatically whenever that event is revisited.

### Scope
- Define scouting attachment records in workspace state.
- Persist attachment metadata separately from imported submissions.
- Support at least one attached scouting source per event.
- Auto-load attached scouting data when the event opens.
- Always route attached sheet-based sources through the thin translator.

### Dependencies
- Blocked by: Ticket 1
- Blocked by: Ticket 3
- Blocked by: Ticket 4

### Acceptance Criteria
- An event can store an attached scouting source definition.
- Reopening the event reloads the attached scouting data automatically.
- Attachment metadata includes source location, format, translator id, schema signature, and last successful import metadata.
- The app still works when an event has no scouting attachment.

### Closeout Notes
- Event-scoped scouting attachments are modeled and persisted in the event workspace.
- Attached remote sheet, remote JSON, and embedded-sample sources reload automatically when an event is reopened.
- Attachment metadata persists separately from imported scouting submissions.
- Legacy sheet-based attachments still route through the thin translator layer.
- Persisted local-file attachment reopening is intentionally deferred to Ticket 11 because the current browser-only app cannot reliably reopen local files without a helper/runtime decision.

## Ticket 6

### Title
Import overhaul: add schema diffing and dependency diagnostics

### Why
Scouting forms may change during or between events. Added, removed, renamed, or type-changed fields must update the metric registry and flag broken downstream definitions.

### Scope
- Add schema diffing between prior and current scouting schemas.
- Model `added`, `removed`, and `type_changed` field outcomes.
- Build a dependency graph for raw fields, derived equations, filters, and picklists.
- Flag broken dependencies hierarchically.
- Recompute dependency issues after every scouting refresh.

### Dependencies
- Blocked by: Ticket 3
- Blocked by: Ticket 5

### Acceptance Criteria
- Added scouting fields become available metrics.
- Removed scouting fields disappear from available metrics.
- Derived equations depending on missing fields are flagged transitively.
- Picklists and filters depending on broken fields or equations are flagged transitively.
- Tests cover add/remove/type-change scenarios.

## Ticket 7

### Title
Import overhaul: formalize duplicate handling and review-only aggregate exclusion

### Why
Duplicate match scouting entries need a clear authoritative behavior during live events before any future merge strategy is introduced.

### Scope
- Confirm duplicate identity rules.
- Centralize duplicate detection in canonical import flow.
- Preserve duplicate rows for review.
- Exclude flagged duplicate groups from authoritative team aggregates by default.
- Surface duplicate groups clearly in Data Quality and confidence state.

### Dependencies
- Blocked by: Ticket 3

### Acceptance Criteria
- Duplicate groups are identified by event, match, and team.
- Duplicate rows remain visible for review.
- Duplicate rows do not affect authoritative team overlays by default.
- Confidence and issue state reflect duplicate warnings consistently.

## Ticket 8

### Title
Import overhaul: add source refresh model, polling, and stale-data UX

### Why
TBA, Statbotics, pRidge, and attached scouting data can all change during live events. We need a reliable refresh model with clear freshness state and safe recomputation.

### Scope
- Add refresh metadata to all source states.
- Add manual refresh actions.
- Add polling intervals and failure backoff.
- Recompute canonical imports, schema diffs, dependency issues, duplicates, and overlays only when source content changes.
- Surface stale or failed sources in the UI.

### Dependencies
- Blocked by: Ticket 2
- Blocked by: Ticket 5
- Blocked by: Ticket 6
- Blocked by: Ticket 7

### Acceptance Criteria
- Each source tracks last attempted refresh, last successful refresh, and freshness status.
- Attached scouting sources can refresh and trigger safe recomputation.
- External-source refresh failures degrade gracefully instead of breaking the workspace.
- Users can see which source is stale or failed.

## Ticket 9

### Title
Import overhaul: migrate 2024, 2025, and 2026 scouting data into canonical JSON fixtures

### Why
We want historical scouting datasets in the new canonical format and need a validation baseline for the migration.

### Scope
- Convert current 2024, 2025, and 2026 spreadsheet-backed scouting data into canonical JSON fixtures.
- Preserve the data represented in the current sheets.
- Validate converted data against representative trusted derived outputs.
- Use these fixtures as regression inputs for future import work.

### Dependencies
- Blocked by: Ticket 3
- Blocked by: Ticket 4

### Acceptance Criteria
- Canonical JSON fixtures exist for 2024, 2025, and 2026.
- Converted datasets reproduce representative existing outputs closely enough for migration confidence.
- Fixture-backed regression tests cover the canonical migration path.

## Ticket 10

### Title
Research scouting JSON conventions and community export shapes

### Why
Before we lock the long-term canonical JSON format, we should compare the current Team 686 export shape and a few community approaches to avoid inventing something awkward.

### Scope
- Inspect the `two026` JSON export shape.
- Compare it against the app’s canonical needs.
- Review a few community/public scouting-export conventions where available.
- Recommend whether to adopt, adapt, or replace the observed structures.
- Capture the result in a short research note or ADR follow-up.

### Dependencies
- None

### Acceptance Criteria
- We have a documented recommendation for the canonical scouting JSON shape.
- The recommendation names required fields, optional fields, and rejected alternatives.
- The result is actionable for Ticket 3.

## Ticket 11

### Title
Import overhaul: support local scouting file attachments outside the browser-only sandbox

### Why
Ticket 5 now covers event-scoped scouting attachments, persisted attachment metadata, and automatic reload for embedded samples and remote URL sources. The remaining gap is reopening local CSV and JSON files reliably, which is better handled after we decide on a helper/service boundary instead of stretching the browser-only implementation.

### Scope
- Choose the runtime boundary for reopening local scouting files.
- Support persisted local CSV attachments.
- Support persisted local canonical JSON attachments.
- Preserve the same attachment metadata and auto-load behavior used for remote sources.
- Surface clear errors when a local file is missing, moved, or unreadable.

### Dependencies
- Blocked by: Ticket 5
- Blocked by: decision on local helper / file access approach

### Acceptance Criteria
- A persisted local CSV attachment can be reopened for its event without manual re-selection.
- A persisted local canonical JSON attachment can be reopened for its event without manual re-selection.
- Local-file load failures update attachment status and error metadata without breaking the workspace.
- Local and remote attachments share the same translator and metadata contracts.

## Suggested Delivery Order
1. Ticket 10
2. Ticket 1
3. Ticket 2
4. Ticket 3
5. Ticket 4
6. Ticket 5
7. Ticket 7
8. Ticket 6
9. Ticket 8
10. Ticket 9
11. Ticket 11
