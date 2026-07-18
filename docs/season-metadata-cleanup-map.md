# Season Metadata Cleanup Map

## Goal

Remove season-specific scouting structure from the app's core model.

The target state is:

- `season` remains only an identity on events, provider payloads, and imported submissions.
- scouting field definitions come from imported schema or saved scouting profiles, not from season code
- legacy sheet and CSV support remains available, but through saved import profiles and generic translators rather than `2024`/`2025`/`2026` branches
- derived equations and diagnostics follow the active scouting profile or imported schema, not the event year

## Progress Update

Implemented on July 18, 2026:

- runtime scouting field resolution now prefers committed/imported schema fields and saved profile fields over season-seeded scouting fields
- sample-backed scouting refresh checks now compare against explicit schema fields and translation versions instead of only season defaults
- derived equations and filters now live under saved scouting profiles in app state, with one-time migration from legacy season buckets
- legacy naming has started shifting away from `seasonDefinitions` and `seasonSheetTranslators` toward narrower compatibility seams

Still pending:

- converting the separate filter system into boolean derived equations
- replacing year-keyed legacy sheet translators with profile-owned adapter records
- fully deleting seeded season scaffolding after migration compatibility is no longer needed

## Resolved Recommendations

These are the recommended cleanup decisions unless a later implementation detail forces a revisit.

### 1. Keep season as passive identity only

- keep `event.season`
- keep `submission.season`
- keep `seasonLabel` if available
- do not let season choose scouting schema, translators, equations, or UI behavior

### 2. Remove season-owned scouting schema

- remove `seasonDefinitions` as the owner of raw scouting fields
- remove `seasonDefinitions` as the owner of formula-only scouting fields
- remove `seasonDefinitions` as the owner of scouting-derived metrics

If some provider-facing scoring metadata still needs a home, split it into a narrower external-source module.

### 3. Replace season translators with profile-driven legacy import support

- remove `seasonSheetTranslators`
- keep legacy import support through named import profiles and generic translator contracts
- let admins save and reuse profiles for old sheet formats instead of preserving year-specific branches

### 4. Prefer boolean derived equations over a separate filter system

The current code still has distinct filters, but the recommended end state is to collapse them into profile-owned boolean derived equations.

That means:

- no permanent separate `filters` artifact is required
- reusable predicates can be expressed as equations that evaluate to boolean or `0/1`
- analysis, diagnostics, and optional aggregate conditions should consume those boolean equations

Compatibility during migration is acceptable, but the target state should not keep both concepts indefinitely.

### 5. Treat `eventKey` as the primary behavioral scope

- route submissions, profile matching, and event behavior primarily by `eventKey`
- keep `submission.season` as a validation and audit field only
- never use `submission.season` to choose runtime behavior

## Current Coupling Inventory

### 1. `SeasonFramework` is still an authoritative schema bundle

[src/season-framework.js](D:/FIRST/Scouting/Scouting-Analysis/src/season-framework.js:26) currently hard-codes `seasonDefinitions` for `2024`, `2025`, and `2026`.

Each season definition currently mixes several concerns:

- external scoring component layout
- raw scouting field definitions
- formula-only scouting fields
- derived metric definitions
- scoring presets

This is the main place where season metadata still acts like product logic instead of identity.

### 2. Event models are pre-seeded from season code

[src/event-model-builder.js](D:/FIRST/Scouting/Scouting-Analysis/src/event-model-builder.js:286) and [src/real-event-data.js](D:/FIRST/Scouting/Scouting-Analysis/src/real-event-data.js:19) both inject season-derived fields into every event model:

- `seasonLabel`
- `breakdownMap`
- `scoringComponents`
- `scouterMetricDefinitions`
- `formulaFieldDefinitions`
- `derivedMetricDefinitions`
- `metrics`
- `criteriaSources`

That means an event has a built-in scouting schema before any scouting attachment is loaded.

### 3. Runtime scouting fields still start from season defaults

[src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1111) builds current scouting and formula field definitions by starting from season definitions and then merging imported schema fields and submission-discovered fields.

