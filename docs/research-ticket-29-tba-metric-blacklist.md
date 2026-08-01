# Research: Ticket #29 TBA Metric Blacklist

## Scope

This note is intentionally limited to fields that are either recurring provider
bookkeeping noise or season-specific, high-cardinality maps. It does **not**
recommend removing fields from stored source snapshots.

## Evidence reviewed

- [GitHub issue #29](https://github.com/FRC-686-Bovine-Intervention/Scouting-Analysis/issues/29)
- TBA's first-party [API v3 documentation](https://www.thebluealliance.com/apidocs)
  and [generated season-specific score-breakdown types](https://github.com/the-blue-alliance/the-blue-alliance/blob/main/pwa/app/api/tba/read/types.gen.ts#L2037-L2146),
  checked for 2022–2023.
- Statbotics' first-party [REST API documentation](https://www.statbotics.io/docs/rest),
  [team-event model](https://github.com/avgupta456/statbotics/blob/master/backend/src/db/models/team_event.py),
  and [2022–2023 breakdown mapping](https://github.com/avgupta456/statbotics/blob/master/backend/src/breakdown.py#L95-L125).
- This repo's captured first-party payloads:
  [2024 TBA](../src/real-source-cache/2024mdsev-tba-matches.json),
  [2025 TBA](../src/real-source-cache/2025chcmp-tba-matches.json),
  [2026 TBA](../src/real-source-cache/2026chcmp-tba-matches.json),
  [2024 Statbotics](../src/real-source-cache/2024mdsev-statbotics-team-events.json),
  [2025 Statbotics](../src/real-source-cache/2025chcmp-statbotics-team-events.json),
  and [2026 Statbotics](../src/real-source-cache/2026chcmp-statbotics-team-events.json).

## Recommendation

### App-default blacklist: recurring noise

Hide these from metric discovery, while retaining their raw values:

- TBA score-breakdown bookkeeping: `adjustPoints` and `rp`.
- Statbotics team-event identity/metadata: `country`, `district`, `event`,
  `event_name`, `first_event`, `state`, `status`, `team`, `team_name`, `time`,
  `type`, `week`, and `year`.

These fields recur across most or all reviewed seasons but are identifiers,
administrative adjustments, or ranking bookkeeping, not robot-performance
measurements. Keep `foulPoints`, `foulCount`, and `techFoulCount` discoverable
as negative robot-performance signals. Do **not** blacklist adjacent aggregates
such as `autoPoints`, `teleopPoints`, `totalPoints`, Statbotics `epa.*`, or
`record.*`.

### Schema-level blacklist: season-specific cardinality

Three reviewed score-breakdown families justify schema-owned wildcards:

- 2022 Rapid React: the location/color cargo counters under
  `autoCargoLower*`, `autoCargoUpper*`, `teleopCargoLower*`, and
  `teleopCargoUpper*`.
- 2023 Charged Up: the indexed grid-node arrays under `autoCommunity.*` and
  `teleopCommunity.*`, plus the indexed link detail under `links.*`.
- 2025 Reefscape: the individual reef-node booleans under
  `autoReef.*.node*` and `teleopReef.*.node*`.

This matters because the app recursively flattens nested objects and arrays
([builder](../src/event-model-builder.js), [metric discovery](../src/app.js));
each array index or node otherwise becomes a separate picker entry.

Keep their neighboring counts and totals discoverable (for example,
`autoReef.tba_topRowCount` and `teleopReef.trough`). The 2024 and 2026 reviewed
shapes contain no comparable dense map, so they need no season-specific
wildcard merely for consistency. Statbotics' season-driven `epa.breakdown`
contains bounded semantic aggregates in every reviewed year; keep those
discoverable rather than mirroring TBA's raw indexed-detail blacklist.

## Proposed schema shape

```json
{
  "metricDiscovery": {
    "blacklist": {
      "tba": [
        "scoreBreakdown.autoReef.*.node*",
        "scoreBreakdown.teleopReef.*.node*"
      ]
    }
  }
}
```

The app defaults should use the same source-keyed pattern-list shape and be
merged with (not copied into) each season schema. Each season schema supplies
only its applicable patterns above.

## Glob contract

- Match the complete, case-sensitive flattened field id; never a substring.
- `*` is the only wildcard and matches zero or more characters, including `.`.
- Every other character is literal; there is no `?`, character class, escaping,
  or recursive-glob syntax.
- Therefore `scoreBreakdown.autoReef.*.node*` matches
  `scoreBreakdown.autoReef.topRow.nodeA`, but not
  `scoreBreakdown.teleopReef.topRow.nodeA` or
  `prefix.scoreBreakdown.autoReef.topRow.nodeA`.
- Blacklisting affects catalog discoverability only. Snapshot ingestion,
  persistence, and direct source inspection remain unchanged.
