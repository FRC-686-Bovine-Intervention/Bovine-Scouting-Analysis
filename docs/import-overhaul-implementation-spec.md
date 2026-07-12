# Import Overhaul Implementation Spec

## Status
Draft

## Purpose
Define the implementation plan for moving the app from snapshot-backed event demos plus ad hoc sheet imports toward an event workspace model that can:
- load any event code from external providers
- attach scouting datasets to events
- prefer JSON as the canonical scouting format
- support live refresh across external and scouting sources
- diagnose schema drift and dependency breakage

This spec is implementation-facing. It is meant to guide code changes in the current browser app and identify seams that may later move behind a service layer.

## Scope

### In Scope
- arbitrary event-code loading using TBA, Statbotics, and pRidge data
- event-scoped scouting attachments
- canonical scouting JSON format
- legacy thin translators for existing sheet formats
- schema drift detection
- dependency diagnostics for derived equations, filters, and picklists
- duplicate detection and review behavior
- refresh and polling model
- migration of 2024, 2025, and 2026 scouting data into canonical JSON files

### Out Of Scope
- designing the future scouting app export UI
- building multi-event dashboards
- final decisions on automated duplicate merge rules
- replacing all local/browser storage in this phase

## Current Codebase Starting Point
- Event catalog is currently built from local snapshots in [src/real-event-data.js](D:/FIRST/Scouting/Scouting-Analysis/src/real-event-data.js:134).
- Sample-backed scouting hydration happens in [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1239) and [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1265).
- The generic CSV/profile importer lives in [src/import-foundation.js](D:/FIRST/Scouting/Scouting-Analysis/src/import-foundation.js:433).
- Legacy season-specific thin translators live in [src/sheet-import-adapters.js](D:/FIRST/Scouting/Scouting-Analysis/src/sheet-import-adapters.js:331).
- Schema-signature repair logic lives in [src/scouting-import-repair.js](D:/FIRST/Scouting/Scouting-Analysis/src/scouting-import-repair.js:17).
- Authoritative scouting aggregation and duplicate exclusion behavior live in [src/metric-engine.js](D:/FIRST/Scouting/Scouting-Analysis/src/metric-engine.js:46) and [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1861).

## Goals

### Goal 1: Any Event Code Works
Typing an event code should create or load an event workspace and populate it from external sources even when no scouting dataset is attached.

### Goal 2: Scouting Data Is Event-Attached
Scouting files should be attached to a specific event and reloaded automatically whenever that event is opened again.

### Goal 3: JSON Is Canonical
The long-term import/export contract for scouting data is JSON. Legacy sheets remain supported only through thin translation into the canonical model.

### Goal 4: Live Refresh Is Trustworthy
External and scouting sources can change during an event. Refresh behavior must be explicit, source-specific, auditable, and recompute downstream state safely.

### Goal 5: Schema Drift Is Visible
Field additions, removals, type changes, and renames must be surfaced as user-visible issues that propagate to derived equations, filters, and picklists.

## Proposed Architecture

### Core Concept: Event Workspace
Each event code gets one `EventWorkspace`.

Suggested shape:

```js
{
  eventKey: "2026chcmp",
  season: 2026,
  identity: {
    name: "CHCMP",
    startDate: "2026-04-02",
    endDate: "2026-04-05"
  },
  sources: {
    tba: SourceState,
    statbotics: SourceState,
    pridge: SourceState,
    scouting: [ScoutingAttachmentState]
  },
  schemaState: SchemaState,
  dependencyState: DependencyState,
  reviewState: ReviewState,
  computedState: ComputedState
}
```

This replaces the current assumption that an event model is mostly a static snapshot with optional imported rows.

### SourceState

```js
{
  sourceId: "tba",
  kind: "external",
  status: "ready",
  lastAttemptedAt: "...",
  lastSuccessfulAt: "...",
  freshness: "fresh",
  error: null,
  payloadRef: "...",
  provenance: {
    fetchedFrom: "...",
    version: "...",
    etag: "..."
  }
}
```

### ScoutingAttachmentState

```js
{
  attachmentId: "scouting-2026chcmp-main",
  eventKey: "2026chcmp",
  label: "2026 CHCMP Main Scouting",
  format: "scouting-json",
  locationKind: "local-file",
  location: {
    path: "..."
  },
  translatorId: "thin-2026-sheet-v2",
  status: "ready",
  lastAttemptedAt: "...",
  lastSuccessfulAt: "...",
  freshness: "fresh",
  schemaSignature: "...",
  sourceFingerprint: "...",
  canonicalDatasetRef: "..."
}
```

