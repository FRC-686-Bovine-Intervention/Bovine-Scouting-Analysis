# Research: Scouting JSON Conventions and Community Export Shapes

## Date
- 2026-07-12

## Question
- Before locking the long-term canonical scouting JSON format, what machine-readable shapes are already common in the FRC ecosystem, and how should that influence this repo's canonical format?

## Primary Sources Reviewed
- The Blue Alliance Developer APIs: <https://www.thebluealliance.com/apidocs>
- Statbotics repository README: <https://github.com/avgupta456/statbotics>
- This repo's current canonical scouting fixture and import pipeline:
  - [tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.entries.json](D:/FIRST/Scouting/Bovine-Scouting-Analysis/tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.entries.json)
  - [tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.schema.json](D:/FIRST/Scouting/Bovine-Scouting-Analysis/tests/fixtures/canonical-scouting-json/valid-2026chcmp-match.schema.json)
  - [src/scouting-json-schema.js](D:/FIRST/Scouting/Bovine-Scouting-Analysis/src/scouting-json-schema.js)
  - [src/scouting-json-import.js](D:/FIRST/Scouting/Bovine-Scouting-Analysis/src/scouting-json-import.js)
  - [src/import-foundation.js](D:/FIRST/Scouting/Bovine-Scouting-Analysis/src/import-foundation.js)

## Findings

### 1. The strongest FRC machine-readable conventions are provider APIs, not scouting interchange files
- The Blue Alliance explicitly documents a JSON read API and positions it as the way to fetch event, team, match, and related competition data.
- TBA also documents caching via `ETag` / `If-None-Match` and separately offers CSV archives for simpler offline consumption.
- Statbotics similarly presents itself as an API- and export-driven analytics platform, exposing a REST API, Python API, and CSV export.

Implication:
- The broader ecosystem clearly accepts event-scoped JSON APIs for external competition data.
- That is good validation for this app's use of event-scoped JSON structures.
- It is not evidence of an existing shared scouting-entry JSON file format.

### 2. I did not find a clearly documented cross-team scouting JSON interchange standard
- In the sources reviewed here, there is no obvious equivalent of "the common scouting JSON file" used across teams.
- The visible ecosystem standardization is around:
  - external provider APIs such as TBA
  - analytics APIs such as Statbotics
  - CSV exports and spreadsheet workflows
- That matches what this repo already reflects: the legacy import surface is spreadsheet-first, and the new canonical JSON is being introduced as an app-owned contract rather than a pre-existing community standard.

Implication:
- We should optimize the canonical scouting JSON for clarity, durability, and migration safety rather than trying to imitate a nonexistent de facto standard.

### 3. Event scope is the right boundary
- TBA's API organization is strongly event- and match-oriented.
- Statbotics also exposes event and team-event concepts, not one giant scouting blob for a whole season.
- This repo's current canonical fixture also treats the payload as event-scoped through `meta.season`, `meta.eventKey`, `schema`, and `entries`.

Implication:
- Keep the canonical scouting JSON event-scoped.
- Avoid designing the first canonical format as a multi-event omnibus file.

### 4. Self-describing schema is worth keeping
- TBA and Statbotics are API-first systems whose field contracts live in their API behavior and documentation.
- For offline scouting attachments, that luxury does not exist; the file itself needs to carry enough structure to validate and migrate safely.
- This repo's canonical shape already includes:
  - `meta`
  - `schema`
  - `entries`

Implication:
- Keep the self-describing `schema.fields` block in the file.
- That is a meaningful advantage over ad hoc CSV because it supports validation, schema drift detection, and downstream dependency diagnostics.

### 5. Identity should stay explicit and row-like
- Spreadsheet scouting workflows naturally revolve around one scouting observation per row.
- This repo's canonical format preserves that model with explicit universal identity fields like match number, team number, and alliance, while keeping scouter/station/notes in the event-specific payload.

Implication:
- Continue to model canonical scouting JSON as a flat list of event-scoped scouting entries.
- Avoid deeply nested "one team contains all matches" shapes for the primary interchange format.

### 6. Raw metrics should remain extensible, not hard-coded to one season forever
- Because there is no stable community-wide scouting schema, field churn is expected.
- This repo now has:
  - dynamic scouting field discovery
  - schema drift diagnostics
  - dependency invalidation

Implication:
- Keep canonical entries open to season-specific and newly introduced raw metric ids.
- Preserve explicit field metadata in `schema.fields` so downstream tools can reason about added, removed, and type-changed fields.

## Recommendation
- Treat the canonical scouting JSON as an app-owned interoperability layer, not a mirror of an external community standard.
- Keep these design choices:
  - event-scoped payloads
  - explicit `meta`, `schema`, and `entries`
  - explicit row identity fields
  - flexible raw metric ids declared by `schema.fields`
  - thin legacy translators from spreadsheet sources into the canonical format

## Proposed Stability Rules
- `meta` should always include at least:
  - `format`
  - `season`
  - `eventKey`
  - `entryType`
- `schema` should always include:
  - `schemaId`
  - `fields[]`
- `entries[]` should remain row-oriented and contain explicit match/team identity.
- New raw metrics should be introduced by schema declaration, not by silently inventing fields during import.

## Bottom Line
- The ecosystem evidence supports event-scoped JSON and strong API-style contracts.
- The ecosystem evidence does not show an established shared scouting JSON export standard.
- That means this repo should keep its canonical scouting JSON opinionated, explicit, and migration-friendly instead of chasing compatibility with a format that does not appear to be broadly standardized.
