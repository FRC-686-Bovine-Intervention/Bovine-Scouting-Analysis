# Authenticated local browser-test harness

`.browser-test/authenticated-local-harness.mjs` exercises the real app page with a real Firebase Auth emulator session. It does not dispatch synthetic auth events or modify production authentication behavior. The seeded admin account must be authorized by the Firestore emulator before the browser can reach the admin-only pages.

## Start the local stack

From the repository root in PowerShell:

```powershell
.\scripts\start-localhost.ps1
node .browser-test/authenticated-local-harness.mjs
```

The Firebase CLI requires a Java runtime for the Auth and Firestore emulators. If startup reports that it cannot spawn `java -version`, install Java and make `java.exe` available on `PATH` before retrying.

The startup script serves the checkout at `http://localhost:4173`, starts the Auth emulator on port `9099` and Firestore emulator on port `8080`, then runs `scripts/seed-firebase-emulators.mjs`. The seed creates:

- `admin@example.test` / `local-admin-password` in the Auth emulator;
- an admin role in `users/{uid}` and `allowlist/admin%40example.test`;
- the `2026local` event and representative cached provider/scouting data.

To run the pieces manually, start `firebase emulators:start --only auth,firestore --project bovine-scouting-analysis`, run `node scripts/seed-firebase-emulators.mjs`, and serve the repository root on port 4173.

## Useful overrides

The harness accepts `SCOUTING_APP_URL`, `FIREBASE_LOCAL_ADMIN_EMAIL`, `FIREBASE_LOCAL_ADMIN_PASSWORD`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_PROJECT_ID`, and `PLAYWRIGHT_EXECUTABLE_PATH` environment variables.

Failures are prefixed with an actionable code: `EMULATOR_UNAVAILABLE`, `APP_UNAVAILABLE`, `AUTHENTICATION_FAILED`, `AUTHORIZATION_FAILED`, `ADMIN_PAGE_UNAVAILABLE`, or `DERIVED_BUILDER_UNAVAILABLE`. The message includes the failing service, rendered status/body text when available, and the local command or role document to check.
