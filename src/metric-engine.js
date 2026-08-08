(function () {
function roundValue(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function averagePresentNumbers(values) {
  return average((values || []).filter((value) => Number.isFinite(value)));
}

function finiteNumberOrNaN(value) {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "string" && value.trim() === "") return Number.NaN;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function standardDeviation(values) {
  if (!values.length) return 0;
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function uniqueValues(values) {
  return [...new Set((values || []).filter(Boolean))];
}

function sumMatchFields(match, fields) {
  return (fields || []).reduce((sum, field) => sum + Number(match?.components?.[field] || 0), 0);
}

function sumWeightedValues(values, weightedFields) {
  return (weightedFields || []).reduce(
    (sum, entry) => sum + Number(values?.[entry.field] || 0) * Number(entry.weight || 0),
    0,
  );
}

function usableSubmission(submission, options = {}) {
  if (!submission || submission.validity === "excluded") return false;
  if (options.includeFlagged) return true;
  return submission.validity === "valid";
}

function aggregateSubmissionMatches(submissions, options = {}) {
  const scoringComponentIds = Array.isArray(options.scoringComponentIds) ? options.scoringComponentIds : [];
  const scouterMetricIds = Array.isArray(options.scouterMetricIds) ? options.scouterMetricIds : [];
  const aggregatedComponentIds = [...new Set([...scouterMetricIds, ...scoringComponentIds])];
  const grouped = new Map();
  (submissions || [])
    .filter((submission) => usableSubmission(submission, { includeFlagged: Boolean(options.includeFlagged) }))
    .forEach((submission, index) => {
      const matchNumber = Number(submission.matchNumber);
      if (!Number.isFinite(matchNumber)) return;
      if (!grouped.has(matchNumber)) {
        grouped.set(matchNumber, {
          matchNumber,
          submissions: [],
          componentSums: Object.fromEntries(aggregatedComponentIds.map((componentId) => [componentId, 0])),
          componentCounts: Object.fromEntries(aggregatedComponentIds.map((componentId) => [componentId, 0])),
          count: 0,
          order: index,
        });
      }
      const group = grouped.get(matchNumber);
      group.submissions.push(submission);
      group.count += 1;
      aggregatedComponentIds.forEach((componentId) => {
        const value = submission.rawMetrics?.[componentId];
        const numericValue = finiteNumberOrNaN(value);
        if (!Number.isFinite(numericValue)) return;
        group.componentSums[componentId] += numericValue;
        group.componentCounts[componentId] += 1;
      });
    });

  return [...grouped.values()]
    .map((group) => {
      const components = Object.fromEntries(
        aggregatedComponentIds.map((componentId) => {
          const value = group.componentCounts[componentId]
            ? group.componentSums[componentId] / group.componentCounts[componentId]
            : null;
          return [componentId, value];
        }),
      );
      return {
        matchNumber: group.matchNumber,
        submissions: group.submissions,
        total: roundValue(scoringComponentIds.reduce((sum, componentId) => sum + Number(components[componentId] || 0), 0)),
        components,
        order: group.order,
      };
    })
    .sort((left, right) => left.matchNumber - right.matchNumber || left.order - right.order)
    .map(({ order, ...entry }) => entry);
}

function normalizeAllianceFieldShares(submissions, fieldIds, options = {}) {
  const normalizedFieldIds = [...new Set((fieldIds || []).map((fieldId) => String(fieldId || "").trim()).filter(Boolean))];
  if (!normalizedFieldIds.length) return [];
  const grouped = new Map();
  (submissions || [])
    .filter((submission) => usableSubmission(submission, { includeFlagged: Boolean(options.includeFlagged) }))
    .forEach((submission, index) => {
      const alliance = String(submission?.alliance || "").trim().toLowerCase();
      const matchNumber = Number(submission?.matchNumber);
      if (!alliance || !Number.isFinite(matchNumber)) return;
      const groupKey = `${matchNumber}:${alliance}`;
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, {
          matchNumber,
          alliance,
          denominators: Object.fromEntries(normalizedFieldIds.map((fieldId) => [fieldId, 0])),
          entries: [],
        });
      }
      const group = grouped.get(groupKey);
      const values = Object.fromEntries(
        normalizedFieldIds.map((fieldId) => {
          const value = Number(submission?.rawMetrics?.[fieldId] || 0);
          return [fieldId, Number.isFinite(value) ? value : 0];
        }),
      );
      normalizedFieldIds.forEach((fieldId) => {
        group.denominators[fieldId] += Math.max(0, values[fieldId]);
      });
      group.entries.push({
        submission,
        index,
        values,
      });
    });

  return [...grouped.values()]
    .sort((left, right) => left.matchNumber - right.matchNumber || left.alliance.localeCompare(right.alliance))
    .flatMap((group) =>
      group.entries.map((entry) => ({
        submissionId: entry.submission?.id || `${group.matchNumber}:${group.alliance}:${entry.submission?.teamNumber || "team"}:${entry.index}`,
        teamNumber: Number(entry.submission?.teamNumber),
        matchNumber: group.matchNumber,
        alliance: group.alliance,
        shares: Object.fromEntries(
          normalizedFieldIds.map((fieldId) => {
            const denominator = Number(group.denominators[fieldId] || 0);
            return [fieldId, denominator > 0 ? entry.values[fieldId] / denominator : 0];
          }),
        ),
      })),
    );
}

function sliceRecentMatches(aggregatedMatches, recentMatchCount = 0) {
  if (!Array.isArray(aggregatedMatches) || !aggregatedMatches.length) return [];
  const normalizedRecentCount = Math.max(0, Number(recentMatchCount) || 0);
  if (!normalizedRecentCount) return [...aggregatedMatches];
  return aggregatedMatches.slice(-normalizedRecentCount);
}

function summarizeScoutingWindow(aggregatedMatches, scouterMetricDefinitions, derivedMetricDefinitions) {
  if (!aggregatedMatches.length) {
    return {
      matches: [],
      source: {
        total: 0,
        components: Object.fromEntries((scouterMetricDefinitions || []).map((metricDefinition) => [metricDefinition.id, 0])),
        trend: [],
        componentTrend: Object.fromEntries((scouterMetricDefinitions || []).map((metricDefinition) => [metricDefinition.id, []])),
      },
      derived: Object.fromEntries((derivedMetricDefinitions || []).map((metricDefinition) => [metricDefinition.id, 0])),
      derivedTrend: Object.fromEntries((derivedMetricDefinitions || []).map((metricDefinition) => [metricDefinition.id, []])),
      consistency: 25,
    };
  }

  const componentIds = [...new Set([
    ...(scouterMetricDefinitions || []).map((metricDefinition) => metricDefinition.id),
    ...aggregatedMatches.flatMap((match) => Object.keys(match.components || {})),
  ])];
  const totalsTrend = aggregatedMatches.map((match) => match.total);
  const preciseScouterComponents = Object.fromEntries(
    componentIds.map((componentId) => [
      componentId,
      averagePresentNumbers(aggregatedMatches.map((match) => finiteNumberOrNaN(match.components[componentId]))),
    ]),
  );
  const scouterComponents = Object.fromEntries(
    componentIds.map((componentId) => [
      componentId,
      roundValue(preciseScouterComponents[componentId]),
    ]),
  );
  const scouterTrendByComponent = Object.fromEntries(
    componentIds.map((componentId) => [
      componentId,
      aggregatedMatches.map((match) => Number(match.components[componentId] || 0)),
    ]),
  );
  const seasonDerivedMetrics = Object.fromEntries(
    derivedMetricDefinitions.map((metricDefinition) => [
      metricDefinition.id,
      evaluateDerivedMetricDefinition(metricDefinition, preciseScouterComponents, { aggregatedMatches }),
    ]),
  );
  const seasonDerivedTrends = Object.fromEntries(
    derivedMetricDefinitions.map((metricDefinition) => [
      metricDefinition.id,
      aggregatedMatches.map((match) => evaluateDerivedMetricDefinition(metricDefinition, match.components, { aggregatedMatches: [match] })),
    ]),
  );
  const mean = average(totalsTrend) || 1;
  return {
    matches: totalsTrend,
    source: {
      total: roundValue(average(totalsTrend)),
      components: scouterComponents,
      trend: totalsTrend,
      componentTrend: scouterTrendByComponent,
    },
    derived: seasonDerivedMetrics,
    derivedTrend: seasonDerivedTrends,
    consistency: clamp(Math.round(100 - (standardDeviation(totalsTrend) / mean) * 100), 25, 99),
  };
}

function evaluateDerivedMetricDefinition(metricDefinition, values, context = {}) {
  if (!metricDefinition) return 0;
  if (metricDefinition.expression) return Number.NaN;
  if (metricDefinition.formula === "sum") {
    return roundValue((metricDefinition.fields || []).reduce((sum, field) => sum + Number(values?.[field] || 0), 0));
  }
  if (metricDefinition.formula === "weighted_sum") {
    return roundValue(sumWeightedValues(values, metricDefinition.weightedFields));
  }
  if (metricDefinition.formula === "ratio") {
    const aggregatedMatches = Array.isArray(context.aggregatedMatches) ? context.aggregatedMatches : [];
    const numeratorFields = metricDefinition.numeratorFields || metricDefinition.fields || [];
    const numerator = aggregatedMatches.reduce((sum, match) => sum + sumMatchFields(match, numeratorFields), 0);
    let denominator = aggregatedMatches.length;
    if (metricDefinition.denominatorMode === "attempt_sum") {
      denominator = aggregatedMatches.reduce((sum, match) => sum + sumMatchFields(match, metricDefinition.denominatorFields || []), 0);
    } else if (metricDefinition.denominatorMode === "nonzero_numerator_matches") {
      const presenceFields = metricDefinition.presenceFields || numeratorFields;
      denominator = aggregatedMatches.filter((match) => sumMatchFields(match, presenceFields) > 0).length;
    }
    return denominator ? roundValue(numerator / denominator, metricDefinition.unit === "%" ? 0 : 1) : 0;
  }
  if (metricDefinition.formula === "average") {
    const fields = (metricDefinition.fields || [])
      .map((field) => values?.[field])
      .map((value) => finiteNumberOrNaN(value))
      .filter((value) => Number.isFinite(value));
    return fields.length ? roundValue(average(fields), metricDefinition.unit === "%" ? 0 : 1) : 0;
  }
  if (metricDefinition.formula === "rate") {
    const made = (metricDefinition.madeFields || []).reduce((sum, field) => sum + Number(values?.[field] || 0), 0);
    const missed = (metricDefinition.missFields || []).reduce((sum, field) => sum + Number(values?.[field] || 0), 0);
    const attempts = made + missed;
    return attempts ? roundValue((made / attempts) * 100, 0) : 0;
  }
  return 0;
}

function isPresentValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (typeof value === "string") return value.trim() !== "" && value.trim() !== "0";
  return Boolean(value);
}

function numericValueOrNaN(value) {
  if (value === null || value === undefined) return Number.NaN;
  if (typeof value === "string" && value.trim() === "") return Number.NaN;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

function hasFallbackValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim() !== "";
  return true;
}

function scalarResult(value, granularity = "scalar") {
  return {
    kind: "scalar",
    granularity,
    value,
  };
}

function seriesResult(entries) {
  return {
    kind: "series",
    granularity: "match",
    entries: normalizeSeriesEntries(entries),
  };
}

function errorResult(message) {
  return {
    kind: "error",
    granularity: "invalid",
    error: message,
  };
}

function normalizeSeriesEntries(entries) {
  return (entries || [])
    .map((entry) => ({
      key: Number(entry?.key),
      value: entry?.value,
    }))
    .filter((entry) => Number.isFinite(entry.key))
    .sort((left, right) => left.key - right.key);
}

function isErrorResult(result) {
  return result?.kind === "error";
}

function isSeriesResult(result) {
  return result?.kind === "series";
}

function isScalarResult(result) {
  return result?.kind === "scalar";
}

function isScopeResult(result) {
  return result?.kind === "scope";
}

function scopeResult(scopeId) {
  return {
    kind: "scope",
    granularity: "scope",
    scopeId,
  };
}

function binaryGranularity(left, right) {
  if (left.granularity === "match" && right.granularity === "event") return null;
  if (left.granularity === "event" && right.granularity === "match") return null;
  if (left.granularity === "match" || right.granularity === "match") return "match";
  if (left.granularity === "event" || right.granularity === "event") return "event";
  return "scalar";
}

function operateNumbers(left, right, operator) {
  const normalizedLeft = numericValueOrNaN(left);
  const normalizedRight = numericValueOrNaN(right);
  if (Number.isNaN(normalizedLeft) || Number.isNaN(normalizedRight)) return Number.NaN;
  if (operator === "+") return normalizedLeft + normalizedRight;
  if (operator === "-") return normalizedLeft - normalizedRight;
  if (operator === "*") return normalizedLeft * normalizedRight;
  if (operator === "/") return normalizedRight === 0 ? Number.NaN : normalizedLeft / normalizedRight;
  return Number.NaN;
}

function compareValues(left, right, operator) {
  const normalizedLeft = numericValueOrNaN(left);
  const normalizedRight = numericValueOrNaN(right);
  if (!Number.isNaN(normalizedLeft) && !Number.isNaN(normalizedRight)) {
    if (operator === ">") return normalizedLeft > normalizedRight ? 1 : 0;
    if (operator === ">=") return normalizedLeft >= normalizedRight ? 1 : 0;
    if (operator === "<") return normalizedLeft < normalizedRight ? 1 : 0;
    if (operator === "<=") return normalizedLeft <= normalizedRight ? 1 : 0;
    if (operator === "==") return normalizedLeft === normalizedRight ? 1 : 0;
    if (operator === "!=") return normalizedLeft !== normalizedRight ? 1 : 0;
    return Number.NaN;
  }
  if (operator === "==") return String(left ?? "") === String(right ?? "") ? 1 : 0;
  if (operator === "!=") return String(left ?? "") !== String(right ?? "") ? 1 : 0;
  return Number.NaN;
}

function truthyNumber(value) {
  return isPresentValue(value) ? 1 : 0;
}

function seriesEntryMap(result) {
  return new Map((result?.entries || []).map((entry) => [entry.key, entry.value]));
}

function normalizeScalarLikeResult(result) {
  if (isErrorResult(result)) return result;
  if (isScopeResult(result)) return errorResult("Scope values can only be used inside group functions.");
  return result;
}

function coalescedEntryKeys(...results) {
  const keys = new Set();
  results.forEach((result) => {
    (result?.entries || []).forEach((entry) => keys.add(entry.key));
  });
  return [...keys].sort((left, right) => left - right);
}

function valueForKey(result, key) {
  if (isSeriesResult(result)) {
    const entryMap = seriesEntryMap(result);
    return entryMap.get(key);
  }
  return result?.value;
}

function combineFormulaResults(left, right, operator) {
  if (isScopeResult(left) || isScopeResult(right)) return errorResult("Scope values can only be used inside group functions.");
  if (isErrorResult(left)) return left;
  if (isErrorResult(right)) return right;
  const granularity = binaryGranularity(left, right);
  if (!granularity) {
    return errorResult("Cannot mix match-level and event-level values without an averaging function.");
  }
  if (granularity === "match") {
    const entries = coalescedEntryKeys(left, right).map((key) => ({
      key,
      value: operateNumbers(valueForKey(left, key), valueForKey(right, key), operator),
    }));
    return seriesResult(entries);
  }
  return scalarResult(operateNumbers(left.value, right.value, operator), granularity);
}

function comparisonGranularity(left, right) {
  if (left.granularity === "match" || right.granularity === "match") return "match";
  if (left.granularity === "event" || right.granularity === "event") return "event";
  return "scalar";
}

function compareFormulaResults(left, right, operator) {
  if (isScopeResult(left) || isScopeResult(right)) return errorResult("Scope values can only be used inside group functions.");
  if (isErrorResult(left)) return left;
  if (isErrorResult(right)) return right;
  const granularity = comparisonGranularity(left, right);
  if (granularity === "match") {
    const entries = coalescedEntryKeys(left, right).map((key) => ({
      key,
      value: compareValues(valueForKey(left, key), valueForKey(right, key), operator),
    }));
    return seriesResult(entries);
  }
  return scalarResult(compareValues(left.value, right.value, operator), granularity);
}

function combineBooleanResults(left, right, operator) {
  if (isScopeResult(left) || isScopeResult(right)) return errorResult("Scope values can only be used inside group functions.");
  if (isErrorResult(left)) return left;
  if (isErrorResult(right)) return right;
  const granularity = comparisonGranularity(left, right);
  const applyOperator = (leftValue, rightValue) => {
    const leftBool = truthyNumber(leftValue);
    const rightBool = truthyNumber(rightValue);
    if (operator === "and") return leftBool && rightBool ? 1 : 0;
    if (operator === "or") return leftBool || rightBool ? 1 : 0;
    if (operator === "xor") return leftBool !== rightBool ? 1 : 0;
    return 0;
  };
  if (granularity === "match") {
    return seriesResult(
      coalescedEntryKeys(left, right).map((key) => ({
        key,
        value: applyOperator(valueForKey(left, key), valueForKey(right, key)),
      })),
    );
  }
  return scalarResult(applyOperator(left.value, right.value), granularity);
}

function negateBooleanResult(result) {
  if (isErrorResult(result)) return result;
  if (isSeriesResult(result)) {
    return seriesResult(result.entries.map((entry) => ({ key: entry.key, value: truthyNumber(entry.value) ? 0 : 1 })));
  }
  return scalarResult(truthyNumber(result.value) ? 0 : 1, result.granularity);
}

function negateFormulaResult(result) {
  if (isErrorResult(result)) return result;
  if (isScopeResult(result)) return errorResult("Scope values can only be used inside group functions.");
  if (isSeriesResult(result)) {
    return seriesResult(result.entries.map((entry) => ({ key: entry.key, value: -numericValueOrNaN(entry.value) })));
  }
  return scalarResult(-numericValueOrNaN(result.value), result.granularity);
}

function recentSeriesEntries(result, recentEntryCount = 0) {
  if (!isSeriesResult(result)) return [];
  if (!recentEntryCount || recentEntryCount < 1) return result.entries;
  return result.entries.slice(-recentEntryCount);
}

function filteredSeriesEntries(result, filterResult, recentEntryCount = 0) {
  const entries = recentSeriesEntries(result, recentEntryCount);
  if (!filterResult) return entries;
  if (!isSeriesResult(filterResult)) return null;
  const allowedKeys = new Map(
    recentSeriesEntries(filterResult, recentEntryCount).map((entry) => [entry.key, truthyNumber(entry.value) === 1]),
  );
  return entries.filter((entry) => allowedKeys.get(entry.key));
}

function numericSeriesValues(result, recentEntryCount = 0, filterResult = null, seriesError = "Averaging functions require a match-level expression.") {
  if (isScopeResult(result) || isScopeResult(filterResult)) return errorResult("Scope values can only be used inside group functions.");
  if (!isSeriesResult(result)) return errorResult(seriesError);
  const entries = filteredSeriesEntries(result, filterResult, recentEntryCount);
  if (entries === null) return errorResult("Optional filter arguments must evaluate to a match-level expression.");
  return entries
    .map((entry) => numericValueOrNaN(entry.value))
    .filter((value) => !Number.isNaN(value));
}

function averageSeriesValues(result, reducer, recentEntryCount = 0, filterResult = null) {
  const values = numericSeriesValues(result, recentEntryCount, filterResult);
  if (!Array.isArray(values)) return values;
  return scalarResult(reducer(values), "event");
}

function sumSeriesValues(result, recentEntryCount = 0, filterResult = null) {
  const values = numericSeriesValues(result, recentEntryCount, filterResult, "sum requires a match-level expression.");
  if (!Array.isArray(values)) return values;
  return scalarResult(values.length ? roundValue(values.reduce((sum, value) => sum + value, 0), 1) : Number.NaN, "event");
}

function countSeriesValues(result, recentEntryCount = 0, filterResult = null) {
  if (isScopeResult(result) || isScopeResult(filterResult)) return errorResult("Scope values can only be used inside group functions.");
  if (!isSeriesResult(result)) return errorResult("count requires a match-level expression.");
  const entries = filteredSeriesEntries(result, filterResult, recentEntryCount);
  if (entries === null) return errorResult("Optional filter arguments must evaluate to a match-level expression.");
  const count = entries.filter((entry) => isPresentValue(entry.value)).length;
  return scalarResult(count, "event");
}

function extremeSeriesValues(name, result, recentEntryCount = 0, filterResult = null) {
  const values = numericSeriesValues(result, recentEntryCount, filterResult, `${name} requires a match-level expression.`);
  if (!Array.isArray(values)) return values;
  return scalarResult(values.length ? Math[name](...values) : Number.NaN, "event");
}

function averageMatchValues(values) {
  if (!values.length) return Number.NaN;
  return roundValue(average(values), 1);
}

function applyPerKey(conditionResult, whenTrue, whenFalse, mapper) {
  const keys = coalescedEntryKeys(conditionResult, whenTrue, whenFalse);
  return seriesResult(
    keys.map((key) => ({
      key,
      value: mapper(key, valueForKey(conditionResult, key), valueForKey(whenTrue, key), valueForKey(whenFalse, key)),
    })),
  );
}

function ifFormulaResult(conditionResult, whenTrue, whenFalse) {
  if (isErrorResult(conditionResult)) return conditionResult;
  if (isErrorResult(whenTrue)) return whenTrue;
  if (isErrorResult(whenFalse)) return whenFalse;
  if (isScopeResult(conditionResult) || isScopeResult(whenTrue) || isScopeResult(whenFalse)) {
    return errorResult("Scope values can only be used inside group functions.");
  }
  if (conditionResult.granularity === "match" || whenTrue.granularity === "match" || whenFalse.granularity === "match") {
    if (whenTrue.granularity === "event" || whenFalse.granularity === "event") {
      return errorResult("if cannot mix match-level and event-level values.");
    }
    return applyPerKey(conditionResult, whenTrue, whenFalse, (key, conditionValue, trueValue, falseValue) =>
      truthyNumber(conditionValue) ? trueValue : falseValue);
  }
  return truthyNumber(conditionResult.value) ? whenTrue : whenFalse;
}

function valueOrFormulaResult(primaryResult, fallbackResult) {
  if (isErrorResult(primaryResult)) return primaryResult;
  if (isErrorResult(fallbackResult)) return fallbackResult;
  if (isScopeResult(primaryResult) || isScopeResult(fallbackResult)) {
    return errorResult("Scope values can only be used inside group functions.");
  }
  if (primaryResult.granularity === "match" || fallbackResult.granularity === "match") {
    if (primaryResult.granularity === "event" || fallbackResult.granularity === "event") {
      return errorResult("valueOr cannot mix match-level and event-level values.");
    }
    return applyPerKey(primaryResult, primaryResult, fallbackResult, (key, primaryValue, trueValue, fallbackValue) =>
      hasFallbackValue(primaryValue) ? trueValue : fallbackValue);
  }
  return hasFallbackValue(primaryResult.value) ? primaryResult : fallbackResult;
}

function stringPredicateResult(name, textResult, queryResult, predicate) {
  if (isErrorResult(textResult)) return textResult;
  if (isErrorResult(queryResult)) return queryResult;
  if (isScopeResult(textResult) || isScopeResult(queryResult)) {
    return errorResult("Scope values can only be used inside group functions.");
  }
  const granularity = comparisonGranularity(textResult, queryResult);
  const evaluateValue = (textValue, queryValue) => predicate(String(textValue ?? ""), String(queryValue ?? "")) ? 1 : 0;
  if (granularity === "match") {
    if (textResult.granularity === "event" || queryResult.granularity === "event") {
      return errorResult(`${name} cannot mix match-level and event-level values.`);
    }
    return seriesResult(
      coalescedEntryKeys(textResult, queryResult).map((key) => ({
        key,
        value: evaluateValue(valueForKey(textResult, key), valueForKey(queryResult, key)),
      })),
    );
  }
  return scalarResult(evaluateValue(textResult.value, queryResult.value), granularity);
}

function tokenizeFormulaExpression(source) {
  const tokens = [];
  const text = String(source || "");
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (/\s/.test(char)) {
      index += 1;
      continue;
    }
    const twoCharacterOperator = text.slice(index, index + 2);
    if (["<=", ">=", "==", "!=", "&&", "||"].includes(twoCharacterOperator)) {
      tokens.push({ type: twoCharacterOperator, value: twoCharacterOperator });
      index += 2;
      continue;
    }
    if (/[()+\-*/,<>!^]/.test(char)) {
      tokens.push({ type: char, value: char });
      index += 1;
      continue;
    }
    if (char === "\"" || char === "'") {
      const quote = char;
      let end = index + 1;
      let value = "";
      while (end < text.length) {
        const nextChar = text[end];
        if (nextChar === "\\") {
          const escapedChar = text[end + 1];
          if (escapedChar === undefined) return { tokens: [], error: "Unterminated string literal." };
          value += escapedChar;
          end += 2;
          continue;
        }
        if (nextChar === quote) break;
        value += nextChar;
        end += 1;
      }
      if (end >= text.length || text[end] !== quote) return { tokens: [], error: "Unterminated string literal." };
      tokens.push({ type: "string", value });
      index = end + 1;
      continue;
    }
    if (/\d|\./.test(char)) {
      let end = index + 1;
      while (end < text.length && /[\d.]/.test(text[end])) end += 1;
      tokens.push({ type: "number", value: text.slice(index, end) });
      index = end;
      continue;
    }
    if (/[A-Za-z_]/.test(char)) {
      let end = index + 1;
      while (end < text.length && /[A-Za-z0-9_.]/.test(text[end])) end += 1;
      tokens.push({ type: "identifier", value: text.slice(index, end) });
      index = end;
      continue;
    }
    return { tokens: [], error: `Unexpected character "${char}".` };
  }
  return { tokens, error: "" };
}