This keeps the app in a mixed mode:

- season-seeded baseline
- schema/submission overlay

instead of:

- schema/profile authoritative baseline

### 4. Canonical schema generation still uses season field lists

These modules still treat season-backed field lists as the base scouting schema:

- [src/scouting-json-schema.js](D:/FIRST/Scouting/Scouting-Analysis/src/scouting-json-schema.js:13)
- [src/import-foundation.js](D:/FIRST/Scouting/Scouting-Analysis/src/import-foundation.js:119)
- [src/scouting-import-repair.js](D:/FIRST/Scouting/Scouting-Analysis/src/scouting-import-repair.js:7)
- [src/sheet-import-adapters.js](D:/FIRST/Scouting/Scouting-Analysis/src/sheet-import-adapters.js:633)

Effects today:

- import headers come from season field definitions
- canonical schema defaults come from season field definitions
- schema signatures are stamped from season field definitions
- refresh decisions for sample-backed scouting data compare against season field definitions

### 5. Legacy sheet import still branches by season

[src/sheet-import-adapters.js](D:/FIRST/Scouting/Scouting-Analysis/src/sheet-import-adapters.js:35) contains `seasonSheetTranslators` for `2024`, `2025`, and `2026`.

This is useful as migration scaffolding, but it is exactly the kind of season-specific structure the app should retire.

The desired replacement is:

- named legacy import profiles
- generic translator contract
- profile matching and manual override

not year-specific translation branches in core code.

### 6. Seeded equations and filters are still keyed by season

The app still loads seeded season catalogs from:

- [src/season-derived-equations.js](D:/FIRST/Scouting/Scouting-Analysis/src/season-derived-equations.js:2)
- [src/season-filters.js](D:/FIRST/Scouting/Scouting-Analysis/src/season-filters.js:2)

They are loaded into app state in [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:293) and selected by `eventModel.season` in [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1173) and [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1217).

This is another place where year still decides scouting behavior.

### 7. Storage naming still assumes season-owned catalogs

[src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:163) persists:

- `seasonProfiles`
- `seasonDerivedEquations`
- `seasonFilters`

The persistence layout itself is not the main problem, but it reflects the current ownership model:

- season owns profiles
- season owns equations
- season owns filters

That should become profile-scoped or attachment-scoped over time.

## Cleanup Buckets

## Keep

These are valid uses of season metadata and do not need to disappear:

- `event.season` as event identity
- `submission.season` as import identity, validation, and audit metadata
- `seasonLabel` as display text if available from a provider or event catalog
- external-provider season context where a provider API requires it
- provider-specific scoring decomposition that is explicitly about provider payload interpretation rather than scouting schema ownership

Guidance for `submission.season`:

- keep it as a denormalized guardrail that helps catch wrong-event or wrong-year imports
- keep it for exported data, fixture readability, and offline auditability
- treat `eventKey` as the primary behavioral scope when it is available
- do not use `submission.season` to choose scouting fields, equations, filters, translators, or any other app behavior

Short rule:

`season` may identify an event, but it should not define the scouting schema.

## Move

These should continue to exist, but under profile/schema ownership instead of season ownership.

### Raw scouting field definitions

Move from:

- `seasonDefinitions[*].scouterMetrics`
- `seasonDefinitions[*].formulaFields`
- `seasonFramework.formulaFieldDefinitions(...)`

Move to:

- saved scouting profiles
- imported canonical schema
- profile-version migration records

### Import aliases and rename handling

Move from:

- season-coded aliases and header assumptions

Move to:

- profile-scoped alias sets
- explicit rename mappings
- import-profile matching hints

### Derived equations and reusable predicates

Move from:

- `SeasonDerivedEquations.seasons[season]`
- `SeasonFilters.seasons[season]`

Move to:

- profile-scoped derived equation catalogs
- event attachment snapshots of the active profile version

Recommended simplification:

- migrate filters into boolean derived equations
- keep a temporary compatibility layer only long enough to convert existing saved filters and references

