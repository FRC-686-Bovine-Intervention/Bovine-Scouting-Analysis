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
  return (submissions || [])
    .filter((submission) => usableSubmission(submission, { includeFlagged: Boolean(options.includeFlagged) }))
    .map((submission, index) => {
      const components = Object.fromEntries(
        scouterMetricIds.map((componentId) => {
          const value = submission.rawMetrics?.[componentId];
          return [componentId, Number.isFinite(Number(value)) ? Number(value) : 0];
        }),
      );
      return {
        matchNumber: Number(submission.matchNumber),
        submissions: [submission],
        total: roundValue(scoringComponentIds.reduce((sum, componentId) => sum + Number(components[componentId] || 0), 0)),
        components,
        order: index,
      };
    })
    .sort((left, right) => left.matchNumber - right.matchNumber || left.order - right.order)
    .map(({ order, ...entry }) => entry);
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
  evaluateDerivedMetricDefinition,
  metricTrendValues,
  scoutingFlagsForTeam,
  sliceRecentMatches,
  standardDeviation,
  summarizeScoutingWindow,
  teamMetricValue,
};
})();
