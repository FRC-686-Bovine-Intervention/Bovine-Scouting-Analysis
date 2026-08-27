# Local event simulator

Run `node eventSimulator/server.mjs` from the repository root, then open `http://127.0.0.1:8787/`. The initial scenario is `2026evsim`, backed by the checked-in 2026 Championship fixtures.

The provider-shaped routes are available below `/api/tba/event/2026evsim`, `/api/statbotics/v3/...`, and `/api/scouting/2026evsim`; use `/api/scouting/2026evsim/schema` as the Scouting Profile URL so the analysis app can discover the simulator’s scouting metrics. Machine controls are `GET /state` and `POST /control/advance` (with an explicit amount such as 1, 5, or 10), `/control/set`, `/control/reset-timeline`, `/control/reset-config`, and `/control/reset`. State is persisted to the ignored `eventSimulator/.state.json` file; set `EVENT_SIMULATOR_STATE` to use another file. The control page exposes fixed +1, +5, and +10 match actions and shows the current competition match.

## Recorded event playback

Run `node eventSimulator/recorder.mjs 2026chcmp` with `TBA_AUTH_KEY` set to record a live event. Multiple event codes can be supplied, or provided through `EVENT_RECORDER_EVENTS`; `EVENT_RECORDER_OUTPUT` changes the output root. The recorder polls TBA every 60 seconds and Statbotics every 120 seconds, records the first pre-event observation as cursor 0, and writes only changed paired snapshots under `recordings/<event-code>/`.

To replay a recording, set `EVENT_SIMULATOR_RECORDING=recordings/2026chcmp` before starting `node eventSimulator/server.mjs`. The existing control page then displays the recorded event tag and cursor position, and its controls advance through the saved cursors. Recordings are intentionally ignored by Git.