function parseFormulaExpression(source) {
  const normalizedSource = String(source || "").trim().replace(/^=\s*/, "");
  const tokenized = tokenizeFormulaExpression(normalizedSource);
  if (tokenized.error) return { ast: null, error: tokenized.error };
  const tokens = tokenized.tokens;
  let index = 0;

  function peek() {
    return tokens[index] || null;
  }

  function consume(expectedType) {
    const token = tokens[index];
    if (!token || (expectedType && token.type !== expectedType)) return null;
    index += 1;
    return token;
  }

  function peekIdentifierValue() {
    const token = peek();
    return token?.type === "identifier" ? String(token.value || "").toLowerCase() : "";
  }

  function consumeLogicalKeyword(keyword) {
    const token = peek();
    if (!token || token.type !== "identifier") return null;
    if (String(token.value || "").toLowerCase() !== keyword) return null;
    index += 1;
    return token;
  }

  function parsePrimary() {
    const token = peek();
    if (!token) return null;
    if (token.type === "number") {
      consume("number");
      return { type: "number", value: Number(token.value) };
    }
    if (token.type === "string") {
      consume("string");
      return { type: "string", value: String(token.value || "") };
    }
    if (token.type === "identifier") {
      const normalizedIdentifier = String(token.value || "").toLowerCase();
      if (normalizedIdentifier === "true" || normalizedIdentifier === "false") {
        consume("identifier");
        return { type: "number", value: normalizedIdentifier === "true" ? 1 : 0 };
      }
      consume("identifier");
      if (consume("(")) {
        const args = [];
        if (!consume(")")) {
          do {
            const expression = parseExpression();
            if (!expression) return null;
            args.push(expression);
          } while (consume(","));
          if (!consume(")")) return null;
        }
        return { type: "call", callee: token.value, args };
      }
      return { type: "identifier", name: token.value };
    }
    if (consume("(")) {
      const expression = parseExpression();
      if (!expression || !consume(")")) return null;
      return expression;
    }
    return null;
  }

  function parseUnary() {
    if (consume("+")) return parseUnary();
    if (consume("-")) {
      const argument = parseUnary();
      return argument ? { type: "unary", operator: "-", argument } : null;
    }
    if (consume("!")) {
      const argument = parseUnary();
      return argument ? { type: "unary", operator: "!", argument } : null;
    }
    if (peekIdentifierValue() === "not") {
      consumeLogicalKeyword("not");
      const argument = parseUnary();
      return argument ? { type: "unary", operator: "!", argument } : null;
    }
    return parsePrimary();
  }

  function parseMultiplicative() {
    let left = parseUnary();
    if (!left) return null;
    while (peek() && (peek().type === "*" || peek().type === "/")) {
      const operator = consume().type;
      const right = parseUnary();
      if (!right) return null;
      left = { type: "binary", operator, left, right };
    }
    return left;
  }

  function parseAdditive() {
    let left = parseMultiplicative();
    if (!left) return null;
    while (peek() && (peek().type === "+" || peek().type === "-")) {
      const operator = consume().type;
      const right = parseMultiplicative();
      if (!right) return null;
      left = { type: "binary", operator, left, right };
    }
    return left;
  }

  function parseComparison() {
    let left = parseAdditive();
    if (!left) return null;
    while (peek() && [">", ">=", "<", "<=", "==", "!="].includes(peek().type)) {
      const operator = consume().type;
      const right = parseAdditive();
      if (!right) return null;
      left = { type: "comparison", operator, left, right };
    }
    return left;
  }

  function parseAnd() {
    let left = parseComparison();
    if (!left) return null;
    while (peek() && (peek().type === "&&" || peekIdentifierValue() === "and")) {
      if (peek().type === "&&") consume("&&");
      else consumeLogicalKeyword("and");
      const right = parseComparison();
      if (!right) return null;
      left = { type: "logical", operator: "and", left, right };
    }
    return left;
  }

  function parseXor() {
    let left = parseAnd();
    if (!left) return null;
    while (peek() && (peek().type === "^" || peekIdentifierValue() === "xor")) {
      if (peek().type === "^") consume("^");
      else consumeLogicalKeyword("xor");
      const right = parseAnd();
      if (!right) return null;
      left = { type: "logical", operator: "xor", left, right };
    }
    return left;
  }

  function parseOr() {
    let left = parseXor();
    if (!left) return null;
    while (peek() && (peek().type === "||" || peekIdentifierValue() === "or")) {
      if (peek().type === "||") consume("||");
      else consumeLogicalKeyword("or");
      const right = parseXor();
      if (!right) return null;
      left = { type: "logical", operator: "or", left, right };
    }
    return left;
  }

  function parseExpression() {
    return parseOr();
  }

  const ast = parseExpression();
  if (!ast) return { ast: null, error: "Could not parse formula." };
  if (index < tokens.length) return { ast: null, error: `Unexpected token "${tokens[index].value}".` };
  return { ast, error: "" };
}

