# ADR: pRidge Source Contract

## Status
Accepted

## Context
The app currently exposes pRidge alongside EPA and OPR, but the repo has been treating pRidge too loosely. Ticket `#15` exists to define what pRidge actually is in this codebase, how it should be loaded, and what should happen when it is unavailable.

The source material linked from the product notes establishes a few important facts:
- pRidge is a per-event rating method, not a season-wide rating.
- The published implementation is produced by `scoutR`, specifically `fit_event_pridge("<eventCode>")`.
- The whitepaper and announcement describe pRidge as a ridge-style event model regularized toward a pre-event Statbotics EPA prior.
- The event-level math is small enough that the app can reproduce it directly without porting all of `scoutR`.

Primary references:
- Chief Delphi announcement: <https://www.chiefdelphi.com/t/introducing-prior-ridge-regularization-for-frc-rating/519531>
- scoutR docs: <https://gkrotkov.github.io/scoutR/>
- Blair prior-ridge repo: <https://github.com/blair-robot-project/scouting2026/tree/main/prior_ridge>

## Decisions

### pRidge Is An App-Owned Derived Event Source
- In this repo, event-total pRidge is computed locally by the app from TBA qualification matches plus Statbotics start EPA priors.
- The app implementation is intended to mirror the `scoutR::fit_event_pridge("<eventCode>")` contract closely enough for parity validation.
- We do not port unrelated `scoutR` helpers, tidy-data APIs, or package surface area.

### pRidge Is Event-Scoped
- pRidge is defined for one event at a time.
- The app stores pRidge in the event workspace as an event-scoped external source.
- Season-max or cross-event pRidge views may exist elsewhere, but they are not the event workspace contract.

### pRidge Is Total-Only In v1
- The app treats pRidge as one scalar team rating per event: estimated team points contribution for that event.
- The app does not infer per-component pRidge breakdowns.
- Until a trusted upstream decomposition exists, pRidge component metrics are unsupported.

### No Heuristic Fallback
- If the app has complete TBA qualification results and Statbotics team-event priors, it computes pRidge locally.
- If either prerequisite is missing, the app does not synthesize pRidge from EPA, OPR, rank points, or any local blend.
- Missing pRidge is a source-gap condition, not a reason to fabricate substitute values.

### Refresh And Invalidation
- pRidge freshness is tracked independently in workspace source state.
- pRidge should be recomputed when either of these materially changes:
  - TBA event/match inputs relevant to the event model
  - the Statbotics start EPA priors for teams at the event
- The source fingerprint for pRidge should be based on the locally computed team-rating payload plus the event inputs that produced it.

### Provenance
- pRidge source metadata should record:
  - event key
  - generated-at timestamp when available
  - compute mode (`native-compute`)
  - notes about the TBA and Statbotics inputs when available
- Fixture or manually seeded pRidge test data must be labeled as such.

### Validation
- The native implementation should be regression-tested against stable event snapshots and against public reference outputs whenever they match the event-level contract.
- `fit_event_pridge("2026chcmp")` remains a strong event-level validation target.
- The Blair `prior_ridge/data/epa_pridge_mse.csv` artifact provides usable event-level regression vectors, including `2024mdsev`, whose published `lambda_opt` and `pridge_mse` can be checked against cached event inputs.
- Blair's `all_epas_for_all_teams.csv` and `real_scores.csv` artifacts are sufficient to reconstruct additional offline pRidge validation fixtures without depending on live Statbotics or TBA availability.
- The published 2026 Newton and Curie charts from Gabe Krotkov are useful references, but they are labeled `Season-Max pRidge`, so they are not direct parity vectors for event-level `fit_event_pridge("<eventCode>")`.

## Consequences

### Benefits
- The app stops depending on a separate scoutR export path just to expose event-total pRidge.
- The pRidge math stays small, auditable, and local to the app.
- Event-code loads can surface pRidge immediately when their TBA and Statbotics inputs succeed.

### Costs
- We now own a small linear-algebra and LOOCV implementation in the app.
- Public pRidge artifacts that are not event-level outputs still need careful interpretation before using them as parity tests.
- Existing UI flows that expected componentized pRidge data must treat it as total-only.

## Follow-On Work
- Add more direct event-level parity checks against scoutR or Blair reference outputs for additional known events when stable cached inputs are available.
- Decide whether Ticket `#16` should be narrowed, rewritten, or closed in favor of the native-compute path.
