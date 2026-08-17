(function () {
function finiteNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function round(value, digits = 1) {
  const numeric = finiteNumber(value);
  return numeric === null ? null : Number(numeric.toFixed(digits));
}

function defaultLambdaGrid(length = 100, min = 0.01, max = 20) {
  if (!Number.isFinite(length) || length <= 1) return [min];
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  return Array.from({ length }, (_, index) => {
    const ratio = index / (length - 1);
    return Math.exp(logMin + (logMax - logMin) * ratio);
  });
}

function identityMatrix(size) {
  return Array.from({ length: size }, (_, rowIndex) =>
    Array.from({ length: size }, (_, columnIndex) => (rowIndex === columnIndex ? 1 : 0)),
  );
}

function cloneMatrix(matrix) {
  return matrix.map((row) => row.slice());
}

function invertMatrix(matrix) {
  const size = matrix.length;
  if (!size) return [];
  const augmented = matrix.map((row, rowIndex) => row.slice().concat(identityMatrix(size)[rowIndex]));

  for (let pivotIndex = 0; pivotIndex < size; pivotIndex += 1) {
    let maxRowIndex = pivotIndex;
    let maxAbs = Math.abs(augmented[pivotIndex][pivotIndex]);
    for (let rowIndex = pivotIndex + 1; rowIndex < size; rowIndex += 1) {
      const candidateAbs = Math.abs(augmented[rowIndex][pivotIndex]);
      if (candidateAbs > maxAbs) {
        maxAbs = candidateAbs;
        maxRowIndex = rowIndex;
      }
    }
    if (maxAbs <= 1e-12) throw new Error("Prior ridge matrix is singular.");
    if (maxRowIndex !== pivotIndex) {
      const temp = augmented[pivotIndex];
      augmented[pivotIndex] = augmented[maxRowIndex];
      augmented[maxRowIndex] = temp;
    }

    const pivot = augmented[pivotIndex][pivotIndex];
    for (let columnIndex = 0; columnIndex < augmented[pivotIndex].length; columnIndex += 1) {
      augmented[pivotIndex][columnIndex] /= pivot;
    }

    for (let rowIndex = 0; rowIndex < size; rowIndex += 1) {
      if (rowIndex === pivotIndex) continue;
      const factor = augmented[rowIndex][pivotIndex];
      if (!factor) continue;
      for (let columnIndex = 0; columnIndex < augmented[rowIndex].length; columnIndex += 1) {
        augmented[rowIndex][columnIndex] -= factor * augmented[pivotIndex][columnIndex];
      }
    }
  }

  return augmented.map((row) => row.slice(size));
}

function multiplyMatrixVector(matrix, vector) {
  return matrix.map((row) => row.reduce((sum, value, index) => sum + value * vector[index], 0));
}

function buildPriorRidgeInput(matches, teamEvents, options = {}) {
  const responseName = String(options.responseName || "score").trim().toLowerCase();
  const qualificationMatches = (Array.isArray(matches) ? matches : [])
    .filter((match) => match?.comp_level === "qm")
    .map((match) => {
      const red = Array.isArray(match?.alliances?.red?.team_keys) ? match.alliances.red.team_keys : [];
      const blue = Array.isArray(match?.alliances?.blue?.team_keys) ? match.alliances.blue.team_keys : [];
      const redScore = responseName === "score"
        ? finiteNumber(match?.alliances?.red?.score)
        : finiteNumber(match?.score_breakdown?.red?.[responseName]);
      const blueScore = responseName === "score"
        ? finiteNumber(match?.alliances?.blue?.score)
        : finiteNumber(match?.score_breakdown?.blue?.[responseName]);
      return {
        red: red
          .map((teamKey) => Number(String(teamKey).replace("frc", "")))
          .filter((teamNumber) => Number.isFinite(teamNumber) && teamNumber > 0),
        blue: blue
          .map((teamKey) => Number(String(teamKey).replace("frc", "")))
          .filter((teamNumber) => Number.isFinite(teamNumber) && teamNumber > 0),
        redScore,
        blueScore,
      };
    })
    .filter((match) => match.red.length === 3 && match.blue.length === 3)
    .filter((match) => match.redScore !== null && match.blueScore !== null)
    .filter((match) => match.redScore >= 0 && match.blueScore >= 0);

  const teamNumbers = Array.from(
    new Set(
      qualificationMatches.flatMap((match) => match.blue.concat(match.red)),
    ),
  ).sort((left, right) => left - right);

  if (!teamNumbers.length || !qualificationMatches.length) {
    return {
      matches: qualificationMatches,
      teamNumbers,
      priors: [],
      design: [],
      response: [],
    };
  }

  const priorByTeam = new Map(
    (Array.isArray(teamEvents) ? teamEvents : [])
      .map((teamEvent) => [Number(teamEvent?.team), finiteNumber(teamEvent?.epa?.stats?.start)])
      .filter((entry) => Number.isFinite(entry[0]) && entry[1] !== null),
  );

  const priors = teamNumbers.map((teamNumber) => finiteNumber(priorByTeam.get(teamNumber)));
  if (priors.some((value) => value === null)) {
    throw new Error("Prior ridge requires Statbotics start EPA priors for every event team.");
  }

  const teamIndexByNumber = new Map(teamNumbers.map((teamNumber, index) => [teamNumber, index]));
  const design = [];
  const response = [];

  qualificationMatches.forEach((match) => {
    const blueRow = Array(teamNumbers.length).fill(0);
    const redRow = Array(teamNumbers.length).fill(0);
    match.blue.forEach((teamNumber) => {
      blueRow[teamIndexByNumber.get(teamNumber)] = 1;
    });
    match.red.forEach((teamNumber) => {
      redRow[teamIndexByNumber.get(teamNumber)] = 1;
    });
    design.push(blueRow, redRow);
    response.push(match.blueScore, match.redScore);
  });

  return {
    matches: qualificationMatches,
    teamNumbers,
    priors,
    design,
    response,
  };
}

function fitPriorRidgeBatch(design, responses, priors, options = {}) {
  const lambdaGrid = Array.isArray(options.lambdaGrid) && options.lambdaGrid.length
    ? options.lambdaGrid.slice()
    : defaultLambdaGrid();

  if (!Array.isArray(design) || !design.length) throw new Error("Prior ridge requires at least one alliance row.");
  const columnCount = design[0].length;
  if (!columnCount) throw new Error("Prior ridge requires at least one team column.");
  if (!Array.isArray(responses) || !responses.length || responses.some((response) => !Array.isArray(response) || response.length !== design.length)) {
    throw new Error("Prior ridge response lengths must match design rows.");
  }
  if (!Array.isArray(priors) || priors.length !== columnCount) throw new Error("Prior ridge priors must match design columns.");

  const centeredResponses = responses.map((response) => response.map((value, rowIndex) => {
    const baseline = design[rowIndex].reduce((sum, indicator, columnIndex) => sum + indicator * priors[columnIndex], 0);
    return value - baseline;
  }));

  const xtx = Array.from({ length: columnCount }, () => Array(columnCount).fill(0));
  design.forEach((row, rowIndex) => {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const rowValue = row[columnIndex];
      if (!rowValue) continue;
      for (let otherColumnIndex = 0; otherColumnIndex < columnCount; otherColumnIndex += 1) {
        xtx[columnIndex][otherColumnIndex] += rowValue * row[otherColumnIndex];
      }
    }
  });

  const bestModels = responses.map(() => null);
  lambdaGrid.forEach((lambdaValue) => {
    const lambda = finiteNumber(lambdaValue);
    if (lambda === null || lambda < 0) return;
    const penalized = cloneMatrix(xtx);
    for (let diagonalIndex = 0; diagonalIndex < columnCount; diagonalIndex += 1) {
      penalized[diagonalIndex][diagonalIndex] += lambda;
    }
    const inverse = invertMatrix(penalized);
    responses.forEach((response, responseIndex) => {
      const xtz = Array(columnCount).fill(0);
      design.forEach((row, rowIndex) => {
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
          if (row[columnIndex]) xtz[columnIndex] += row[columnIndex] * centeredResponses[responseIndex][rowIndex];
        }
      });
      const theta = multiplyMatrixVector(inverse, xtz);
      const coefficients = priors.map((prior, index) => prior + theta[index]);
      let mseSum = 0;
      for (let rowIndex = 0; rowIndex < design.length; rowIndex += 1) {
        const row = design[rowIndex];
        const prediction = row.reduce((sum, indicator, columnIndex) => sum + indicator * coefficients[columnIndex], 0);
        let leverage = 0;
        for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
          if (!row[columnIndex]) continue;
          for (let otherColumnIndex = 0; otherColumnIndex < columnCount; otherColumnIndex += 1) {
            if (row[otherColumnIndex]) leverage += inverse[columnIndex][otherColumnIndex];
          }
        }
        const denominator = Math.max(1e-9, 1 - leverage);
        const looResidual = (response[rowIndex] - prediction) / denominator;
        mseSum += looResidual * looResidual;
      }
      const mse = mseSum / design.length;
      if (!bestModels[responseIndex] || mse < bestModels[responseIndex].mse) {
        bestModels[responseIndex] = { lambda, mse, coefficients };
      }
    });
  });

  if (bestModels.some((model) => !model)) throw new Error("Prior ridge could not select a lambda.");
  return bestModels;
}

