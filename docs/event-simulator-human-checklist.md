# 2026evsim human exploratory pass

## Reboot-safe setup

1. Open PowerShell in `D:\FIRST\Scouting\Bovine-Scouting-Analysis`.
2. Run `powershell -ExecutionPolicy Bypass -File .\scripts\start-event-simulator.ps1` and leave that window open.
3. Open `http://127.0.0.1:8787/` for simulator controls and `http://127.0.0.1:4174/` for the analysis app.
4. On the simulator page, click **Reset timeline** and confirm `cursor: -1` / `phase: team-only`.
5. In the analysis app, open **Admin Event Control**, enter `2026evsim`, and click **Load**. The TBA source should be **Ready**.
6. Click **+1**, **+5**, or **+10** in the simulator and **Refresh Sources** in the analysis app. Confirm the current match label and analysis source timestamps update.

The simulator page has the same steps behind its **Show setup instructions** button. The machine-readable check is `http://127.0.0.1:8787/state`.

Start `scripts/start-event-simulator.ps1`. Use `-RoutingMode fallback` for fallback checks and `-OpenBrowser` only when desired. Open the printed simulator control URL and analysis-app URL. Begin with `Reset` so the state is `-1`; use the state endpoint or control page to record cursor, offsets, latency, delay scale, failures, and corrections for every finding.

## Pass sequence

1. At `-1`, confirm the roster is present, no schedule/results are shown, and team 4638 is visible only as a no-show candidate.
2. At `0`, confirm the full schedule uses unplayed conventions and the UI distinguishes scheduled from completed.
3. At the first match and after +5/+10 jumps, inspect rankings, OPR/DPR/CCWM, Statbotics EPA, match views, picklists, and derived metrics as coverage grows. Confirm missing values remain unavailable rather than fabricated.
4. Give TBA, Statbotics, and scouting distinct offsets and latencies. Watch stale/partial indicators, pending requests, refresh controls, and polling timestamps.
5. Fail one source, refresh, and confirm its last good payload remains while the source reports stale/error. Restore it and confirm recovery.
6. Apply a correction to an earlier match or scouting row. Confirm the replacement is accepted, visible in activity/diagnostic context, and an older delayed response cannot undo it.
7. Switch away from and back to `2026evsim`; confirm event-scoped scouting attachments, review overrides, and derived configuration remain coherent.

## Record findings

For each observation record: expected behavior, observed behavior, state endpoint JSON, event/source, route, cursor and offsets, latency/delay scale, and whether the result is a defect, expected unavailable data, or a human-only interpretation issue. Human-only checks include whether users trust stale/partial/corrected values, understand missing scouting coverage, and can distinguish a pending refresh from an empty result.
