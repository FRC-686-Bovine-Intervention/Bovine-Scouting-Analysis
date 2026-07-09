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
  const scouterMetricDefinitions = Array.isArray(options.scouterMetricDefinitions) ? options.scouterMetricDefinitions : [];
  const componentAggregation = Object.fromEntries(
    scouterMetricDefinitions.map((metricDefinition) => [metricDefinition.id, String(metricDefinition.aggregate || "average")]),
  );
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
          componentSums: Object.fromEntries(scouterMetricIds.map((componentId) => [componentId, 0])),
          count: 0,
          order: index,
        });
      }
      const group = grouped.get(matchNumber);
      group.submissions.push(submission);
      group.count += 1;
      scouterMetricIds.forEach((componentId) => {
        const value = submission.rawMetrics?.[componentId];
        group.componentSums[componentId] += Number.isFinite(Number(value)) ? Number(value) : 0;
      });
    });

  return [...grouped.values()]
    .map((group) => {
      const components = Object.fromEntries(
        scouterMetricIds.map((componentId) => {
          const aggregation = componentAggregation[componentId] || "average";
          const value =
            aggregation === "max"
              ? group.submissions.reduce((maxValue, submission) => {
                const submissionValue = Number(submission.rawMetrics?.[componentId] || 0);
                return Number.isFinite(submissionValue) ? Math.max(maxValue, submissionValue) : maxValue;
              }, 0)
              : group.count
                ? group.componentSums[componentId] / group.count
                : 0;
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

  const totalsTrend = aggregatedMatches.map((match) => match.total);
  const preciseScouterComponents = Object.fromEntries(
    scouterMetricDefinitions.map((metricDefinition) => [
      metricDefinition.id,
      average(aggregatedMatches.map((match) => Number(match.components[metricDefinition.id] || 0))),
    ]),
  );
  const scouterComponents = Object.fromEntries(
    scouterMetricDefinitions.map((metricDefinition) => [
      metricDefinition.id,
      roundValue(preciseScouterComponents[metricDefinition.id]),
    ]),
  );
  const scouterTrendByComponent = Object.fromEntries(
    scouterMetricDefinitions.map((metricDefinition) => [
      metricDefinition.id,
      aggregatedMatches.map((match) => Number(match.components[metricDefinition.id] || 0)),
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
    const fields = (metricDefinition.fields || []).map((field) => Number(values?.[field] || 0)).filter((value) => Number.isFinite(value));
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

function scalarResult(value, granularity = "scalar") {
  return {
    kind: "scalar",
    granularity,
    value: Number(value),
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
      value: Number(entry?.value),
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

function binaryGranularity(left, right) {
  if (left.granularity === "match" && right.granularity === "event") return null;
  if (left.granularity === "event" && right.granularity === "match") return null;
  if (left.granularity === "match" || right.granularity === "match") return "match";
  if (left.granularity === "event" || right.granularity === "event") return "event";
  return "scalar";
}

function operateNumbers(left, right, operator) {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  if (operator === "/") return right === 0 ? Number.NaN : left / right;
  return Number.NaN;
}

function compareNumbers(left, right, operator) {
  if (operator === ">") return left > right ? 1 : 0;
  if (operator === ">=") return left >= right ? 1 : 0;
  if (operator === "<") return left < right ? 1 : 0;
  if (operator === "<=") return left <= right ? 1 : 0;
  if (operator === "==") return left === right ? 1 : 0;
  if (operator === "!=") return left !== right ? 1 : 0;
  return Number.NaN;
}

function truthyNumber(value) {
  return Number.isFinite(Number(value)) && Number(value) !== 0 ? 1 : 0;
}

function seriesEntryMap(result) {
  return new Map((result?.entries || []).map((entry) => [entry.key, Number(entry.value)]));
}

function combineFormulaResults(left, right, operator) {
  if (isErrorResult(left)) return left;
  if (isErrorResult(right)) return right;
  const granularity = binaryGranularity(left, right);
  if (!granularity) {
    return errorResult("Cannot mix match-level and event-level values without an averaging function.");
  }
  if (granularity === "match") {
    const keys = new Set();
    const leftMap = isSeriesResult(left) ? seriesEntryMap(left) : null;
    const rightMap = isSeriesResult(right) ? seriesEntryMap(right) : null;
    (left?.entries || []).forEach((entry) => keys.add(entry.key));
    (right?.entries || []).forEach((entry) => keys.add(entry.key));
    const entries = [...keys]
      .sort((a, b) => a - b)
      .map((key) => {
        const leftValue = leftMap ? leftMap.get(key) : Number(left.value);
        const rightValue = rightMap ? rightMap.get(key) : Number(right.value);
        return {
          key,
          value: Number.isFinite(leftValue) && Number.isFinite(rightValue)
            ? operateNumbers(leftValue, rightValue, operator)
            : Number.NaN,
        };
      });
    return seriesResult(entries);
  }
  return scalarResult(operateNumbers(Number(left.value), Number(right.value), operator), granularity);
}

function comparisonGranularity(left, right) {
  if (left.granularity === "match" || right.granularity === "match") return "match";
  if (left.granularity === "event" || right.granularity === "event") return "event";
  return "scalar";
}

function compareFormulaResults(left, right, operator) {
  if (isErrorResult(left)) return left;
  if (isErrorResult(right)) return right;
  const granularity = comparisonGranularity(left, right);
  if (granularity === "match") {
    const keys = new Set();
    const leftMap = isSeriesResult(left) ? seriesEntryMap(left) : null;
    const rightMap = isSeriesResult(right) ? seriesEntryMap(right) : null;
    (left?.entries || []).forEach((entry) => keys.add(entry.key));
    (right?.entries || []).forEach((entry) => keys.add(entry.key));
    const entries = [...keys]
      .sort((a, b) => a - b)
      .map((key) => {
        const leftValue = leftMap ? leftMap.get(key) : Number(left.value);
        const rightValue = rightMap ? rightMap.get(key) : Number(right.value);
        return {
          key,
          value: Number.isFinite(leftValue) && Number.isFinite(rightValue)
            ? compareNumbers(leftValue, rightValue, operator)
            : 0,
        };
      });
    return seriesResult(entries);
  }
  return scalarResult(compareNumbers(Number(left.value), Number(right.value), operator), granularity);
}

function combineBooleanResults(left, right, operator) {
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
    const keys = new Set();
    const leftMap = isSeriesResult(left) ? seriesEntryMap(left) : null;
    const rightMap = isSeriesResult(right) ? seriesEntryMap(right) : null;
    (left?.entries || []).forEach((entry) => keys.add(entry.key));
    (right?.entries || []).forEach((entry) => keys.add(entry.key));
    return seriesResult(
      [...keys].sort((a, b) => a - b).map((key) => ({
        key,
        value: applyOperator(leftMap ? leftMap.get(key) : left.value, rightMap ? rightMap.get(key) : right.value),
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
  if (isSeriesResult(result)) {
    return seriesResult(result.entries.map((entry) => ({ key: entry.key, value: -Number(entry.value) })));
  }
  return scalarResult(-Number(result.value), result.granularity);
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

function averageSeriesValues(result, reducer, recentEntryCount = 0, filterResult = null) {
  if (!isSeriesResult(result)) return errorResult("Averaging functions require a match-level expression.");
  const entries = filteredSeriesEntries(result, filterResult, recentEntryCount);
  if (entries === null) return errorResult("Optional filter arguments must evaluate to a match-level expression.");
  const values = entries
    .map((entry) => Number(entry.value))
    .filter((value) => !Number.isNaN(value));
  return scalarResult(reducer(values), "event");
}

function sumSeriesValues(result, recentEntryCount = 0, filterResult = null) {
  if (!isSeriesResult(result)) return errorResult("sum requires a match-level expression.");
  const entries = filteredSeriesEntries(result, filterResult, recentEntryCount);
  if (entries === null) return errorResult("Optional filter arguments must evaluate to a match-level expression.");
  const values = entries
    .map((entry) => Number(entry.value))
    .filter((value) => !Number.isNaN(value));
  return scalarResult(values.length ? roundValue(values.reduce((sum, value) => sum + value, 0), 1) : Number.NaN, "event");
}

function averageMatchValues(values) {
  if (!values.length) return Number.NaN;
  return roundValue(average(values), 1);
}

function averageWhenPresentValues(values) {
  const present = values.filter((value) => value !== 0);
  if (!present.length) return Number.NaN;
  return roundValue(average(present), 1);
}

function averageOverAttemptValues(metricResult, attemptResult, recentEntryCount = 0, filterResult = null) {
  if (!isSeriesResult(metricResult) || !isSeriesResult(attemptResult)) {
    return errorResult("averageOverAttempts requires match-level metric and attempt expressions.");
  }
  const metricEntries = filteredSeriesEntries(metricResult, filterResult, recentEntryCount);
  const attemptEntries = filteredSeriesEntries(attemptResult, filterResult, recentEntryCount);
  if (metricEntries === null || attemptEntries === null) {
    return errorResult("Optional filter arguments must evaluate to a match-level expression.");
  }
  const metricMap = new Map(metricEntries.map((entry) => [entry.key, Number(entry.value)]));
  const attemptMap = new Map(attemptEntries.map((entry) => [entry.key, Number(entry.value)]));
  const keys = [...new Set([...metricMap.keys(), ...attemptMap.keys()])].sort((a, b) => a - b);
  let numerator = 0;
  let denominator = 0;
  keys.forEach((key) => {
    const metricValue = Number(metricMap.get(key));
    const attemptValue = Number(attemptMap.get(key));
    if (!Number.isNaN(attemptValue) && attemptValue > 0) {
      denominator += attemptValue;
      if (!Number.isNaN(metricValue)) numerator += metricValue;
    }
  });
  return scalarResult(denominator === 0 ? Number.NaN : roundValue(numerator / denominator, 1), "event");
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
  const tokenized = tokenizeFormulaExpression(source);
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
  if (!ast) return errorResult("Formula AST is required.");
  if (ast.type === "number") return scalarResult(ast.value, "scalar");
  if (ast.type === "identifier") {
    const resolved = resolveIdentifier(ast.name);
    return resolved || errorResult(`Unknown identifier "${ast.name}".`);
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
    const optionalFilter = ast.args.length > 1 && ["average", "sum", "averagewhenpresent"].includes(normalizedName)
      ? evaluateFormulaAst(ast.args[1], options)
      : ast.args.length > 2 && normalizedName === "averageoverattempts"
        ? evaluateFormulaAst(ast.args[2], options)
        : null;
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
    if (normalizedName === "average") {
      return averageSeriesValues(evaluateFormulaAst(ast.args[0], options), averageMatchValues, recentEntryCount, optionalFilter);
    }
    if (normalizedName === "sum") {
      return sumSeriesValues(evaluateFormulaAst(ast.args[0], options), recentEntryCount, optionalFilter);
    }
    if (normalizedName === "averagewhenpresent") {
      return averageSeriesValues(evaluateFormulaAst(ast.args[0], options), averageWhenPresentValues, recentEntryCount, optionalFilter);
    }
    if (normalizedName === "averageoverattempts") {
      return averageOverAttemptValues(
        evaluateFormulaAst(ast.args[0], options),
        evaluateFormulaAst(ast.args[1], options),
        recentEntryCount,
        optionalFilter,
      );
    }
    return errorResult(`Unknown function "${normalizedName}".`);
  }
  return errorResult("Unsupported formula node.");
}

function evaluateFormulaExpression(source, options = {}) {
  const parsed = parseFormulaExpression(source);
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
  isScalarResult,
  isSeriesResult,
  metricTrendValues,
  normalizeAllianceFieldShares,
  parseFormulaExpression,
  scoutingFlagsForTeam,
  scalarResult,
  seriesResult,
  sliceRecentMatches,
  standardDeviation,
  summarizeScoutingWindow,
  teamMetricValue,
};
})();
