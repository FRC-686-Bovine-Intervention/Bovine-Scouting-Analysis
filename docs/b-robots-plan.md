# B robots in event simulation and analysis

Parent ticket: GitHub issue #180 (B Teams).

## Decision

Treat the provider team key as the canonical robot identity. A key such as
`frc10988B` is a distinct robot from `frc10988`, even though both share the
numeric base team number `10988`. The base number may be used for display,
grouping, and compatibility with provider fields that are explicitly numeric;
it must not be used as the identity map key for a robot.

This keeps ordinary teams backward compatible while preventing a B, C, or D
robot from being silently merged into the parent team. The implementation must
also keep the provider key available for diagnostics and source traceability.

## Current boundary

- The simulator already passes through suffixed TBA keys in schedules and
  rewrites event keys recursively. Its projections currently use those keys,
  so no synthetic B-team metrics should be added.
- `src/event-model-builder.js` currently stores `team.number` as a number and
  intentionally keeps non-numeric schedule labels separately. This protects
  incomplete schedules but does not yet create a selectable model team for a
  suffixed participant.
- The external loader and pRidge inputs are numeric-provider integrations.
  Statbotics rows and scouting submissions without a B-robot identity must
  remain unavailable for that robot; mapping them to the parent team would
  fabricate data.
- Existing UI state, picklists, formulas, and persisted submissions use
  numeric team numbers. They must remain compatible while the identity change
  is introduced behind a small normalization seam.

## Implementation sequence

1. Add shared team-identity helpers at the provider/model boundary. Normalize a
   provider key into `{ id, key, baseNumber, label }`, where `id` is stable and
   string-based (`frc10988B`), `baseNumber` is `10988` when derivable, and
   `label` is `10988B`. Numeric provider values continue to normalize to the
   existing numeric identity.
2. Extend the event model and normalized matches with the identity fields while
   retaining `number` for legacy numeric consumers. Match slots should carry
   the identity id/key even when no model team exists yet.
3. Build model teams from the union of TBA participant keys and match keys,
   using TBA participant metadata when present. A key seen only in a schedule
   is an explicit incomplete participant, not permission to clone the parent
   team's name, EPA, scouting, or derived metrics.
4. Update source joins to use identity first. Numeric Statbotics, TBA ranking,
   pRidge, and legacy scouting data may attach only to an exact numeric robot;
   a suffixed robot gets an unavailable value unless the source supplies the
   same suffixed identity.
5. Migrate UI selection, picklists, matchup rendering, and persisted state to
   string ids, with a one-time read compatibility path for old numeric values.
   Display the label (`10988B`) and keep the base number available for grouping
   and user-facing context.
6. Extend the canonical scouting identity contract with an optional
   `teamKey`/robot-id field. Keep `teamNumber` required for ordinary rows, and
   reject or quarantine a suffixed row that has no unambiguous robot identity
   instead of coercing it to `10988`.
7. Add a simulator fixture case for `10988` plus `10988B` in teams, schedule,
   and scouting data. Verify that source offsets, delayed snapshots, reset
   operations, and event-key rewriting preserve the suffix.

## Acceptance checks

- `frc10988` and `frc10988B` produce two model identities and never share a
  ranking, trend, scouting row, pRidge fit, or persisted selection by numeric
  collision alone.
- A schedule displays `10988B` when TBA provides that key, including partial
  alliance assignments; it does not display a fabricated team record when no
  participant metadata exists.
- Numeric-only events and existing saved workspaces load unchanged.
- Simulator HTTP and browser tests cover duplicate base numbers, source
  unavailability for B robots, delayed responses, and reset/persistence.
- No production routing or live provider response is altered until the model
  and importer identity contract is ready.

## Explicit non-goals

Do not invent Statbotics EPA, TBA rankings, pRidge values, or scouting values
for a B robot by copying the parent team. Do not encode suffixes as synthetic
numeric team numbers, because that would create collisions with real teams and
break provider joins.
