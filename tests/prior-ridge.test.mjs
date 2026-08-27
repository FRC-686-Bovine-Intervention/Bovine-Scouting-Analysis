import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function loadBrowserContext(relativePaths, extras = {}) {
  const context = {
    globalThis: {},
    console,
    Math,
    Number,
    Array,
    Object,
    String,
    JSON,
    Map,
    Set,
    ...extras,
  };
  context.globalThis = context;
  relativePaths.forEach((relativePath) => {
    const sourcePath = path.resolve(relativePath);
    const source = fs.readFileSync(sourcePath, "utf8");
    vm.runInNewContext(source, context, { filename: sourcePath });
  });
  return context;
}

function assertClose(actual, expected, tolerance, message) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, got ${actual}`);
}

function loadJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), "utf8"));
}

function bruteForcePriorRidgeMse(design, response, priors, lambda) {
  function invertMatrix(matrix) {
    const size = matrix.length;
    const identity = Array.from({ length: size }, (_, rowIndex) =>
      Array.from({ length: size }, (_, columnIndex) => (rowIndex === columnIndex ? 1 : 0)),
    );
    const augmented = matrix.map((row, rowIndex) => row.slice().concat(identity[rowIndex]));
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

  function fitCoefficients(trainDesign, trainResponse) {
    const width = trainDesign[0].length;
    const centered = trainResponse.map((value, rowIndex) => value - trainDesign[rowIndex].reduce((sum, indicator, columnIndex) => sum + indicator * priors[columnIndex], 0));
    const xtx = Array.from({ length: width }, () => Array(width).fill(0));
    const xtz = Array(width).fill(0);
    trainDesign.forEach((row, rowIndex) => {
      for (let columnIndex = 0; columnIndex < width; columnIndex += 1) {
        if (!row[columnIndex]) continue;
        xtz[columnIndex] += centered[rowIndex];
        for (let otherColumnIndex = 0; otherColumnIndex < width; otherColumnIndex += 1) {
          xtx[columnIndex][otherColumnIndex] += row[otherColumnIndex];
        }
      }
    });
    for (let diagonalIndex = 0; diagonalIndex < width; diagonalIndex += 1) {
      xtx[diagonalIndex][diagonalIndex] += lambda;
    }
    const inverse = invertMatrix(xtx);
    const theta = inverse.map((row) => row.reduce((sum, value, index) => sum + value * xtz[index], 0));
    return priors.map((prior, index) => prior + theta[index]);
  }

  let mseSum = 0;
  for (let rowIndex = 0; rowIndex < response.length; rowIndex += 1) {
    const trainDesign = design.filter((_, candidateIndex) => candidateIndex !== rowIndex);
    const trainResponse = response.filter((_, candidateIndex) => candidateIndex !== rowIndex);
    const coefficients = fitCoefficients(trainDesign, trainResponse);
    const prediction = design[rowIndex].reduce((sum, indicator, columnIndex) => sum + indicator * coefficients[columnIndex], 0);
    const residual = prediction - response[rowIndex];
    mseSum += residual * residual;
  }
  return mseSum / response.length;
}

runTest("buildPriorRidgeInput preserves scoutR-style blue-then-red row order and Statbotics start priors", () => {
  const context = loadBrowserContext(["src/prior-ridge.js"]);
  const input = context.PriorRidge.buildPriorRidgeInput(
    [
      {
        comp_level: "qm",
        alliances: {
          blue: { team_keys: ["frc3", "frc2", "frc1"], score: 15 },
          red: { team_keys: ["frc4", "frc5", "frc6"], score: 21 },
        },
      },
    ],
    [
      { team: 1, epa: { stats: { start: 10 } } },
      { team: 2, epa: { stats: { start: 11 } } },
      { team: 3, epa: { stats: { start: 12 } } },
      { team: 4, epa: { stats: { start: 13 } } },
      { team: 5, epa: { stats: { start: 14 } } },
      { team: 6, epa: { stats: { start: 15 } } },
    ],
  );

  assert.deepEqual(Array.from(input.teamNumbers), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(Array.from(input.priors), [10, 11, 12, 13, 14, 15]);
  assert.deepEqual(Array.from(input.response), [15, 21]);
  assert.deepEqual(Array.from(input.design[0]), [1, 1, 1, 0, 0, 0]);
  assert.deepEqual(Array.from(input.design[1]), [0, 0, 0, 1, 1, 1]);
});

runTest("fitPriorRidge matches brute-force leave-one-out lambda selection on a small event", () => {
  const context = loadBrowserContext(["src/prior-ridge.js"]);
  const input = context.PriorRidge.buildPriorRidgeInput(
    [
      {
        comp_level: "qm",
        alliances: {
          blue: { team_keys: ["frc1", "frc2", "frc3"], score: 27 },
          red: { team_keys: ["frc4", "frc5", "frc6"], score: 18 },
        },
      },
      {
        comp_level: "qm",
        alliances: {
          blue: { team_keys: ["frc1", "frc4", "frc5"], score: 23 },
          red: { team_keys: ["frc2", "frc3", "frc6"], score: 20 },
        },
      },
      {
        comp_level: "qm",
        alliances: {
          blue: { team_keys: ["frc1", "frc5", "frc6"], score: 26 },
          red: { team_keys: ["frc2", "frc3", "frc4"], score: 19 },
        },
      },
      {
        comp_level: "qm",
        alliances: {
          blue: { team_keys: ["frc1", "frc2", "frc6"], score: 24 },
          red: { team_keys: ["frc3", "frc4", "frc5"], score: 21 },
        },
      },
    ],
    [
      { team: 1, epa: { stats: { start: 9 } } },
      { team: 2, epa: { stats: { start: 7 } } },
      { team: 3, epa: { stats: { start: 6 } } },
      { team: 4, epa: { stats: { start: 5 } } },
      { team: 5, epa: { stats: { start: 4 } } },
      { team: 6, epa: { stats: { start: 3 } } },
    ],
  );

  const lambdaGrid = [0.01, 0.1, 1, 5, 20];
  const fit = context.PriorRidge.fitPriorRidge(input.design, input.response, input.priors, { lambdaGrid });
  const bruteForceMses = lambdaGrid.map((lambda) => bruteForcePriorRidgeMse(input.design, input.response, input.priors, lambda));
  const expectedLambda = lambdaGrid[bruteForceMses.indexOf(Math.min(...bruteForceMses))];

  assert.equal(fit.lambda, expectedLambda);
  assert.ok(fit.mse > 0);
  assert.equal(fit.coefficients.length, input.teamNumbers.length);
});

runTest("computeEventPridge produces stable totals for the cached 2026chcmp event snapshot", () => {
  const context = loadBrowserContext(["src/prior-ridge.js"]);
  const matches = loadJson("src/real-source-cache/2026chcmp-tba-matches.json");
  const teamEvents = loadJson("src/real-source-cache/2026chcmp-statbotics-team-events.json");
  const result = context.PriorRidge.computeEventPridge(matches, teamEvents);
  const top = Object.entries(result.ratings).sort((left, right) => right[1] - left[1]).slice(0, 5);

  assert.equal(result.allianceRowCount, 216);
  assert.equal(result.matchCount, 108);
  assert.equal(Number(result.lambda.toFixed(6)), 4.650493);
  assert.deepEqual(top, [
    ["449", 204],
    ["2106", 197.4],
    ["11415", 164.6],
    ["9072", 162.3],
    ["836", 157.5],
  ]);
});

runTest("computeEventPridgeBatch matches independent fits for compatible response coverage", () => {
  const context = loadBrowserContext(["src/prior-ridge.js"]);
  const matches = loadJson("src/real-source-cache/2026chcmp-tba-matches.json");
  const teamEvents = loadJson("src/real-source-cache/2026chcmp-statbotics-team-events.json");
  const componentMatches = matches.map((match) => ({
    ...match,
    alliances: {
      ...match.alliances,
      red: { ...match.alliances.red, score: Number(match.alliances.red.score) + 1 },
      blue: { ...match.alliances.blue, score: Number(match.alliances.blue.score) + 2 },
    },
  }));
  const batch = context.PriorRidge.computeEventPridgeBatch([
    { id: "total", matches },
    { id: "component", matches: componentMatches },
  ], teamEvents);
  assert.deepEqual(batch.total.ratings, context.PriorRidge.computeEventPridge(matches, teamEvents).ratings);
  assert.deepEqual(batch.component.ratings, context.PriorRidge.computeEventPridge(componentMatches, teamEvents).ratings);
});

runTest("computeEventPridgeBatch safely separates response coverage groups", () => {
  const context = loadBrowserContext(["src/prior-ridge.js"]);
  const matches = loadJson("src/real-source-cache/2026chcmp-tba-matches.json");
  const teamEvents = loadJson("src/real-source-cache/2026chcmp-statbotics-team-events.json");
  const partialMatches = matches.filter((match) => match.comp_level === "qm").slice(0, -1);
  const batch = context.PriorRidge.computeEventPridgeBatch([
    { id: "complete", matches },
    { id: "partial", matches: partialMatches },
  ], teamEvents);
  assert.equal(batch.complete.matchCount, 108);
  assert.equal(batch.partial.matchCount, 107);
  assert.notEqual(batch.complete.mse, batch.partial.mse);
  assert.equal(batch.__diagnostics.length > 0, true);
});

runTest("computeEventPridgeTrend computes each completed prefix once and reuses it", () => {
  const context = loadBrowserContext(["src/prior-ridge.js"]);
  const matches = loadJson("src/real-source-cache/2026chcmp-tba-matches.json").filter((match) => match.comp_level === "qm");
  const teamEvents = loadJson("src/real-source-cache/2026chcmp-statbotics-team-events.json");
  const completed = matches.slice(0, 4);
  const unplayed = matches.slice(4, 14).map((match) => ({
    ...match,
    alliances: {
      ...match.alliances,
      red: { ...match.alliances.red, score: -1 },
      blue: { ...match.alliances.blue, score: -1 },
    },
  }));
  const scheduledMatches = [...completed, ...unplayed];
  const first = context.PriorRidge.computeEventPridgeTrend(scheduledMatches, teamEvents);
  const second = context.PriorRidge.computeEventPridgeTrend(scheduledMatches, teamEvents);

  assert.equal(first.profiling.scheduleQualificationCount, 14);
  assert.equal(first.profiling.completedQualificationCount, 4);
  assert.equal(first.profiling.trendFitCount, 4);
  assert.equal(first.profiling.trendCacheHits, 0);
  const firstTeamNumber = first.entriesByTeam.keys().next().value;
  assert.equal(first.entriesByTeam.get(firstTeamNumber).length, 4);
  assert.equal(second.profiling.trendFitCount, 0);
  assert.equal(second.profiling.trendCacheHits, 4);
  assert.deepEqual(second.entriesByTeam.get(firstTeamNumber), first.entriesByTeam.get(firstTeamNumber));
});

[
  {
    eventKey: "2024mdsev",
    matchesPath: "tests/fixtures/prior-ridge/2024mdsev-tba-matches.json",
    teamEventsPath: "tests/fixtures/prior-ridge/2024mdsev-team-events.json",
    expectedMatchCount: 72,
    expectedAllianceRowCount: 144,
    expectedLambda: 4.14414414414414,
    lambdaTolerance: 0.2,
    expectedMse: 174.056856500531,
    mseTolerance: 0.05,
  },
  {
    eventKey: "2024txfor",
    matchesPath: "tests/fixtures/prior-ridge/2024txfor-tba-matches.json",
    teamEventsPath: "tests/fixtures/prior-ridge/2024txfor-team-events.json",
    expectedLambda: 6.26626626626627,
    lambdaTolerance: 0.2,
    expectedMse: 224.850434585234,
    mseTolerance: 0.05,
  },
  {
    eventKey: "2025mdsev",
    matchesPath: "tests/fixtures/prior-ridge/2025mdsev-tba-matches.json",
    teamEventsPath: "tests/fixtures/prior-ridge/2025mdsev-team-events.json",
    expectedLambda: 4.64464464464464,
    lambdaTolerance: 0.2,
    expectedMse: 479.895516410544,
    mseTolerance: 0.05,
  },
].forEach(({ eventKey, matchesPath, teamEventsPath, expectedMatchCount, expectedAllianceRowCount, expectedLambda, lambdaTolerance, expectedMse, mseTolerance }) => {
  runTest(`computeEventPridge stays aligned with Blair's ${eventKey} CSV vector`, () => {
    const context = loadBrowserContext(["src/prior-ridge.js"]);
    const matches = loadJson(matchesPath);
    const teamEvents = loadJson(teamEventsPath);
    const input = context.PriorRidge.buildPriorRidgeInput(matches, teamEvents);
    const result = context.PriorRidge.computeEventPridge(matches, teamEvents);

    if (expectedMatchCount !== undefined) {
      assert.equal(input.matches.length, expectedMatchCount);
    } else {
      assert.ok(input.matches.length > 0, "Blair vector fixture should contain qualification matches");
    }
    assert.equal(input.teamNumbers.includes(0), false);
    if (expectedMatchCount !== undefined) {
      assert.equal(result.matchCount, expectedMatchCount);
    } else {
      assert.ok(result.matchCount > 0, "Blair vector result should contain qualification matches");
    }
    if (expectedAllianceRowCount !== undefined) {
      assert.equal(result.allianceRowCount, expectedAllianceRowCount);
    } else {
      assert.equal(result.allianceRowCount, result.matchCount * 2);
    }
    assertClose(result.lambda, expectedLambda, lambdaTolerance, "lambda should stay close to Blair CSV lambda_opt");
    assertClose(result.mse, expectedMse, mseTolerance, "LOOCV MSE should stay close to Blair CSV pridge_mse");
  });
});
