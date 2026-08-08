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

function readPathValue(value, path) {
  return String(path || "")
    .split(".")
    .filter(Boolean)
    .reduce((current, segment) => current?.[segment], value);
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
  const requestedResponseName = String(options.responseName || "score").trim();
  const responseName = requestedResponseName.toLowerCase() === "score" ? "score" : requestedResponseName;
  const qualificationMatches = (Array.isArray(matches) ? matches : [])
    .filter((match) => match?.comp_level === "qm")
    .map((match) => {
      const red = Array.isArray(match?.alliances?.red?.team_keys) ? match.alliances.red.team_keys : [];
      const blue = Array.isArray(match?.alliances?.blue?.team_keys) ? match.alliances.blue.team_keys : [];
      const redScore = responseName === "score"
        ? finiteNumber(match?.alliances?.red?.score)
        : finiteNumber(readPathValue(match?.score_breakdown?.red, responseName));
      const blueScore = responseName === "score"
        ? finiteNumber(match?.alliances?.blue?.score)
        : finiteNumber(readPathValue(match?.score_breakdown?.blue, responseName));
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

function fitPriorRidge(design, response, priors, options = {}) {
  const lambdaGrid = Array.isArray(options.lambdaGrid) && options.lambdaGrid.length
    ? options.lambdaGrid.slice()
    : defaultLambdaGrid();

  if (!Array.isArray(design) || !design.length) throw new Error("Prior ridge requires at least one alliance row.");
  const columnCount = design[0].length;
  if (!columnCount) throw new Error("Prior ridge requires at least one team column.");
  if (!Array.isArray(response) || response.length !== design.length) throw new Error("Prior ridge response length must match design rows.");
  if (!Array.isArray(priors) || priors.length !== columnCount) throw new Error("Prior ridge priors must match design columns.");

  const centeredResponse = response.map((value, rowIndex) => {
    const baseline = design[rowIndex].reduce((sum, indicator, columnIndex) => sum + indicator * priors[columnIndex], 0);
    return value - baseline;
  });

  const xtx = Array.from({ length: columnCount }, () => Array(columnCount).fill(0));
  const xtz = Array(columnCount).fill(0);
  design.forEach((row, rowIndex) => {
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      const rowValue = row[columnIndex];
      if (!rowValue) continue;
      xtz[columnIndex] += rowValue * centeredResponse[rowIndex];
      for (let otherColumnIndex = 0; otherColumnIndex < columnCount; otherColumnIndex += 1) {
        xtx[columnIndex][otherColumnIndex] += rowValue * row[otherColumnIndex];
      }
    }
  });

  let bestModel = null;
  lambdaGrid.forEach((lambdaValue) => {
    const lambda = finiteNumber(lambdaValue);
    if (lambda === null || lambda < 0) return;
    const penalized = cloneMatrix(xtx);
    for (let diagonalIndex = 0; diagonalIndex < columnCount; diagonalIndex += 1) {
      penalized[diagonalIndex][diagonalIndex] += lambda;
    }
    const inverse = invertMatrix(penalized);
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
          if (!row[otherColumnIndex]) continue;
          leverage += inverse[columnIndex][otherColumnIndex];
        }
      }
      const denominator = Math.max(1e-9, 1 - leverage);
      const looResidual = (response[rowIndex] - prediction) / denominator;
      mseSum += looResidual * looResidual;
    }

    const mse = mseSum / design.length;
    if (!bestModel || mse < bestModel.mse) {
      bestModel = {
        lambda,
        mse,
        coefficients,
      };
    }
  });

  if (!bestModel) throw new Error("Prior ridge could not select a lambda.");
  return bestModel;
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

globalThis.PriorRidge = {
  defaultLambdaGrid,
  buildPriorRidgeInput,
  fitPriorRidge,
  computeEventPridge,
};
})();