## Canonical Scouting JSON Format

The canonical JSON should be event-scoped and self-describing.

```json
{
  "meta": {
    "format": "frc-scouting-analysis/v1",
    "eventKey": "2026chcmp",
    "season": 2026,
    "exportedAt": "2026-04-05T14:32:00Z",
    "sourceApp": "Team 686 Scouting",
    "entryType": "match"
  },
  "schema": {
    "schemaId": "2026-match-v1",
    "fields": [
      { "id": "autoFuelPct", "label": "Auto Fuel %", "type": "number" },
      { "id": "autoPrimaryRole", "label": "Auto Primary Role", "type": "string" }
    ]
  },
  "entries": [
    {
      "entryId": "abc123",
      "matchNumber": 1,
      "teamNumber": 686,
      "scoutUser": "Avery",
      "alliance": "red",
      "station": "1",
      "notes": "",
      "rawMetrics": {
        "autoFuelPct": 80,
        "autoPrimaryRole": "Score"
      },
      "provenance": {
        "collectedAt": "2026-04-05T13:50:00Z"
      }
    }
  ]
}
```

### Canonical Rules
- `entries` remain atomic, one scout submission per team per match.
- `rawMetrics` is flexible and may contain numeric or categorical values.
- Unknown fields are allowed.
- Identity fields are required.
- Notes remain raw and unparsed.

## Legacy Input Support

### Supported Inputs
- canonical scouting JSON
- current Google Sheet / CSV exports through a thin translator
- legacy Google Sheet / CSV exports through a thin translator

### Translator Contract
Every translator should produce canonical entries and schema metadata, not app-specific aggregates.

Suggested interface:

```js
translateSourceToCanonical({
  sourceText,
  sourceMetadata,
  season,
  eventKey
}) => {
  schema,
  entries,
  warnings,
  translatorVersion
}
```

The existing seasonal adapters in [src/sheet-import-adapters.js](D:/FIRST/Scouting/Scouting-Analysis/src/sheet-import-adapters.js:331) should evolve toward this contract.

## Event Loading Flow

### New Flow
1. User enters event code.
2. App resolves season/year and builds an empty event workspace.
3. App loads TBA.
4. App loads Statbotics.
5. App computes event-total pRidge locally when TBA qualification results and Statbotics team-event priors are both available.
6. App checks for attached scouting sources for the event.
7. If attachments exist, app loads and normalizes them.
8. App computes schema state, dependency state, review state, and overlays.

### Fallback Behavior
- If scouting data is missing, the event still loads from external sources.
- If one external source fails, the workspace still loads with degraded freshness and provenance warnings.

## Attached Scouting Source Behavior

### Requirements
- A scouting source can be attached to any event.
- The attachment persists separately from the imported submissions.
- Reopening the same event reloads the attachment automatically.
- The attachment always uses the thin import translator defined for that source.

### Storage Requirements
At minimum, persist:
- eventKey
- source format
- source location
- translator id
- last known fingerprint
- schema signature
- last successful import metadata

## Schema Drift Handling

### Diff Rules
- field present only in new schema: `added`
- field present only in old schema: `removed`
- same field id but changed type: `type_changed`
- rename without explicit mapping: model as `removed` plus `added`

### Resulting Behaviors
- added field becomes an available metric
- removed field disappears from metric pickers
- removed or type-broken field raises issues on:
  - derived equations
  - season filters
  - picklists
  - any future saved criteria that depend on it

### Required New Data Structures

```js
{
  fields: Map<fieldId, FieldState>,
  diffs: SchemaDiff[],
  activeFieldIds: string[]
}
```

## Dependency Diagnostics

### Dependency Graph Nodes
- raw scouting fields
- external metrics
- derived equations
- filters
- picklists

### Dependency Graph Edges
- derived equation -> raw field
- derived equation -> derived equation
- filter -> raw field
- filter -> derived equation
- picklist -> metric or filter

### Required Outcomes
- broken raw field marks dependent derived equations invalid
- broken derived equation marks dependent filters invalid
- broken filters or metrics mark dependent picklists invalid
- issues should be hierarchical and explainable

Suggested issue shape:

```js
{
  id: "issue-1",
  kind: "missing_dependency",
  subjectType: "derived_equation",
  subjectId: "autoFuelTeam",
  dependencyType: "raw_field",
  dependencyId: "autoFuelPct",
  severity: "warning"
}
```

## Duplicate Handling

