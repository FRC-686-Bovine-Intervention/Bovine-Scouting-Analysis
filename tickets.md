# Tickets: Interaction-safe application rendering

Make the application’s rendering architecture safe for active user interaction across every page while preserving responsiveness during background refreshes and calculations.

GitHub publication was attempted while the service was degraded. The approved breakdown is recorded here as the local source of truth until GitHub is healthy again.

## Add an app-wide interaction-safe render coordinator

**What to build:** Create one render coordinator that makes UI updates safe during user interaction and exposes enough timing context to diagnose responsiveness problems.

**Blocked by:** None — can start immediately.

- [ ] Route render requests from user actions, background refreshes, async calculations, and synchronization through one coordinator.
- [ ] Coalesce multiple render requests in the same turn.
- [ ] Defer non-urgent renders while a user is interacting with a select, input, textarea, modal, or scrollable control.
- [ ] Flush deferred renders after the interaction ends without losing the latest state.
- [ ] Record render reason and whether the render was immediate, coalesced, or deferred.
- [ ] Preserve long-task and pRidge timing diagnostics.

## Keep the application shell and active controls mounted

**What to build:** Stop full application DOM replacement from interrupting navigation, forms, selects, scrolling, modals, and builders across every page.

**Blocked by:** Add an app-wide interaction-safe render coordinator.

- [ ] Mount the application shell once and preserve shared interactive regions across updates.
- [ ] Keep active controls stable when unrelated state changes.
- [ ] Preserve control focus, selection, input values, scroll positions, and modal state.
- [ ] Attach shared event handling to stable shell elements.

## Make background refreshes update data regions without interrupting users

**What to build:** Apply interaction-safe updates to simulator refreshes, provider refreshes, deferred Analysis calculations, and Firebase synchronization.

**Blocked by:** Keep the application shell and active controls mounted.

- [ ] Refresh data without recreating active controls.
- [ ] Coalesce refresh-triggered updates into one visible update.
- [ ] Render only when refreshed data changes the visible page.
- [ ] Keep pRidge and long-task measurements tied to the refresh that caused them.

## Migrate remaining interactive page regions and remove the full-render fallback

**What to build:** Bring scouting import, schedule, derived equations, picklists, alliance selection, admin controls, and other interactive regions onto the stable rendering path.

**Blocked by:** Keep the application shell and active controls mounted; Make background refreshes update data regions without interrupting users.

- [ ] Each interactive page keeps its controls mounted during unrelated updates.
- [ ] Forms and builders retain in-progress edits during background activity.
- [ ] Modals and scrollable regions remain stable during refreshes.
- [ ] The full-app replacement path is no longer used for normal updates.

## Add cross-page responsiveness and interaction regression coverage

**What to build:** Verify interaction continuity and responsiveness across every page while refreshes and long tasks are active.

**Blocked by:** Make background refreshes update data regions without interrupting users; Migrate remaining interactive page regions and remove the full-render fallback.

- [ ] Dropdowns remain open until the user closes or changes them.
- [ ] Inputs, textareas, forms, modals, and scroll positions survive background updates.
- [ ] Tests cover simulator refreshes, provider refreshes, deferred calculations, and Firebase synchronization.
- [ ] Performance diagnostics identify render causes, coalescing, deferral, and long tasks.
