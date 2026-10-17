# Research: Ticket #210 Mobile Alliance Selection

## Decision summary

A separate mobile URL is feasible. Firebase Hosting supports multiple sites in one Firebase project; each site has separate hosted files and configuration while sharing the project's Auth and Firestore resources. A site ID such as `bovine-scouting-mobile` yields `bovine-scouting-mobile.web.app` if available. `m.bovine-scouting-analysis.web.app` is not the generated form: Firebase-generated site URLs use one site ID label before `.web.app`, and Firebase's `web.app` domain is not a domain the team can attach its own subdomain to. Use a team-owned custom domain for an `m.` address. The app currently configures one Hosting site and uses the `bovine-scouting-analysis` Firebase project, so a second site, target mapping, deploy configuration, and (for sign-in on a new hostname) Auth authorized-domain review are needed. [Firebase multisite Hosting](https://firebase.google.com/docs/hosting/multisites) · [Firebase custom domains](https://firebase.google.com/docs/hosting/custom-domain) · [Auth authorized domains](https://firebase.google.com/docs/auth/web/google-signin) · [Firebase CLI deploy targets](https://firebase.google.com/docs/cli/targets)

The same picklists can be shared through the existing per-event Firestore workspace. However, the current app only fetches that workspace with `getDoc` during sync; it does not subscribe to workspace changes. The alliance board itself is saved in browser `localStorage`, so it is not currently live-linked across devices. The request therefore needs a small shared live display state in addition to a mobile layout. [src/firebase-workspace.js](../src/firebase-workspace.js) · [src/app.js](../src/app.js) · [firestore.rules](../firestore.rules)

## What exists in the repository

- `firebase.json` defines one Hosting site, serves the repo root, and rewrites routes to `index.html`. `.firebaserc` selects `bovine-scouting-analysis` and has no Hosting target mapping. [firebase.json](../firebase.json) · [.firebaserc](../.firebaserc)
- `src/firebase-config.js` initializes Auth and Firestore against project `bovine-scouting-analysis`. Separate Hosting sites in that project can use these same services, subject to the existing security rules. [src/firebase-config.js](../src/firebase-config.js)
- Per-event workspace state is at `events/{eventKey}/workspace/state`. It contains picklists and event workspace data. The admin PC persists changes; signed-in allowed users can read it, while only admins can write it. [src/firebase-workspace.js](../src/firebase-workspace.js) · [firestore.rules](../firestore.rules)
- The PC's active event is already synchronized through an `onSnapshot` subscription on `appState/activeEvent`. In contrast, the workspace uses one-time reads, and the alliance board is device-local (`localStorage`). [src/firebase-event-state.js](../src/firebase-event-state.js) · [src/app.js](../src/app.js)
- Development and production Hosting currently use the same Firebase project; the deployment guide explicitly notes that local/dev clients can touch production backend resources. Firebase recommends separate Firebase projects for isolated environments, not separate Hosting sites within production. [development-and-deployment-workflow.md](development-and-deployment-workflow.md) · [Firebase multisite guidance](https://firebase.google.com/docs/hosting/multisites)

## Implemented design

The mobile viewer is anonymous and read-only. The desktop Alliance Selection view remains canonical and publishes a compact snapshot to `publicAllianceSelection/current`. Firestore grants anonymous `get` on that single document and denies list access and deletion. The document has a strict top-level field allowlist and one serialized payload capped at 400,000 characters (the writer also checks its UTF-8 size); the client validates the complete nested board, ranking, and column schema before publishing and after reading. Workspace, submissions, provider credentials, source caches, and general event documents remain behind their existing authenticated rules.

The snapshot contains only display values: event identity, the 24 board slots and team labels, final ranking rows with captain/picked states, and the currently displayed source columns with their team order, shading states, and visible numeric scores. The mobile page subscribes to this one document, performs no provider or scouting downloads, and offers a board/rankings view plus a picklists view. Publishing is debounced and admin-only in the client; Firestore rules independently enforce admin-only writes.

Hosting config now has separate `desktop` and `mobile` targets. The mobile target maps to the intended generated site ID `bovine-scouting-mobile`; configuration and workflows do not create the Hosting site or deploy it.

## Recommended architecture

Create a second Firebase Hosting site for the mobile UI in the existing production project, with a distinct target and an explicit deploy target in CI. Keep the existing Auth/Firestore project so both clients see the same event identity and workspace. Build a focused mobile route/page that subscribes to compact, read-only display state. Extend the admin PC to select which picklists appear and to publish board changes to that state; enforce admin-only writes and allowed-user reads in Firestore rules. Use the generated `SITE_ID.web.app` URL first; attach a custom subdomain only if the domain is controlled and desired.

Before implementation, reconcile an apparent current contract mismatch: `saveEventWorkspaceState` writes `version`, `eventKey`, `eventWorkspace`, `picklists`, and `updatedAt`, while the current Firestore rule requires `sortEquations`, `activePicklist`, and `activeSortEquation` too. Confirm the deployed rules and fix the shared-workspace schema/write contract as part of any work that depends on workspace updates. [src/firebase-workspace.js](../src/firebase-workspace.js) · [firestore.rules](../firestore.rules)

## External prerequisite

Before any Hosting workflow can deploy the new target, a project owner must verify the generated site ID is available, create `bovine-scouting-mobile` in Firebase Hosting for project `bovine-scouting-analysis`, and authorize the repository's configured Firebase service account for that site. No custom DNS or Auth authorized-domain change is needed because the viewer does not sign in. Firestore rules still need a separately authorized deployment before anonymous reads work in a deployed environment.

## Sources

- Issue [#210](https://github.com/FRC-686-Bovine-Intervention/Bovine-Scouting-Analysis/issues/210), read through the repository GitHub wrapper.
- Firebase, [Share project resources across multiple sites](https://firebase.google.com/docs/hosting/multisites).
- Firebase, [Connect a custom domain](https://firebase.google.com/docs/hosting/custom-domain).
- Firebase, [Google sign-in and authorized domains](https://firebase.google.com/docs/auth/web/google-signin).
- Repository configuration and implementation links cited above.
