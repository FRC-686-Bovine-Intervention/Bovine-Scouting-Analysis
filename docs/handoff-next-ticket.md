# Handoff: Next Logical Ticket

## Next Ticket
- GitHub issue `#6`
- Title: `Import overhaul: load arbitrary event codes from external providers`
- URL: <https://github.com/FRC-686-Bovine-Intervention/Scouting-Analysis/issues/6>

## Why This Is Next
- GitHub issue `#5` is closed.
- The local delivery order in [docs/import-overhaul-ticket-stack.md](D:/FIRST/Scouting/Scouting-Analysis/docs/import-overhaul-ticket-stack.md) puts the arbitrary event-code loading work immediately after the EventWorkspace foundation.
- Issue `#6` depends on the workspace layer from `#5`, which is now in place and verified.

## Current State
- `EventWorkspace` exists in [src/event-workspace.js](D:/FIRST/Scouting/Scouting-Analysis/src/event-workspace.js).
- App hydration loads through the workspace layer in [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js).
- External source state, fingerprints, and refresh helpers already exist in:
  - [src/event-workspace.js](D:/FIRST/Scouting/Scouting-Analysis/src/event-workspace.js)
  - [src/external-source-snapshots.js](D:/FIRST/Scouting/Scouting-Analysis/src/external-source-snapshots.js)
  - [src/source-refresh.js](D:/FIRST/Scouting/Scouting-Analysis/src/source-refresh.js)
- Ticket `#9` was closed as complete for browser-scope scouting attachments.
- Follow-on local-file attachment work was split to GitHub issue `#14`.

## What Issue #6 Requires
- Add an event-code lookup flow.
- Resolve season and event identity from external sources.
- Load TBA data into the event workspace.
- Load Statbotics data into the event workspace.
- Load pRidge data into the event workspace.
- Handle partial-source failures gracefully with freshness and provenance warnings.

## Likely Starting Points
- Event/workspace hydration:
  - [src/app.js](D:/FIRST/Scouting/Scouting-Analysis/src/app.js)
  - [src/event-workspace.js](D:/FIRST/Scouting/Scouting-Analysis/src/event-workspace.js)
- Snapshot/fingerprint helpers:
  - [src/external-source-snapshots.js](D:/FIRST/Scouting/Scouting-Analysis/src/external-source-snapshots.js)
  - [tests/external-source-snapshots.test.mjs](D:/FIRST/Scouting/Scouting-Analysis/tests/external-source-snapshots.test.mjs)
- Refresh policy/state:
  - [src/source-refresh.js](D:/FIRST/Scouting/Scouting-Analysis/src/source-refresh.js)
  - [tests/source-refresh.test.mjs](D:/FIRST/Scouting/Scouting-Analysis/tests/source-refresh.test.mjs)
- Existing event catalog and sample-backed model:
  - [src/real-event-data.js](D:/FIRST/Scouting/Scouting-Analysis/src/real-event-data.js)

## Suggested First Moves
1. Inspect the current event selection flow in `src/app.js` and identify where a free-form event-code entry can slot in.
2. Decide whether issue `#6` will initially use real API calls, cached snapshots, or a hybrid fallback.
3. Define a minimal loader contract that can populate an `EventWorkspace` from provider payloads even when scouting data is absent.
4. Add tests for:
   - creating/loading a workspace from an arbitrary valid event code
   - partial provider failure
   - external-only event rendering without scouting submissions

## Verification Already Proven For The Foundation
- `node tests/event-workspace.test.mjs`
- `node tests/external-source-snapshots.test.mjs`
- `node tests/source-refresh.test.mjs`
- `node --check src/app.js`

## Notes
- The worktree is dirty. Do not revert unrelated existing changes.
- GitHub access is working from Codex when proxy env vars are cleared before `gh` calls.