function collectFormulaIdentifiers(ast, values = new Set()) {
  if (!ast) return values;
  if (ast.type === "identifier") values.add(ast.name);
  if (ast.type === "unary") collectFormulaIdentifiers(ast.argument, values);
  if (ast.type === "binary") {
    collectFormulaIdentifiers(ast.left, values);
    collectFormulaIdentifiers(ast.right, values);
  }
  if (ast.type === "comparison") {
    collectFormulaIdentifiers(ast.left, values);
    collectFormulaIdentifiers(ast.right, values);
  }
  if (ast.type === "logical") {
    collectFormulaIdentifiers(ast.left, values);
    collectFormulaIdentifiers(ast.right, values);
  }
  if (ast.type === "call") ast.args.forEach((argument) => collectFormulaIdentifiers(argument, values));
  return values;
}

function evaluateFormulaAst(ast, options = {}) {
  const resolveIdentifier = typeof options.resolveIdentifier === "function" ? options.resolveIdentifier : (() => errorResult("Identifier resolver is required."));
  const evaluateGroupFunction = typeof options.evaluateGroupFunction === "function" ? options.evaluateGroupFunction : null;
  if (!ast) return errorResult("Formula AST is required.");
  if (ast.type === "number") return scalarResult(ast.value, "scalar");
  if (ast.type === "string") return scalarResult(ast.value, "scalar");
  if (ast.type === "identifier") {
    const resolved = resolveIdentifier(ast.name);
    return normalizeScalarLikeResult(resolved || errorResult(`Unknown identifier "${ast.name}".`));
  }
  if (ast.type === "unary") {
    if (ast.operator === "!") return negateBooleanResult(evaluateFormulaAst(ast.argument, options));
    return negateFormulaResult(evaluateFormulaAst(ast.argument, options));
  }
  if (ast.type === "binary") {
    return combineFormulaResults(
      evaluateFormulaAst(ast.left, options),
      evaluateFormulaAst(ast.right, options),
      ast.operator,
    );
  }
  if (ast.type === "comparison") {
    return compareFormulaResults(
      evaluateFormulaAst(ast.left, options),
      evaluateFormulaAst(ast.right, options),
      ast.operator,
    );
  }
  if (ast.type === "logical") {
    return combineBooleanResults(
      evaluateFormulaAst(ast.left, options),
      evaluateFormulaAst(ast.right, options),
      ast.operator,
    );
  }
  if (ast.type === "call") {
    const normalizedName = String(ast.callee || "").trim().toLowerCase();
    const recentEntryCount = Number(options.recentEntryCount) || 0;
    const evaluateOptionalFilter = (filterAst) => (filterAst ? evaluateFormulaAst(filterAst, options) : null);
    if (normalizedName === "and") {
      if (ast.args.length < 2) return errorResult("and requires at least two arguments.");
      return ast.args
        .map((argument) => evaluateFormulaAst(argument, options))
        .reduce((left, right) => combineBooleanResults(left, right, "and"));
    }
    if (normalizedName === "or") {
      if (ast.args.length < 2) return errorResult("or requires at least two arguments.");
      return ast.args
        .map((argument) => evaluateFormulaAst(argument, options))
        .reduce((left, right) => combineBooleanResults(left, right, "or"));
    }
    if (normalizedName === "xor") {
      if (ast.args.length < 2) return errorResult("xor requires at least two arguments.");
      return ast.args
        .map((argument) => evaluateFormulaAst(argument, options))
        .reduce((left, right) => combineBooleanResults(left, right, "xor"));
    }
    if (normalizedName === "not") {
      if (ast.args.length !== 1) return errorResult("not requires exactly one argument.");
      return negateBooleanResult(evaluateFormulaAst(ast.args[0], options));
    }
    if (normalizedName === "match") {
      if (ast.args.length !== 0) return errorResult("match takes no arguments.");
      return scopeResult("match");
    }
    if (normalizedName === "alliancematch") {
      if (ast.args.length !== 0) return errorResult("allianceMatch takes no arguments.");
      return scopeResult("allianceMatch");
    }
    if (normalizedName === "if") {
      if (ast.args.length !== 3) return errorResult("if requires exactly three arguments.");
      return ifFormulaResult(
        evaluateFormulaAst(ast.args[0], options),
        evaluateFormulaAst(ast.args[1], options),
        evaluateFormulaAst(ast.args[2], options),
      );
    }
    if (normalizedName === "valueor") {
      if (ast.args.length !== 2) return errorResult("valueOr requires exactly two arguments.");
      return valueOrFormulaResult(
        evaluateFormulaAst(ast.args[0], options),
        evaluateFormulaAst(ast.args[1], options),
      );
    }
    if (normalizedName === "startswith") {
      if (ast.args.length !== 2) return errorResult("startsWith requires exactly two arguments.");
      return stringPredicateResult("startsWith", evaluateFormulaAst(ast.args[0], options), evaluateFormulaAst(ast.args[1], options), (textValue, queryValue) =>
        textValue.toLowerCase().startsWith(queryValue.toLowerCase()));
    }
    if (normalizedName === "contains") {
      if (ast.args.length !== 2) return errorResult("contains requires exactly two arguments.");
      return stringPredicateResult("contains", evaluateFormulaAst(ast.args[0], options), evaluateFormulaAst(ast.args[1], options), (textValue, queryValue) =>
        textValue.toLowerCase().includes(queryValue.toLowerCase()));
    }
    if (["average", "teamaverage"].includes(normalizedName)) {
      if (ast.args.length < 1 || ast.args.length > 2) return errorResult("average requires one series argument and an optional filter.");
      return averageSeriesValues(
        evaluateFormulaAst(ast.args[0], options),
        averageMatchValues,
        recentEntryCount,
        evaluateOptionalFilter(ast.args[1] || null),
      );
    }
    if (["sum", "teamsum"].includes(normalizedName)) {
      if (ast.args.length < 1 || ast.args.length > 2) return errorResult("sum requires one series argument and an optional filter.");
      return sumSeriesValues(
        evaluateFormulaAst(ast.args[0], options),
        recentEntryCount,
        evaluateOptionalFilter(ast.args[1] || null),
      );
    }
    if (["count", "teamcount"].includes(normalizedName)) {
      if (ast.args.length < 1 || ast.args.length > 2) return errorResult("count requires one series argument and an optional filter.");
      return countSeriesValues(
        evaluateFormulaAst(ast.args[0], options),
        recentEntryCount,
        evaluateOptionalFilter(ast.args[1] || null),
      );
    }
    if (["min", "max", "teammin", "teammax"].includes(normalizedName)) {
      if (ast.args.length < 1 || ast.args.length > 2) return errorResult(`${normalizedName} requires one series argument and an optional filter.`);
      return extremeSeriesValues(
        normalizedName.replace(/^team/, ""),
        evaluateFormulaAst(ast.args[0], options),
        recentEntryCount,
        evaluateOptionalFilter(ast.args[1] || null),
      );
    }
    if (["matchaverage", "matchsum", "matchcount", "matchmin", "matchmax", "allianceaverage", "alliancesum", "alliancecount", "alliancemin", "alliancemax"].includes(normalizedName)) {
      if (!evaluateGroupFunction) return errorResult(`${ast.callee} is not available in this context.`);
      if (ast.args.length < 1 || ast.args.length > 2) return errorResult(`${ast.callee} requires series and an optional filter.`);
      const nameMap = {
        matchaverage: "groupaverage",
        matchsum: "groupsum",
        matchcount: "groupcount",
        matchmin: "groupmin",
        matchmax: "groupmax",
        allianceaverage: "groupaverage",
        alliancesum: "groupsum",
        alliancecount: "groupcount",
        alliancemin: "groupmin",
        alliancemax: "groupmax",
      };
      const scopeMap = {
        matchaverage: "match",
        matchsum: "match",
        matchcount: "match",
        matchmin: "match",
        matchmax: "match",
        allianceaverage: "allianceMatch",
        alliancesum: "allianceMatch",
        alliancecount: "allianceMatch",
        alliancemin: "allianceMatch",
        alliancemax: "allianceMatch",
      };
      return evaluateGroupFunction({
        name: nameMap[normalizedName],
        seriesAst: ast.args[0],
        scopeId: scopeMap[normalizedName],
        filterAst: ast.args[1] || null,
        parentOptions: options,
      });
    }
    if (["eventaverage", "eventsum", "eventcount", "eventmin", "eventmax"].includes(normalizedName)) {
      const evaluateEventFunction = typeof options.evaluateEventFunction === "function" ? options.evaluateEventFunction : null;
      if (!evaluateEventFunction) return errorResult(`${ast.callee} is not available in this context.`);
      if (ast.args.length < 1 || ast.args.length > 2) return errorResult(`${ast.callee} requires a per-team event value and an optional team-level filter.`);
      return evaluateEventFunction({
        name: normalizedName,
        valueAst: ast.args[0],
        filterAst: ast.args[1] || null,
        parentOptions: options,
      });
    }
    if (["groupaverage", "groupsum", "groupcount"].includes(normalizedName)) {
      if (!evaluateGroupFunction) return errorResult(`${ast.callee} is not available in this context.`);
      if (ast.args.length < 2 || ast.args.length > 3) return errorResult(`${ast.callee} requires series, scope, and an optional filter.`);
      const scopeValue = evaluateFormulaAst(ast.args[1], options);
      if (isErrorResult(scopeValue)) return scopeValue;
      if (!isScopeResult(scopeValue)) return errorResult(`${ast.callee} requires a scope like match() or allianceMatch().`);
      return evaluateGroupFunction({
        name: normalizedName,
        seriesAst: ast.args[0],
        scopeId: scopeValue.scopeId,
        filterAst: ast.args[2] || null,
        parentOptions: options,
      });
    }
    return errorResult(`Unknown function "${normalizedName}".`);
  }
  return errorResult("Unsupported formula node.");
}

