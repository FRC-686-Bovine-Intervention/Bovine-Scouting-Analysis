# Event Simulator Plan

Parent ticket: GitHub issue #126, Event Simulator.

## Problem Statement

The analysis app needs a repeatable way to exercise live-event behavior before and during a real competition. Real TBA, Statbotics, and scouting sources update asynchronously, expose different subsets of event data, occasionally lag, and can correct earlier values. Those conditions are difficult to reproduce reliably with completed-event snapshots or one-off browser mocks.

The goal is not to reproduce provider algorithms. The goal is to let a developer run a realistic synthetic event through the normal analysis workflow, observe partial and delayed data, and determine which behavior is automated versus which still benefits from human review.

## Solution

Build a local `eventSimulator` service that presents provider-shaped TBA, Statbotics, and scouting endpoints for one initial scenario: synthetic event `2026evsim`, derived from the real 2026 Championship data.

The simulator keeps the complete fixture internally and reveals data according to a controllable event timeline. It runs locally without a separate Firebase project, persists its configuration and timeline state to an ignored local state file, and exposes both a human control page and a machine-readable control API.

The analysis app uses its ordinary event-loading and scouting-import flows. Local/test runtime configuration supplies hidden provider routing overrides. The normal real provider is tried first in fallback mode; the simulator can be selected immediately in simulator-first mode for fast deterministic runs. Production has no simulator fallback configuration.

## Timeline Model

The simulator exposes two pre-event phases followed by completed event-sequence positions:

- `-1`: TBA team list is available; no schedule, scores, Statbotics match data, or scouting rows are exposed.
- `0`: TBA exposes the full schedule with unplayed-match conventions (`score: -1`, empty winning alliance, null score breakdown/result timestamps). Statbotics exposes event and team-event EPA data where available, but no match/team-match rows. Scouting remains empty.
- `1`: the first completed match becomes available.
- Subsequent positions: the global cursor advances through fixed +1, +5, and +10 match controls.

The global cursor is an ordinal event sequence: qualification matches first, followed by elimination matches in TBA order. It is not the raw match number because playoff match numbers reset across sets.

Each source has an effective cursor equal to the global cursor plus a programmable source offset. Negative effective cursors clamp to the appropriate pre-event state. Offsets may be changed during a run, although defaults remain fixed for repeatability.

Source responses capture their snapshot when a request begins and return it after the configured delay. This intentionally permits stale in-flight responses. The simulator records recent requests, but provider payloads remain normal-shaped and contain no simulator-only fields.

## User Stories

1. As a developer, I want to start a local synthetic event without creating a Firebase project, so that live-event testing is inexpensive and isolated.
2. As a developer, I want to enter `2026evsim` through the existing event-loading flow, so that the app exercises normal behavior.
3. As a developer, I want the synthetic event to preserve real team, match, score, EPA, and scouting values, so that test observations are grounded in actual event data.
4. As a developer, I want the event identity rewritten consistently, so that no `2026chcmp` identifiers leak into the simulated event.
5. As a developer, I want a team-only pre-event state, so that I can test event setup before a schedule exists.
6. As a developer, I want a scheduled-but-unplayed state, so that I can test the app when a schedule exists but results do not.
7. As a developer, I want a dedicated first-match state, so that I can inspect the transition from schedule-only data to completed-match data.
8. As a developer, I want fixed +1, +5, and +10 match controls, so that I can move through the event at useful speeds without configuring simulator state.
9. As a developer, I want each source to have an independent offset, so that TBA, Statbotics, and scouting can lag differently.
10. As a developer, I want to change offsets during a run, so that I can reproduce unusual catch-up and partial-update situations.
11. As a developer, I want programmable per-source response latency, so that asynchronous refresh behavior is reproducible.
12. As a developer, I want latency settings to remain sticky until changed, so that repeated manual runs use the same conditions.
13. As a developer, I want a fast delay scale for automated tests, so that tests preserve ordering without waiting real-world durations.
14. As a developer, I want to simulate empty, malformed, delayed, and failed provider responses, so that degraded-source behavior is testable.
15. As a developer, I want source failures to be independently controlled, so that one provider can fail while the others continue.
16. As a developer, I want the simulator to preserve the last request-start snapshot during response delay, so that stale-response races are reproducible.
17. As a developer, I want the simulator to model team 4638 as TBA did in 2026, so that the no-show case remains realistic.
18. As a developer, I want a correction to an earlier source value, so that the app is tested against legitimate replacements rather than append-only data.
19. As a developer, I want corrections identified in the simulator control page and logs, so that I can understand why a value changed.
20. As a developer, I want simulator controls in a local browser page, so that exploratory testing does not require command-line knowledge.
21. As an automated test, I want HTTP control endpoints, so that browser scenarios can advance and configure the event deterministically.
22. As an automated test, I want a read-only simulator state endpoint, so that assertions can distinguish simulator state from app state.
23. As a developer, I want a bounded request log, so that delayed-response failures can be diagnosed without growing persistent data.
24. As a developer, I want simulator state to survive restarts, so that manual test setup is not lost.
25. As a developer, I want separate timeline, configuration, and full reset operations, so that I can restart an event without losing a tuned scenario.
26. As a developer, I want a single launcher for the simulator and development app, so that local setup is simple.
27. As a CI job, I want the launcher to start both services with injected runtime configuration, so that automated tests do not depend on manual setup.
28. As a developer, I want simulator-first routing for normal local runs, so that event simulation does not wait on real providers.
29. As a test author, I want fallback routing as a separate mode, so that provider fallback behavior is still verified.
30. As a production user, I want simulator routing absent from production configuration, so that real events cannot silently use test data.
31. As a developer, I want the existing scouting URL field to point at the simulator, so that scouting data uses the app’s established import path.
32. As a developer, I want scouting rows revealed by event sequence and source offset, so that partial scouting submissions are realistic.
33. As a developer, I want missing and duplicate scouting rows preserved from the fixture, so that the simulator does not fabricate coverage.
34. As a developer, I want Statbotics match collections empty until completed matches exist, so that the simulator does not invent an undocumented unplayed-match format.
35. As a developer, I want deterministic aggregate projections, so that rankings, OPR/DPR/CCWM, and EPA change predictably with visible data.
36. As a developer, I want pre-event Statbotics EPA preserved exactly, so that starting priors remain grounded in the fixture.
37. As a developer, I want TBA schedule metadata preserved, so that scheduled match rendering resembles a real provider response.
38. As a developer, I want end-to-end browser tests to exercise the timeline, offsets, latency, failures, corrections, no-show, and routing modes, so that regressions are caught automatically.
39. As a human tester, I want a checklist for interpreting stale, partial, and corrected data, so that exploratory findings are consistent.