function fitPriorRidge(design, response, priors, options = {}) {
  return fitPriorRidgeBatch(design, [response], priors, options)[0];
}

function computeEventPridge(matches, teamEvents, options = {}) {
  const input = buildPriorRidgeInput(matches, teamEvents, options);
  const fit = fitPriorRidge(input.design, input.response, input.priors, options);
  return {
    teamNumbers: input.teamNumbers,
    lambda: fit.lambda,
    mse: fit.mse,
    ratings: Object.fromEntries(
      input.teamNumbers.map((teamNumber, index) => [teamNumber, round(fit.coefficients[index], options.digits ?? 1)]),
    ),
    matchCount: input.matches.length,
    allianceRowCount: input.design.length,
  };
}

const trendCache = new Map();
const TREND_CACHE_LIMIT = 256;

function trendCacheKey(matches, teamEvents, options = {}) {
  const responseName = String(options.responseName || "score").trim().toLowerCase();
  const lambdaGrid = Array.isArray(options.lambdaGrid) ? options.lambdaGrid : defaultLambdaGrid();
  const matchFingerprint = (Array.isArray(matches) ? matches : []).map((match) => ({
    key: match?.key || "",
    number: match?.match_number ?? "",
    red: match?.alliances?.red?.team_keys || [],
    blue: match?.alliances?.blue?.team_keys || [],
    redScore: match?.alliances?.red?.score ?? null,
    blueScore: match?.alliances?.blue?.score ?? null,
    redBreakdown: match?.score_breakdown?.red || null,
    blueBreakdown: match?.score_breakdown?.blue || null,
  }));
  const priors = (Array.isArray(teamEvents) ? teamEvents : [])
    .map((teamEvent) => [Number(teamEvent?.team), finiteNumber(teamEvent?.epa?.stats?.start)])
    .filter(([team, prior]) => Number.isFinite(team) && prior !== null)
    .sort(([left], [right]) => left - right);
  return JSON.stringify({ responseName, lambdaGrid, digits: options.digits ?? 1, matches: matchFingerprint, priors });
}