### Schema signatures and diagnostics roots

Move from:

- season-seeded field signatures

Move to:

- imported schema signature
- chosen profile signature
- migration signature after explicit rename/add/remove decisions

### Legacy import support

Move from:

- `seasonSheetTranslators`

Move to:

- a registry of import translators or profiles
- generic `translateSourceToCanonical(...)`
- admin-selectable profile matching

## Remove

These are the primary cleanup targets.

### Remove `seasonDefinitions` as the owner of scouting schema

The entire `seasonDefinitions` object in [src/season-framework.js](D:/FIRST/Scouting/Scouting-Analysis/src/season-framework.js:26) should stop owning:

- scouting raw fields
- formula-only scouting fields
- derived scouting metrics
- scoring presets tied to scouting schema

If some external scoring metadata still needs a home, it should be split into a separate provider-facing module with a narrower responsibility.

### Remove `seasonSheetTranslators`

The `seasonSheetTranslators` structure in [src/sheet-import-adapters.js](D:/FIRST/Scouting/Scouting-Analysis/src/sheet-import-adapters.js:35) should be retired in favor of profile-driven import compatibility.

### Remove season as the selector for equations and predicates

The app should stop selecting seeded equations and filter-like predicates by `eventModel.season`.

The selector should instead be:

- active scouting profile
- attached source profile
- imported canonical schema

### Remove the separate season filter system

The `SeasonFilters` module and `seasonFilterCatalog` state should not survive the cleanup as first-class long-term concepts.

The target replacement is:

- boolean derived equations stored with the active profile
- optional compatibility import or auto-conversion for existing saved filters

### Remove season-seeded baseline scouting fields at runtime

`currentScouterMetricDefinitions()` and `currentFormulaFieldDefinitions()` in [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1111) should stop seeding from season definitions.

They should instead resolve from:

1. committed scouting schema for the active attachment
2. pending imported schema for preview
3. raw submission discovery as a fallback only when schema metadata is absent

## Proposed Replacement Model

## Core Types

### Event identity

```js
{
  key,
  season,
  name,
  seasonLabel,
  providerContext
}
```

### Submission identity

```js
{
  eventKey,
  season,
  schemaVersion,
  templateProfileId,
  provenance
}
```

`eventKey` is the primary routing and behavior key. `season` remains a passive validation and audit field.

### Scouting profile

```js
{
  profileId,
  profileName,
  versionId,
  basedOnProfileId,
  fields: [],
  aliases: {},
  derivedEquations: [],
  matchingHints: {},
  importAdapters: [],
  createdAt,
  archivedAt
}
```

If migration compatibility is needed, converted filters can carry metadata such as `kind: "predicate"` inside the derived-equation catalog rather than requiring a separate storage surface.

### Attached scouting source

```js
{
  attachmentId,
  eventKey,
  sourceFormat,
  sourceLocation,
  translatorId,
  matchedProfileId,
  matchedProfileVersionId,
  importedSchemaSignature,
  importedSchema,
  lastImportMetadata
}
```

## Migration Order

## Phase 1: Split identity from schema ownership

Keep `season` on events and submissions, but stop using it as the default scouting field registry.

First moves:

- create a `ScoutingProfileRegistry` module
- create a `resolveActiveScoutingSchema(...)` helper
- route all runtime scouting field access through that helper

Exit condition:

- no runtime scouting picker or formula helper reads raw scouting fields from `seasonDefinitions`

## Phase 2: Make imported schema or chosen profile authoritative

Replace season-based field seeding in:

- [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js:1111)
- [src/scouting-json-schema.js](D:/FIRST/Scouting/Scouting-Analysis/src/scouting-json-schema.js:13)
- [src/import-foundation.js](D:/FIRST/Scouting/Scouting-Analysis/src/import-foundation.js:119)
- [src/scouting-import-repair.js](D:/FIRST/Scouting/Scouting-Analysis/src/scouting-import-repair.js:7)

Exit condition:

- canonical schema and diagnostics signatures are based on the actual imported or selected profile schema