function evaluateFormulaExpression(source, options = {}) {
  if (!evaluateFormulaExpression.cache) evaluateFormulaExpression.cache = new Map();
  const cacheKey = String(source || "");
  let parsed = evaluateFormulaExpression.cache.get(cacheKey);
  if (!parsed) {
    parsed = parseFormulaExpression(source);
    if (!parsed.error) evaluateFormulaExpression.cache.set(cacheKey, parsed);
  }
  if (parsed.error) return errorResult(parsed.error);
  const result = evaluateFormulaAst(parsed.ast, options);
  result.ast = parsed.ast;
  result.identifiers = [...collectFormulaIdentifiers(parsed.ast)];
  return result;
}

function scoutingFlagsForTeam(baseTeam, submissions, importedMatchCount, consistency) {
  const flags = [...(baseTeam.flags || [])];
  const duplicateCount = (submissions || []).filter((submission) => submission.confidenceReasons?.includes("duplicate_submission")).length;
  const flaggedCount = (submissions || []).filter((submission) => submission.validity === "flagged").length;
  const brokenCount = (submissions || []).filter((submission) => /broken|dead|disabled/i.test(submission.robotStatus || "")).length;

  if (importedMatchCount && importedMatchCount < 4) {
    flags.push({
      type: "data_suspect",
      label: "Sparse",
      severity: "warn",
      evidence: `Only ${importedMatchCount} imported matches are currently available.`,
    });
  }
  if (duplicateCount) {
    flags.push({
      type: "data_suspect",
      label: "Duplicates",
      severity: "warn",
      evidence: `${duplicateCount} duplicate scouting submission${duplicateCount === 1 ? "" : "s"} flagged for this team.`,
    });
  }
  if (flaggedCount && !duplicateCount) {
    flags.push({
      type: "data_suspect",
      label: "Flagged",
      severity: "warn",
      evidence: `${flaggedCount} imported scouting row${flaggedCount === 1 ? "" : "s"} need admin review.`,
    });
  }
  if (brokenCount) {
    flags.push({
      type: "broken",
      label: "Breakdowns",
      severity: "danger",
      evidence: `Robot status was marked broken, dead, or disabled in ${brokenCount} imported submission${brokenCount === 1 ? "" : "s"}.`,
    });
  }
  if (importedMatchCount >= 3 && consistency < 70) {
    flags.push({
      type: "inconsistent",
      label: "Inconsistent",
      severity: "warn",
      evidence: "Imported scouting totals show large match-to-match variance.",
    });
  }

  return flags.filter((flag, index, array) => array.findIndex((item) => item.type === flag.type && item.label === flag.label) === index);
}