function cacheTrendResult(key, result) {
  trendCache.set(key, result);
  if (trendCache.size > TREND_CACHE_LIMIT) trendCache.delete(trendCache.keys().next().value);
  return result;
}

function computeEventPridgeTrend(matches, teamEvents, options = {}) {
  const qualificationMatches = (Array.isArray(matches) ? matches : [])
    .filter((match) => match?.comp_level === "qm")
    .sort((left, right) => Number(left?.match_number || 0) - Number(right?.match_number || 0));
  const entriesByTeam = new Map();
  let completedMatchCount = 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let previousMatches = [];

  qualificationMatches.forEach((match) => {
    let input;
    try {
      input = buildPriorRidgeInput([...previousMatches, match], teamEvents, options);
    } catch {
      return;
    }
    if (!input.design.length || input.matches.length <= previousMatches.length) return;
    previousMatches = [...previousMatches, match];
    completedMatchCount = input.matches.length;
    const key = trendCacheKey(previousMatches, teamEvents, options);
    let result = trendCache.get(key);
    if (result) {
      cacheHits += 1;
    } else {
      try {
        result = computeEventPridge(previousMatches, teamEvents, options);
        cacheMisses += 1;
        cacheTrendResult(key, result);
      } catch {
        cacheMisses += 1;
        return;
      }
    }
    Object.entries(result.ratings || {}).forEach(([teamNumber, value]) => {
      if (!Number.isFinite(Number(value))) return;
      if (!entriesByTeam.has(Number(teamNumber))) entriesByTeam.set(Number(teamNumber), []);
      entriesByTeam.get(Number(teamNumber)).push({ key: Number(match.match_number), value: Number(value) });
    });
  });

  return {
    entriesByTeam,
    profiling: {
      scheduleQualificationCount: qualificationMatches.length,
      completedQualificationCount: completedMatchCount,
      trendFitCount: cacheMisses,
      trendCacheHits: cacheHits,
      trendCacheMisses: cacheMisses,
    },
  };
}

