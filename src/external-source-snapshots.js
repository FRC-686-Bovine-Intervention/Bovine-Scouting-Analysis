(function () {
function buildFingerprint(text) {
  const input = String(text || "");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}:${input.length}`;
}

function buildSnapshotFingerprint(value) {
  return buildFingerprint(typeof value === "string" ? value : JSON.stringify(value || null));
}

function buildExternalSourceSnapshot(sourceId, eventModel = {}) {
  const scoringComponentIds = (eventModel.scoringComponents || []).map((component) => component.id);
  if (sourceId === "tba") {
    return {
      eventKey: eventModel.key,
      teamNumbers: eventModel.teamNumbers || [],
      matches: (eventModel.matches || []).map((match) => ({
        number: match.number,
        key: match.key,
        red: match.red,
        blue: match.blue,
        redScore: match.redScore ?? null,
        blueScore: match.blueScore ?? null,
        winningAlliance: match.winningAlliance || "",
        scoreBreakdown: match.scoreBreakdown || null,
      })),
    };
  }
  if (sourceId === "statbotics") {
    return {
      eventKey: eventModel.key,
      teams: (eventModel.teams || []).map((team) => ({
        number: team.number,
        total: team.sources?.statbotics?.total,
        components: { ...(team.sources?.statbotics?.components || {}) },
        trend: team.sources?.statbotics?.trend || [],
      })),
    };
  }
  if (sourceId === "pridge") {
    return {
      eventKey: eventModel.key,
      scoringComponents: scoringComponentIds,
      teams: (eventModel.teams || []).map((team) => ({
        number: team.number,
        total: team.sources?.pridge?.total,
        components: Object.fromEntries(scoringComponentIds.map((componentId) => [componentId, team.sources?.pridge?.components?.[componentId] ?? null])),
        trend: team.sources?.pridge?.trend || [],
      })),
    };
  }
  return {
    eventKey: eventModel.key,
    sourceId,
  };
}

function seedExternalSourceFingerprints(workspace, eventModel = {}) {
  const currentSources = workspace?.sources || {};
  const nextSources = { ...currentSources };
  let changed = false;
  ["tba", "statbotics", "pridge"].forEach((sourceId) => {
    const source = currentSources[sourceId];
    if (!source || String(source.sourceFingerprint || "").trim()) return;
    nextSources[sourceId] = {
      ...source,
      sourceFingerprint: buildSnapshotFingerprint(buildExternalSourceSnapshot(sourceId, eventModel)),
    };
    changed = true;
  });
  if (!changed) return workspace;
  return {
    ...workspace,
    sources: nextSources,
  };
}

globalThis.ExternalSourceSnapshots = {
  buildSnapshotFingerprint,
  buildExternalSourceSnapshot,
  seedExternalSourceFingerprints,
};
})();
