# Tickets: Interaction-safe application rendering

Make the application’s rendering architecture safe for active user interaction across every page while preserving responsiveness during background refreshes and calculations.

GitHub migration is complete. The canonical closed issues are [#159](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/159), [#161](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/161), [#162](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/162), [#163](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/163), and [#164](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/164). Duplicate issue [#160](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/160) is closed as a duplicate of #159.

## [#159 Add an app-wide interaction-safe render coordinator](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/159) — COMPLETE / CLOSED

**What to build:** Create one render coordinator that makes UI updates safe during user interaction and exposes enough timing context to diagnose responsiveness problems.

**Blocked by:** None — can start immediately.

- [x] Route render requests from user actions, background refreshes, async calculations, and synchronization through one coordinator.
- [x] Coalesce multiple render requests in the same turn.
- [x] Defer non-urgent renders while a user is interacting with a select, input, textarea, modal, or scrollable control.
- [x] Flush deferred renders after the interaction ends without losing the latest state.
- [x] Record render reason and whether the render was immediate, coalesced, or deferred.
- [x] Preserve long-task and pRidge timing diagnostics.

## [#161 Keep the application shell and active controls mounted](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/161) — COMPLETE / CLOSED

**What to build:** Stop full application DOM replacement from interrupting navigation, forms, selects, scrolling, modals, and builders across every page.

**Blocked by:** Add an app-wide interaction-safe render coordinator.

- [x] Mount the application shell once and preserve shared interactive regions across updates.
- [x] Keep active controls stable when unrelated state changes.
- [x] Preserve control focus, selection, input values, scroll positions, and modal state.
- [x] Attach shared event handling to stable shell elements.

## [#162 Make background refreshes update data regions without interrupting users](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/162) — COMPLETE / CLOSED

**What to build:** Apply interaction-safe updates to simulator refreshes, provider refreshes, deferred Analysis calculations, and Firebase synchronization.

**Blocked by:** Keep the application shell and active controls mounted.

- [x] Refresh data without recreating active controls.
- [x] Coalesce refresh-triggered updates into one visible update.
- [x] Render only when refreshed data changes the visible page.
- [x] Keep pRidge and long-task measurements tied to the refresh that caused them.

## [#163 Migrate remaining interactive page regions and remove the full-render fallback](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/163) — COMPLETE / CLOSED

**What to build:** Bring scouting import, schedule, derived equations, picklists, alliance selection, admin controls, and other interactive regions onto the stable rendering path.

**Blocked by:** Keep the application shell and active controls mounted; Make background refreshes update data regions without interrupting users.

- [x] Each interactive page keeps its controls mounted during unrelated updates.
- [x] Forms and builders retain in-progress edits during background activity.
- [x] Modals and scrollable regions remain stable during refreshes.
- [x] The full-app replacement path is no longer used for normal updates.

## [#164 Add cross-page responsiveness and interaction regression coverage](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/164) — COMPLETE / CLOSED

**What to build:** Verify interaction continuity and responsiveness across every page while refreshes and long tasks are active.

**Blocked by:** Make background refreshes update data regions without interrupting users; Migrate remaining interactive page regions and remove the full-render fallback.

- [x] Dropdowns remain open until the user closes or changes them.
- [x] Inputs, textareas, forms, modals, and scroll positions survive background updates.
- [x] Tests cover simulator refreshes, provider refreshes, deferred calculations, and Firebase synchronization.
- [x] Performance diagnostics identify render causes, coalescing, deferral, and long tasks.

## Verification

The committed smoke gates are:

```text
node .browser-test/trace-background-updates-ticket-133.mjs
node .browser-test/measure-interaction-performance-ticket-132.mjs
VALIDATION_FROM_EVENT=2026cached VALIDATION_TO_EVENT=2026local node .browser-test/validate-user-navigation-latency.mjs
```

All three passed against commit `faeff78` after restarting the local analysis app, event simulator, and Firebase emulators.
