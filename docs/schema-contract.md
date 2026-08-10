# Scouting schema contract

This document defines the portable schema/profile contract used when a scouting schema is downloaded, edited, and uploaded again. It is intentionally narrower than the application's full runtime state: the file describes the inputs and formulas needed to reproduce analysis, not cached submissions, provider responses, or transient UI selections.

## Contract shape

```json
{
  "meta": {
    "format": "...",
    "season": 2026,
    "eventKey": "2026chcmp",
    "templateProfileId": "...",
    "profileLabel": "..."
  },
  "schema": {
    "schemaId": "2026-match-v1",
    "expectedScoutingFields": ["autoFuelPct", "overallDriver"],
    "metricPresentation": {
      "blacklist": {
        "tba": [],
        "statbotics": []
      }
    },
    "pridgeResponseDefinitions": [],
    "comments": []
  },
  "profile": {
    "id": "...",
    "label": "...",
    "versionKey": "...",
    "derivedEquations": [
      { "name": "scoutingTotal", "formula": "..." }
    ]
  },
  "workspace": {
    "picklists": []
  }
}
```

The exact `meta.format` value and the existing pRidge definition shape remain implementation-owned; this document defines the members and their meaning.

## Schema members

### `expectedScoutingFields`

This is an array of stable scouting field IDs only. It is used to detect whether the currently loaded scouting data still matches the profile's expected input vocabulary.

Field labels, types, units, options, and other import metadata are not part of the portable schema contract. They belong to the scouting data/import runtime, where the canonical scouting file remains authoritative. Exporting them would duplicate or distort live data and can cause implementation details—such as minified HTML text—to be mistaken for real scouting fields.

### `metricPresentation`

This is the provider-metric presentation policy. The first supported policy is `blacklist`, with provider-specific arrays for TBA and Statbotics metric IDs or glob patterns. It affects provider metric discovery and autocomplete only; it does not remove source data and does not prevent an explicit formula from referring to a metric.

Built-in safety/default blacklist entries remain code-owned and are combined with the profile's entries. Unknown future properties in this container should be ignored until explicitly supported. The current contract does not use the old name `metricDiscovery`.

### `pridgeResponseDefinitions`

These are the season/event-specific formulas that map available source metrics into stable pRidge response IDs, including the three `tbaTotal*` definitions when the event has suitable TBA metrics. A definition's formula is authoritative for the imported profile; unavailable source metrics must be reported as unavailable rather than fabricated.

### `profile.derivedEquations`

Each entry has only a stable `name` and a `formula`. There is no usage field and no separate equation metadata in the contract.

Every derived equation is a reusable metric expression. The same expression may be selected for plotting, sorting, or filtering. A filter parameter must evaluate to boolean values; using a numeric or other non-boolean expression as a filter is an error. Inline aggregate-function filter parameters remain formula expressions and are not the removed named-filter catalog.

Separate named filters and separate user sort equations are not contract members. The old `usage`, `filters`, and `sortEquations` concepts are removed rather than carried as compatibility aliases because the schemas being maintained going forward do not contain real named-filter definitions.

### `workspace.picklists`

Picklist definitions remain portable workspace data when they are needed to interpret/edit scouting fields. Active picklist and active sort selections are transient UI state and are not schema contract members. Cached scouting rows, raw provider responses, source attachment metadata, and other runtime caches are also excluded.

The application may retain these values locally for user experience, but download/upload must not mistake them for schema identity or change detection.

## Compatibility and truthfulness rules

- Imported data and live provider responses are the source of truth.
- A missing live metric is unavailable; it is never replaced with a season-specific placeholder or synthetic series.
- Schema import/export must round-trip the complete contract above without adding runtime-derived field metadata, HTML/minification artifacts, caches, or transient selections.
- Diagnostics must compare the imported contract with the active runtime profile and report only actual differences from that contract.
- Contract validation should reject malformed required values and clearly report formula type errors, especially when a formula is used as a filter parameter.

## Migration verification

The implementation should have focused unit coverage for normalization and round-trip import/export, dependency diagnostics, provider blacklist behavior, formula/filter validation, and sort selection. Browser coverage should exercise downloading a cached schema, editing/re-uploading it, and confirming that the active profile and diagnostics reflect the uploaded `expectedScoutingFields`, `metricPresentation`, pRidge definitions, derived equations, and picklists.