## Implementation Decisions

- The simulator lives in a standalone `eventSimulator` directory and initially uses Node built-ins rather than a new runtime dependency.
- The default port is `8787`, with environment and CLI overrides.
- The first scenario is `2026evsim`, derived from the existing 2026 Championship TBA, Statbotics, and canonical scouting fixtures.
- Scenario data is declarative JSON. Provider adapters are reusable; the scenario supplies fixture paths, identity, defaults, and corrections.
- Event-key rewriting is centralized and recursively updates event keys, event fields, match identifiers, URLs, and scouting event keys.
- Team 4638 remains in the initial TBA roster but has no match, Statbotics team-event, or scouting rows, matching the real fixture.
- The simulator implements only the provider endpoints currently consumed by the app plus simulator control endpoints.
- TBA scheduled-but-unplayed matches use the observed `-1` alliance scores, empty winning alliance, null score breakdown, and null result timestamps.
- Statbotics returns event/team-event EPA as available, but match/team-match collections contain only completed rows.
- TBA, Statbotics, and scouting use independent effective cursors derived from one global ordinal event cursor plus source offsets.
- The initial global states are `-1`, `0`, and `1`; later controls add 1, 5, or 10 to the cursor.
- Source offsets, latency, delay scale, failure mode, and correction schedules are persisted automatically in an ignored local state file.
- Timeline reset preserves configuration; configuration reset restores scenario defaults; full reset does both.
- Delayed responses return the request-start snapshot. The simulator logs recent requests in memory only.
- The simulator supports simulator-first and fallback routing. Fallback mode attempts the real provider first and uses the simulator only after HTTP 404. Other primary-provider errors remain visible.
- Local/test runtime configuration is injected through a temporary `runtime-config.js` before the app starts. Production uses an empty/default configuration.
- Routing configuration is fixed for an app session. Timeline and source behavior may change live; routing changes require a launcher restart.
- The combined launcher starts the simulator and development app, prints URLs by default, and opens a browser only with an explicit flag.
- Automated tests use a persisted, explicit fast delay scale; human runs can use tuned realistic scaling.
- Source refreshes are independent. Existing good data remains visible when a later refresh fails, and overlapping refreshes for one source are prevented or coalesced.
- The app uses a local request-sequence guard so a delayed older response cannot regress newer source state. Legitimate corrections from a newer response are accepted.

## Testing Decisions

- Unit tests cover scenario loading, event-key transformation, ordinal sequencing, cursor/offset calculations, TBA unplayed-match projection, Statbotics completed-row filtering, scouting cutoff, aggregate projections, corrections, persistence, and reset semantics.
- HTTP tests cover provider-shaped payloads, status codes, CORS, delay behavior, request-start snapshots, failure modes, control endpoints, and state/log responses.
- Browser tests start and stop the simulator themselves, use simulator-first routing, reset state, and set all timing values explicitly.
- One fallback-routing test runs with primary provider requests enabled and verifies simulator use only after 404.
- End-to-end tests verify the `-1` team-only state, `0` schedule state, first result at `1`, fixed match increments, current match labels, independent offsets, partial source updates, no-show team behavior, source failure retention, correction application, and final event completion.
- Human exploratory testing focuses on trust and usability: stale indicators, partial data, correction messaging, refresh interactions, event switching, and whether users can tell what is unavailable without seeing fabricated values.
- Tests assert externally observable behavior and use existing unit-test and Playwright conventions rather than coupling to simulator implementation details.

## Out of Scope

- A separate Firebase project or Firebase-backed simulator state.
- Remote simulator hosting in the first version.
- A complete implementation of the TBA or Statbotics APIs.
- Exact reproduction of TBA ranking/OPR algorithms or Statbotics’ production EPA model.
- Production-facing simulator controls or simulator-specific event logic in the deployed app.
- Automatic real-time provider pushes; the app continues to poll.
- A sheet-shaped scouting simulator endpoint in the first version.
- Multiple simulated event scenarios before `2026evsim` proves useful.
- Persisting request logs across process restarts.

## Further Notes

The simulator is intentionally a provider-compatible test boundary, not a second source of scouting truth. Real fixtures remain the source of values; the simulator controls visibility, timing, failures, and deterministic projections. The first usable milestone is a human-startable `2026evsim` that can progress through the normal analysis app. CI orchestration and broader fault coverage follow once that path is stable.