## Phase 3: Replace season translators with import profiles

Refactor [src/sheet-import-adapters.js](D:/FIRST/Scouting/Scouting-Analysis/src/sheet-import-adapters.js:35) so that legacy support is driven by import-profile definitions rather than season branches.

Exit condition:

- importing a 2024 or 2025 legacy sheet works by choosing or auto-matching a saved profile
- adding support for another legacy format does not require adding a new season branch

## Phase 4: Move equations to profiles and collapse filters

Replace:

- `seasonDerivedEquationCatalog`
- `seasonFilterCatalog`

with profile-scoped equation catalogs plus event-attached snapshots.

Exit condition:

- old events can continue using the equations and boolean predicates that matched their historical scouting profile
- new profile versions do not silently rewrite old events
- no long-term separate filter catalog remains in active use

## Phase 5: Delete the season scaffolding

After the previous phases are stable:

- delete `seasonDefinitions`
- delete `seasonSheetTranslators`
- delete seeded season equation and filter modules
- rename storage and state to remove `season*` ownership language

## Implementation Checklist

### A. Schema ownership cutover

- [x] Introduce one resolver that returns the authoritative scouting schema for the active event attachment.
- [x] Update runtime field pickers to use that resolver instead of season-seeded field lists.
- [x] Update schema signature generation to use imported/profile-owned fields only.
- [x] Update diagnostics to compare committed schema versus pending imported schema without season defaults.

### B. Profile model cutover

- [ ] Define a versioned scouting profile structure in code and docs.
- [ ] Persist matched profile id and version id on scouting attachments.
- [ ] Preserve historical event-to-profile associations when the current profile changes.
- [ ] Add rename, add, and remove field migration records to profiles.

### C. Legacy import cutover

- [ ] Replace `seasonSheetTranslators` with a registry of import adapters or saved profile matchers.
- [ ] Allow legacy CSV and sheet formats to be imported by profile selection rather than by event year.
- [ ] Keep generic column canonicalization as the fallback path when no exact profile matches.

### D. Equation and predicate cutover

- [x] Move season-derived equations into profile-owned equation catalogs.
- [ ] Convert existing season filters into boolean derived equations or predicate-marked equations.
- [ ] Update analysis-filter selection to reference boolean equations instead of a separate filter catalog.
- [ ] Keep dependency diagnostics working for converted predicate equations.

### E. Scaffold removal

- [ ] Remove `seasonDefinitions`.
- [ ] Remove `seasonSheetTranslators`.
- [ ] Remove `SeasonFilters`.
- [x] Remove season-owned equation and profile storage naming after migration compatibility is no longer needed.

## Acceptance Checks

- A new scouting schema revision does not require editing season-specific code.
- A legacy 2024 or 2025 sheet can still be imported by choosing or matching a saved profile.
- Opening an old event preserves the profile version that was active when that event was imported.
- Renaming a field can be modeled as an explicit mapping instead of a remove-plus-add breakage event.
- Broken equation dependencies are visible in diagnostics and clearly badged in the admin UI.
- No runtime scouting-field resolution path depends on `eventModel.season` to know what scouting fields exist.

## Suggested First Tickets

1. Add a profile-owned scouting schema resolver and route runtime field access through it.
2. Move schema signature generation and diagnostics to imported/profile-owned fields.
3. Introduce versioned scouting profiles with attachment-to-profile matching.
4. Refactor legacy sheet import to use saved import profiles instead of `seasonSheetTranslators`.
5. Move derived equations to profile catalogs and convert filters into boolean equations.
6. Remove `seasonDefinitions`, `SeasonFilters`, and related helpers after the replacement path is complete.

## What This Means For Issue #39

The answer becomes:

- raw scouting fields should be fully schema-driven and profile-driven
- season should remain only as identity and, if needed, narrow provider-facing context
- legacy compatibility should be handled through import profiles, not season-specific app code

That is the cleanest path to making scouting metric changes smooth during a season without requiring new season-specific code for every schema revision.
