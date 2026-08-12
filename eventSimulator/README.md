# Local event simulator

Run `node eventSimulator/server.mjs` from the repository root, then open `http://127.0.0.1:8787/`. The initial scenario is `2026evsim`, backed by the checked-in 2026 Championship fixtures.

The provider-shaped routes are available below `/api/tba/event/2026evsim`, `/api/statbotics/v3/...`, and `/api/scouting/2026evsim`. Machine controls are `GET /state` and `POST /control/advance`, `/control/set`, `/control/reset-timeline`, `/control/reset-config`, and `/control/reset`. State is persisted to the ignored `eventSimulator/.state.json` file; set `EVENT_SIMULATOR_STATE` to use another file.
