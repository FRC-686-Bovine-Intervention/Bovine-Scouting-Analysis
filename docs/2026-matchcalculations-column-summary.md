# 2026 MatchCalculations Column Summary

Source sheet: [2026 Scouting Analysis CHCMP](https://docs.google.com/spreadsheets/d/1kb42DTsp46hRrnuNk6dNxbHbzvFkgJeuQs9eZESGm9w/edit?pli=1&gid=1335468219#gid=1335468219)

## What This Tab Does

Each row represents one robot in one qualification match. There are 6 rows per match:

- Blue 1, Blue 2, Blue 3
- Red 1, Red 2, Red 3

The tab combines:

- team identity from `TBA_Match_Import`
- official alliance totals from `TBA_Match_Data`
- per-robot scouting inputs from `Match Scouting`

Its main job is to estimate each robot's phase-by-phase contribution by:

- taking the team's scouted `% fuel` share for a phase
- normalizing it against the alliance's total scouted `% fuel`
- multiplying that share by the official alliance fuel total from TBA

It also estimates `Max Fuel Possible` by dividing assigned fuel by the fraction of the phase the robot was judged to be shooting.

## Important Pattern

For every phase:

- `Fuel %` = scout-entered team share
- `Fuel % Alliance` = sum of all 3 robots' shares on that alliance
- `Fuel Alliance` = official alliance fuel from TBA
- `Fuel Team` = team's estimated share of alliance fuel
- `% Shooting` = estimated share of phase spent shooting, based on roles
- `Max Fuel Possible` = `Fuel Team / % Shooting`

If there are fewer than 3 scouting entries for that alliance in that match, the alliance percent sum falls back to `1`.

## Columns A-G: Match / Robot Identity

- `A Match Number`: match index, repeated 6 times per match
- `B Alliance`: `Blue` or `Red`
- `C Robot #`: slot `1`, `2`, or `3`
- `D Team`: actual team number from TBA match import
- `E Has Entry`: `1` if scouting data exists for that team/match, else `0`
- `F No Show`: scouted no-show flag
- `G Starting Position`: scouted starting position

## Columns H-P: Auto

- `H Auto Primary Role`: scout-entered primary role
- `I Auto Secondary Role`: scout-entered secondary role
- `J Auto Fuel %`: scouted auto fuel percentage, converted to decimal
- `K Auto Fuel % Alliance`: total of alliance auto fuel percentages
- `L Auto Fuel Alliance`: official alliance auto fuel from TBA
- `M Auto Fuel Team`: robot's allocated share of auto fuel
- `N Auto % Shooting`: estimated fraction of auto spent shooting
- `O Auto Max Fuel Possible`: max possible auto fuel given shooting fraction
- `P Won Auto`: whether this alliance beat the other alliance in auto fuel

## Columns Q-X: Transition

- `Q Transition Primary Role`
- `R Transition Secondary Role`
- `S Transition Fuel %`
- `T Transition Fuel % Alliance`
- `U Transition Fuel Alliance`
- `V Transition Fuel Team`
- `W Transition % Shooting`
- `X Transition Max Fuel Possible`

## Columns Y-AF: Shift 1

- `Y Shift 1 Primary Role`
- `Z Shift 1 Secondary Role`
- `AA Shift 1 Fuel %`
- `AB Shift 1 Fuel % Alliance`
- `AC Shift 1 Fuel Alliance`
- `AD Shift 1 Fuel Team`
- `AE Shift 1 % Shooting`
- `AF Shift 1 Max Fuel Possible`

## Columns AG-AN: Shift 2

- `AG Shift 2 Primary Role`
- `AH Shift 2 Secondary Role`
- `AI Shift 2 Fuel %`
- `AJ Shift 2 Fuel % Alliance`
- `AK Shift 2 Fuel Alliance`
- `AL Shift 2 Fuel Team`
- `AM Shift 2 % Shooting`
- `AN Shift 2 Max Fuel Possible`

## Columns AO-AV: Shift 3

- `AO Shift 3 Primary Role`
- `AP Shift 3 Secondary Role`
- `AQ Shift 3 Fuel %`
- `AR Shift 3 Fuel % Alliance`
- `AS Shift 3 Fuel Alliance`
- `AT Shift 3 Fuel Team`
- `AU Shift 3 % Shooting`
- `AV Shift 3 Max Fuel Possible`

## Columns AW-BD: Shift 4

- `AW Shift 4 Primary Role`
- `AX Shift 4 Secondary Role`
- `AY Shift 4 Fuel %`
- `AZ Shift 4 Fuel % Alliance`
- `BA Shift 4 Fuel Alliance`
- `BB Shift 4 Fuel Team`
- `BC Shift 4 % Shooting`
- `BD Shift 4 Max Fuel Possible`

## Columns BE-BL: Endgame

- `BE Endgame Primary Role`
- `BF Endgame Secondary Role`
- `BG Endgame Fuel %`
- `BH Endgame Fuel % Alliance`
- `BI Endgame Fuel Alliance`
- `BJ Endgame Fuel Team`
- `BK Endgame % Shooting`
- `BL Endgame Max Fuel Possible`

## Columns BM-BN: Totals

- `BM Tele-Op Max Fuel Possible`: sum of all phase max-fuel columns
  This includes auto too, so the label is slightly misleading.
- `BN Total Fuel Scored`: sum of all allocated team fuel across all phases

## Columns BO-BR: Climb

- `BO Auto Climb Attempt`: scout-entered auto climb attempt
- `BP Auto Climb Success`: actual robot-specific auto tower result from TBA
- `BQ Tele-Op Climb Attempt`: scout-entered tele-op climb attempt
- `BR Tele-Op Climb Success`: actual robot-specific end tower result from TBA

## Columns BS-BY: Ratings / Notes

All pulled directly from `Match Scouting`:

- `BS Shooter Rating`
- `BT Passer Rating`
- `BU Intake Rating`
- `BV Driver Rating`
- `BW Defense Avoidance Rating`
- `BX Defense Rating`
- `BY Notes`

## Column BZ: Recent Match

- `BZ Recent Match`: `TRUE` if this match is within the team's most recent `Recent_Match_Threshold` matches with scouting entries

## Key Takeaways

- This tab allocates official alliance fuel totals down to individual robots using scouted percentages.
- Roles are used to estimate how much of a phase a robot spent shooting.
- `Max Fuel Possible` is an implied full-capacity estimate based on assigned fuel and shooting share.
- `BM` is probably mislabeled, since it includes auto plus later phases rather than only tele-op.