function computeEventPridgeBatch(responseSets, teamEvents, options = {}) {
  const inputs = (Array.isArray(responseSets) ? responseSets : [])
    .map((entry) => ({ id: entry?.id, input: buildPriorRidgeInput(entry?.matches, teamEvents, options) }))
    .filter((entry) => entry.id && entry.input.design.length);
  const groups = new Map();
  const diagnostics = [];
  inputs.forEach((entry) => {
    const key = JSON.stringify({ teamNumbers: entry.input.teamNumbers, priors: entry.input.priors, design: entry.input.design });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  const results = {};
  groups.forEach((group) => {
    if (group.length < inputs.filter((entry) => entry.input.teamNumbers.join(",") === group[0].input.teamNumbers.join(",")).length) {
      diagnostics.push({ kind: "coverage-group", responseIds: group.map((entry) => entry.id), matchCount: group[0].input.matches.length });
    }
    try {
      const fits = fitPriorRidgeBatch(group[0].input.design, group.map((entry) => entry.input.response), group[0].input.priors, options);
      group.forEach((entry, index) => {
        const fit = fits[index];
        results[entry.id] = {
          teamNumbers: entry.input.teamNumbers,
          lambda: fit.lambda,
          mse: fit.mse,
          ratings: Object.fromEntries(entry.input.teamNumbers.map((teamNumber, teamIndex) => [teamNumber, round(fit.coefficients[teamIndex], options.digits ?? 1)])),
          matchCount: entry.input.matches.length,
          allianceRowCount: entry.input.design.length,
        };
      });
    } catch {
      // Incomplete inputs remain unavailable without invalidating other coverage groups.
    }
  });
  Object.defineProperty(results, "__diagnostics", { value: diagnostics.slice(0, 10), enumerable: false });
  return results;
}

globalThis.PriorRidge = {
  defaultLambdaGrid,
  buildPriorRidgeInput,
  fitPriorRidge,
  fitPriorRidgeBatch,
  computeEventPridge,
  computeEventPridgeTrend,
  computeEventPridgeBatch,
};
})();