function buildTeamScoutingOverlay(baseTeam, options = {}) {
  const submissions = (options.submissions || []).filter((submission) => Number(submission.teamNumber) === baseTeam.number);
  const scouterMetricDefinitions = Array.isArray(options.scouterMetricDefinitions) ? options.scouterMetricDefinitions : [];
  const derivedMetricDefinitions = Array.isArray(options.derivedMetricDefinitions) ? options.derivedMetricDefinitions : [];
  const aggregatedMatches = aggregateSubmissionMatches(submissions, {
    scoringComponentIds: (options.scoringComponents || []).map((component) => component.id),
    scouterMetricIds: scouterMetricDefinitions.map((metricDefinition) => metricDefinition.id),
    scouterMetricDefinitions,
  });
  const recentMatchCount = Math.max(1, Number(options.recentMatchCount) || 4);
  const recentAggregatedMatches = sliceRecentMatches(aggregatedMatches, recentMatchCount);
  const uniqueImportedMatches = new Set(aggregatedMatches.map((match) => match.matchNumber)).size;
  const scoutingReasons = uniqueValues([
    ...(uniqueImportedMatches < 4 ? ["sparse_matches"] : []),
    ...submissions.flatMap((submission) => submission.confidenceReasons || []),
  ]);
  const scoutingConfidenceTier = scoutingReasons.includes("schema_gap") || scoutingReasons.includes("duplicate_submission")
    ? "low"
    : scoutingReasons.length
      ? "medium"
      : "high";

  if (!aggregatedMatches.length) {
    const emptyScouterComponents = Object.fromEntries(scouterMetricDefinitions.map((metricDefinition) => [metricDefinition.id, 0]));
    const emptyDerived = Object.fromEntries(derivedMetricDefinitions.map((metricDefinition) => [metricDefinition.id, 0]));
    const flags = scoutingFlagsForTeam(baseTeam, submissions, uniqueImportedMatches, 25);
    return {
      ...baseTeam,
      flags,
      matches: [],
      sources: {
        ...baseTeam.sources,
        scouter: {
          total: 0,
          components: emptyScouterComponents,
          trend: [],
          componentTrend: Object.fromEntries(scouterMetricDefinitions.map((metricDefinition) => [metricDefinition.id, []])),
        },
      },
      derived: {
        ...baseTeam.derived,
        defenseImpact: 0,
        consistency: 25,
        ...emptyDerived,
      },
      derivedTrend: Object.fromEntries(derivedMetricDefinitions.map((metricDefinition) => [metricDefinition.id, []])),
      recentWindow: {
        matchCount: recentMatchCount,
        matches: [],
        sources: {
          ...(baseTeam.sources || {}),
          scouter: {
            total: 0,
            components: emptyScouterComponents,
            trend: [],
            componentTrend: Object.fromEntries(scouterMetricDefinitions.map((metricDefinition) => [metricDefinition.id, []])),
          },
        },
        derived: {
          ...(baseTeam.derived || {}),
          defenseImpact: 0,
          consistency: 25,
          ...emptyDerived,
        },
        derivedTrend: Object.fromEntries(derivedMetricDefinitions.map((metricDefinition) => [metricDefinition.id, []])),
      },
      scouting: {
        submissionCount: submissions.length,
        importedMatches: uniqueImportedMatches,
        flaggedCount: submissions.filter((submission) => submission.validity === "flagged").length,
        recentMatchCount,
        confidence: {
          tier: submissions.length ? scoutingConfidenceTier : "medium",
          reasons: submissions.length ? scoutingReasons : ["no_scouting_data", "seeded_scouting"],
        },
      },
    };
  }

  const allWindow = summarizeScoutingWindow(aggregatedMatches, scouterMetricDefinitions, derivedMetricDefinitions);
  const recentWindow = summarizeScoutingWindow(recentAggregatedMatches, scouterMetricDefinitions, derivedMetricDefinitions);
  const usableSubmissions = submissions.filter(usableSubmission);
  const recentUsableSubmissions = sliceRecentMatches(
    usableSubmissions
      .map((submission, index) => ({ ...submission, __order: index }))
      .sort((left, right) => Number(left.matchNumber) - Number(right.matchNumber) || left.__order - right.__order),
    recentMatchCount,
  );
  const defenseRate = usableSubmissions.filter((submission) => submission.defensePlayed).length / Math.max(1, usableSubmissions.length);
  const recentDefenseRate = recentUsableSubmissions.filter((submission) => submission.defensePlayed).length / Math.max(1, recentUsableSubmissions.length);
  const defenseImpact = roundValue(defenseRate * Math.max(1, allWindow.source.total * 0.25));
  const recentDefenseImpact = roundValue(recentDefenseRate * Math.max(1, recentWindow.source.total * 0.25));
  const flags = scoutingFlagsForTeam(baseTeam, submissions, uniqueImportedMatches, allWindow.consistency);
  return {
    ...baseTeam,
    flags,
    matches: allWindow.matches,
    sources: {
      ...baseTeam.sources,
      scouter: {
        total: allWindow.source.total,
        components: allWindow.source.components,
        trend: allWindow.source.trend,
        componentTrend: allWindow.source.componentTrend,
      },
    },
    derived: {
      ...baseTeam.derived,
      defenseImpact,
      consistency: allWindow.consistency,
      ...allWindow.derived,
    },
    derivedTrend: allWindow.derivedTrend,
    recentWindow: {
      matchCount: recentMatchCount,
      matches: recentWindow.matches,
      sources: {
        ...baseTeam.sources,
        scouter: {
          total: recentWindow.source.total,
          components: recentWindow.source.components,
          trend: recentWindow.source.trend,
          componentTrend: recentWindow.source.componentTrend,
        },
      },
      derived: {
        ...baseTeam.derived,
        defenseImpact: recentDefenseImpact,
        consistency: recentWindow.consistency,
        ...recentWindow.derived,
      },
      derivedTrend: recentWindow.derivedTrend,
    },
    scouting: {
      submissionCount: submissions.length,
      importedMatches: uniqueImportedMatches,
      flaggedCount: submissions.filter((submission) => submission.validity === "flagged").length,
      recentMatchCount,
      confidence: {
        tier: scoutingConfidenceTier,
        reasons: scoutingReasons,
      },
    },
  };
}

