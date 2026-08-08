# Research: Provider Season Game Labels

## Question

Can the app obtain an official FRC game/season name (for example,
`Crescendo`, `REEFSCAPE`, or `FIRST® AGE™`) from the existing TBA or
Statbotics event/season payloads, instead of keeping a local year-to-label
definition?

## Finding

The existing TBA and Statbotics integrations do not expose the official game
name as an event or year field. Both distinguish the numeric competition year
from the **event name**; the latter is the name of a particular tournament,
not the season game.

The official FRC Events API does provide it: its authenticated Season Summary
endpoint, `GET /v3.0/{season}`, returns `gameName`.

| Provider | Relevant endpoint(s) | Available identity/display fields | Game-name field |
| --- | --- | --- | --- |
| The Blue Alliance API v3 | `GET /event/{event_key}`, `GET /events/{year}` | `key`, `name`, `year`, event code/type, dates, location | None |
| Statbotics v3 | `GET /v3/event/{key}`, `GET /v3/events?year={year}`, `GET /v3/year/{year}` | Event `key`, `name`, `year`; year statistics and score breakdowns | None |
| Official FRC Events API v3 | `GET /v3.0/{season}` | Season summary, kickoff, counts, championship data | `gameName` |

TBA documents `Event.name` as the official **event** name and `Event.year` as
the year of the event data; its `/events/{year}` list returns that event model.
The schema has no game or season-title property. Its current change history
does add 2024, 2025, and 2026 *score-breakdown* models, but those are
year-specific match data rather than a season metadata resource.

Statbotics' documented event and year endpoints likewise expose event identity,
EPA/statistical data, and per-year breakdown/statistics, but no game-title
field. Its event response's `name` is therefore not a substitute for an
official season label.

## Coverage and implications

For 2024--2026, the app can source the game title from the FRC Events API's
`gameName` field. Integration requires FRC Events API credentials (the API
uses Basic authentication), a fetch/cache policy, and provenance recording.
Do not derive a game name from a TBA or Statbotics event name, event key, or
score-breakdown shape: none is that provider's season-title field.

## Primary sources

- The Blue Alliance, [API v3 OpenAPI specification](https://www.thebluealliance.com/swagger/api_v3.json): `/events/{year}` is documented as an event list; the `Event` schema defines `name` as the official event name and `year` as the event-data year, with no game-title property. The specification change history documents the 2024--2026 score-breakdown additions.
- Statbotics, [v3 REST API reference](https://statbotics.readthedocs.io/en/latest/): documents the event (`get_event`/`get_events`) and year (`get_year`/`get_years`) resources.
- Statbotics, [team-event response model](https://github.com/avgupta456/statbotics/blob/master/backend/src/db/models/team_event.py): provider response fields include event/year identity and event name, but no season game title.
- FIRST Robotics Competition, [FRC Events API documentation](https://frc-api-docs.firstinspires.org/): Season Summary `GET /v3.0/{season}` documents `gameName`; the official example returns `"gameName": "INFINITE RECHARGE"` for 2020.