### Initial Rule
Duplicates are identified by:
- eventKey
- matchNumber
- teamNumber

### Initial Behavior
- retain all rows
- flag all members of duplicate groups
- exclude duplicate groups from authoritative aggregates by default
- show them in Data Quality for review

This matches the safest current behavior and can later be extended with explicit merge rules.

## Refresh And Polling

### Source-Specific Refresh
- TBA: refetch event, team, and match payloads
- Statbotics: refetch event and team-event payloads
- pRidge: recompute locally from TBA qualification results plus Statbotics start EPA priors
- scouting attachments: re-read source, compare fingerprint, re-import if changed

### Polling Requirements
- configurable interval per source class
- suspend or back off on repeated failures
- show freshness and last update timestamps
- recompute overlays only when payload changed

### Recompute Chain
When a scouting attachment changes:
1. retranslate to canonical entries
2. diff schema
3. re-run duplicate detection
4. rebuild dependency graph
5. recompute metrics and overlays
6. refresh issue lists and confidence signals

## Storage Strategy

### Near-Term
Stay compatible with the current browser-local model, but introduce explicit event workspace storage keys instead of treating submissions as the main persisted object.

### Longer-Term
This design is compatible with moving to a backend or local helper later if file watching, API auth, or multi-user coordination become difficult in browser-only mode.

## Proposed Module Refactor

### New Modules
- `src/event-workspace.js`
- `src/source-registry.js`
- `src/scouting-json-schema.js`
- `src/schema-diff.js`
- `src/dependency-graph.js`
- `src/source-refresh.js`

### Existing Modules To Evolve
- [src/real-event-data.js](D:/FIRST/Scouting/Scouting-Analysis/src/real-event-data.js:134)
  Move from snapshot catalog builder toward event workspace seeding and test fixtures.
- [src/import-foundation.js](D:/FIRST/Scouting/Scouting-Analysis/src/import-foundation.js:433)
  Expand from CSV preview/commit into canonical import validation and source-agnostic commit flow.
- [src/sheet-import-adapters.js](D:/FIRST/Scouting/Scouting-Analysis/src/sheet-import-adapters.js:331)
  Keep as legacy translator layer only.
- [src/scouting-import-repair.js](D:/FIRST/Scouting/Scouting-Analysis/src/scouting-import-repair.js:17)
  Expand into schema signature, schema diff, and refresh orchestration helpers.
- [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1265)
  Reduce direct ownership of hydration/import logic and delegate to workspace modules.

## Migration Plan

### Phase 1: Event Workspace Skeleton
- add event workspace state and storage
- load arbitrary event codes from external sources only
- keep existing sample-backed events working

### Phase 2: Canonical JSON
- define JSON schema
- add JSON import path
- make canonical entries the shared internal model

### Phase 3: Attached Scouting Sources
- persist event attachments
- auto-load attached sources on event open
- preserve current thin translators for sheet-based attachments

### Phase 4: Schema And Dependency Diagnostics
- add schema diffing
- add dependency graph
- flag broken derived equations, filters, and picklists

### Phase 5: Refresh
- add source refresh metadata
- add manual refresh
- add polling and stale-source UI

### Phase 6: Historical Migration
- create canonical JSON scouting files for 2024, 2025, and 2026 from current sheets
- validate converted datasets against trusted outputs

## Testing Plan

### Unit Tests
- canonical JSON validation
- translator outputs
- schema diffing
- dependency graph invalidation
- duplicate grouping
- refresh state transitions

### Regression Tests
- loading an event with no scouting data still supports team stats, matchups, analysis, and picklists
- reopening an event reloads attached scouting automatically
- added raw field appears as a new metric
- removed raw field disappears and flags dependents
- duplicate rows remain visible but excluded from authoritative aggregates
- 2024, 2025, and 2026 canonical JSON reproduce current representative derived outputs

## Open Decisions
- whether attached local files can be reopened reliably in the current browser environment without a helper
- whether arbitrary live API loading should stay browser-only or move behind a sync layer
- whether multiple scouting attachments per event should merge, layer, or require explicit precedence
- whether renamed fields need optional admin-authored migration maps in v1 or can remain remove-plus-add

## Recommended Immediate Next Tickets
1. Define `EventWorkspace` and workspace storage contracts.
2. Define canonical scouting JSON schema and validators.
3. Refactor event hydration in [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1265) behind a workspace loader.
4. Convert legacy sheet adapters into canonical translators.
5. Add schema diff and dependency graph modules.
6. Convert 2024, 2025, and 2026 sample data into canonical JSON fixtures.
