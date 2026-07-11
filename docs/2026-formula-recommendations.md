# 2026 Formula Builder Recommendations

## Goals

- Keep the import translation layer thin and generic across seasons.
- Reproduce season-specific spreadsheet calculations with filters, scopes, and built-in formula functions instead of custom code paths.
- Preserve raw scouting strings so formulas can compare directly against the spreadsheet's labels.

## Thin Import Translation

- Blank cells import as `null`.
- Parseable numeric text imports as `number`.
- All other nonblank values import as original `string`.
- No enum normalization across seasons.
- Formulas should use raw string comparisons such as `"Score"` or `"Defense"`.

## Import Validation Warnings

- Run a type-consistency check per imported column after parsing.
- Ignore `null` values for this check.
- If at least 90% of non-null cells in a column share one type, flag cells in the minority type.
- Treat this as a warning for spreadsheet cleanup, not an automatic coercion rule.

## Formula Identifiers

- `scouting.<fieldId>` for imported scouting fields, including raw string fields.
- `tba.<fieldId>` for TBA match fields.
- `filter.<filterId>` for reusable match-level filters.
- Derived equations remain addressable by their equation id.

## Scopes

- `match()` for the current match peer group.
- `allianceMatch()` for the current alliance within the current match.

These scopes are intended for group functions.

## Team-Level Functions

- `teamAverage(series, filter?)`
- `teamSum(series, filter?)`
- `teamCount(series, filter?)`

Behavior:

- `teamAverage` averages numeric match values after optional filtering.
- `teamSum` sums numeric match values after optional filtering.
- `teamCount` counts present, nonblank, nonzero values after optional filtering.

Compatibility aliases may remain:

- `average(...)` -> `teamAverage(...)`
- `sum(...)` -> `teamSum(...)`
- `count(...)` -> `teamCount(...)`

## Group Functions

- `groupAverage(series, scope, filter?)`
- `groupSum(series, scope, filter?)`
- `groupCount(series, scope, filter?)`

Behavior:

- Evaluate the `series` expression for peers inside the requested scope.
- Optional `filter` is evaluated against the same peer set.
- These functions are the reusable replacement for season-specific share-allocation helpers.

## Scalar and String Functions

- `if(condition, whenTrue, whenFalse)`
- `valueOr(value, fallback)`
- `startsWith(text, prefix)`
- `contains(text, fragment)`

## Operators and Literals

- Logical: `&&`, `||`, `!`, `^`, `AND`, `OR`, `NOT`, `XOR`
- Comparison: `<`, `>`, `==`, `!=`, `<=`, `>=`
- Literals: `true`, `false`

## Removals

- Remove `allocateShare`.
- Remove `averageWhenPresent`.
- Remove `averageOverAttempts`.
- Prefer filter-based expressions with `teamAverage`, `teamSum`, and `teamCount`.

## 2026 MatchCalculations Strategy

- Preserve raw role, climb, defense, and position strings from `Match Scouting Import`.
- Expose the corresponding TBA alliance totals and climb statuses through `tba.*`.
- Recreate `MatchCalculations` as derived equations and filters using:
  - raw string comparisons for role/climb states
  - `group*` functions over `match()` and `allianceMatch()`
  - `valueOr()` and `if()` for fallback logic

## Notes

- Keeping raw strings in the imported data makes the translation layer simpler and keeps season logic in formulas.
- The app should continue to support autocomplete and help text for the built-ins above, with case-insensitive matching and corrected casing on completion.