function scopedTeamWindow(team, options = {}) {
  return options.window === "recent" ? team?.recentWindow || null : null;
}

function teamMetricValue(team, metric, options = {}) {
  if (!team || !metric) return 0;
  const windowedTeam = scopedTeamWindow(team, options);
  if (windowedTeam && (metric.kind === "derived" || metric.sourceId === "scouter")) {
    if (metric.kind === "derived") return Number(windowedTeam.derived?.[metric.componentId] || 0);
    if (metric.componentId === "total") return Number(windowedTeam.sources?.[metric.sourceId]?.total || 0);
    return Number(windowedTeam.sources?.[metric.sourceId]?.components?.[metric.componentId] || 0);
  }
  if (metric.kind === "derived") return Number(team.derived?.[metric.componentId] || 0);
  if (metric.componentId === "total") return Number(team.sources?.[metric.sourceId]?.total || 0);
  return Number(team.sources?.[metric.sourceId]?.components?.[metric.componentId] || 0);
}

function metricTrendValues(team, metric, options = {}) {
  if (!team || !metric) return [];
  const windowedTeam = scopedTeamWindow(team, options);
  if (windowedTeam && (metric.kind === "derived" || metric.sourceId === "scouter")) {
    if (metric.kind === "source") {
      if (metric.sourceId === "scouter" && metric.componentId === "total") {
        return Array.isArray(windowedTeam.sources?.scouter?.trend) ? windowedTeam.sources.scouter.trend : [];
      }
      if (metric.sourceId === "scouter" && metric.componentId !== "total" && Array.isArray(windowedTeam.sources?.scouter?.componentTrend?.[metric.componentId])) {
        return windowedTeam.sources.scouter.componentTrend[metric.componentId];
      }
    }
    if (Array.isArray(windowedTeam.derivedTrend?.[metric.componentId])) {
      return windowedTeam.derivedTrend[metric.componentId];
    }
  }
  if (metric.kind === "source") {
    if (metric.sourceId === "scouter" && metric.componentId === "total") {
      return Array.isArray(team.sources?.scouter?.trend) ? team.sources.scouter.trend : [];
    }
    if (metric.sourceId === "scouter" && metric.componentId !== "total" && Array.isArray(team.sources?.scouter?.componentTrend?.[metric.componentId])) {
      return team.sources.scouter.componentTrend[metric.componentId];
    }
    const sourceTrend = team.sources?.[metric.sourceId]?.trend || team.matches || [];
    if (metric.componentId === "total") return sourceTrend;
    const total = team.sources?.[metric.sourceId]?.total || 1;
    const component = team.sources?.[metric.sourceId]?.components?.[metric.componentId] || 0;
    return sourceTrend.map((value) => (value / total) * component);
  }
  if (Array.isArray(team.derivedTrend?.[metric.componentId])) {
    return team.derivedTrend[metric.componentId];
  }
  const teamMatches = Array.isArray(team.matches) ? team.matches : [];
  const baseline = average(teamMatches) || 1;
  return teamMatches.map((value) => (value / baseline) * teamMetricValue(team, metric));
}

globalThis.MetricEngine = {
  aggregateSubmissionMatches,
  average,
  buildTeamScoutingOverlay,
  collectFormulaIdentifiers,
  evaluateDerivedMetricDefinition,
  evaluateFormulaAst,
  evaluateFormulaExpression,
  errorResult,
  isErrorResult,
  isScopeResult,
  isScalarResult,
  isSeriesResult,
  metricTrendValues,
  normalizeAllianceFieldShares,
  parseFormulaExpression,
  scoutingFlagsForTeam,
  scalarResult,
  seriesResult,
  sliceRecentMatches,
  scopeResult,
  standardDeviation,
  summarizeScoutingWindow,
  teamMetricValue,
};
})();
