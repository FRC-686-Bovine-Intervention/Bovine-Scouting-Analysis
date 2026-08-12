# 2026evsim human exploratory pass

Start `scripts/start-event-simulator.ps1`. Use `-RoutingMode fallback` for fallback checks and `-OpenBrowser` only when desired. Open the printed simulator control URL and analysis-app URL. Begin with `Reset` so the state is `-1`; use the state endpoint or control page to record cursor, offsets, latency, delay scale, failures, and corrections for every finding.

## Pass sequence

1. At `-1`, confirm the roster is present, no schedule/results are shown, and team 4638 is visible only as a no-show candidate.
2. At `0`, confirm the full schedule uses unplayed conventions and the UI distinguishes scheduled from completed.
3. At `1` and later increments, inspect rankings, OPR/DPR/CCWM, Statbotics EPA, match views, picklists, and derived metrics as coverage grows. Confirm missing values remain unavailable rather than fabricated.
4. Give TBA, Statbotics, and scouting distinct offsets and latencies. Watch stale/partial indicators, pending requests, refresh controls, and polling timestamps.
5. Fail one source, refresh, and confirm its last good payload remains while the source reports stale/error. Restore it and confirm recovery.
6. Apply a correction to an earlier match or scouting row. Confirm the replacement is accepted, visible in activity/diagnostic context, and an older delayed response cannot undo it.
7. Switch away from and back to `2026evsim`; confirm event-scoped scouting attachments, review overrides, and derived configuration remain coherent.

## Record findings

For each observation record: expected behavior, observed behavior, state endpoint JSON, event/source, route, cursor and offsets, latency/delay scale, and whether the result is a defect, expected unavailable data, or a human-only interpretation issue. Human-only checks include whether users trust stale/partial/corrected values, understand missing scouting coverage, and can distinguish a pending refresh from an empty result.
