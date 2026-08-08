# Authenticated local browser-test harness

`.browser-test/authenticated-local-harness.mjs` exercises the real app page with a real Firebase Auth emulator session. It does not dispatch synthetic auth events or modify production authentication behavior. The seeded admin account must be authorized by the Firestore emulator before the browser can reach the admin-only pages.

## Start the local stack

From the repository root in PowerShell:

```powershell
.\scripts\start-localhost.ps1
node .browser-test/authenticated-local-harness.mjs
```

The Firebase CLI requires a Java runtime for the Auth and Firestore emulators. The startup script checks `PATH` first and also discovers a JDK under `C:\Program Files\Eclipse Adoptium`. If Java is installed elsewhere, set `JAVA_HOME` and prepend its `bin` directory to `PATH` before retrying.

In the Codex desktop sandbox, Java may still fail with `EPERM` even when `java -version` works. This means the sandbox is blocking Node/Firebase from spawning Java; it is not a Java or Firebase configuration error. Approve elevated execution for the emulator and browser-test commands, or run them from a normal PowerShell terminal outside the sandbox. A minimal confirmation is:

```powershell
$taskJavaHome = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
$env:JAVA_HOME = $taskJavaHome
$env:Path = "$taskJavaHome\bin;$env:Path"
node -e "const c=require('child_process').spawnSync('java',['-version'],{encoding:'utf8'}); console.log(c.error?.code ?? c.status)"
```

`0` confirms Java can be spawned when the command is allowed to run outside the restricted sandbox.

The startup script serves the checkout at `http://localhost:4173`, starts the Auth emulator on port `9099` and Firestore emulator on port `8080`, then runs `scripts/seed-firebase-emulators.mjs`. The seed creates:

- `admin@example.test` / `local-admin-password` in the Auth emulator;
- an admin role in `users/{uid}` and `allowlist/admin%40example.test`;
- the `2026local` event and representative cached provider/scouting data.

To run the pieces manually, use this PowerShell flow:

```powershell
$taskJavaHome = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot"
$env:JAVA_HOME = $taskJavaHome
$env:Path = "$taskJavaHome\bin;$env:Path"
firebase emulators:start --only auth,firestore --project bovine-scouting-analysis
```

In a second terminal, run `node scripts/seed-firebase-emulators.mjs` and serve the repository root on port 4173. The seed script is safe to rerun; it signs in if the local admin already exists and refreshes the emulator documents.

If `.firebase-emulators.pid` is stale, remove that PID file and rerun `scripts/start-localhost.ps1`; the script validates the recorded process before reusing it. Do not use this flow against production Firebase projects: the credentials and documents are intentionally local-only.

## Useful overrides

The harness accepts `SCOUTING_APP_URL`, `FIREBASE_LOCAL_ADMIN_EMAIL`, `FIREBASE_LOCAL_ADMIN_PASSWORD`, `FIREBASE_AUTH_EMULATOR_HOST`, `FIRESTORE_EMULATOR_HOST`, `FIREBASE_PROJECT_ID`, and `PLAYWRIGHT_EXECUTABLE_PATH` environment variables.

Failures are prefixed with an actionable code: `EMULATOR_UNAVAILABLE`, `APP_UNAVAILABLE`, `AUTHENTICATION_FAILED`, `AUTHORIZATION_FAILED`, `ADMIN_PAGE_UNAVAILABLE`, `DERIVED_BUILDER_UNAVAILABLE`, `DERIVED_HELP_UNAVAILABLE`, `DERIVED_HELP_NOT_SCROLLABLE`, `DERIVED_HELP_REGRESSION`, or `DERIVED_HELP_CLICK_FAILED`. The message includes the failing service, rendered status/body text when available, and the local command or role document to check.
