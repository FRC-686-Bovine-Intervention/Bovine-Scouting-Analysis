(function attachAllianceCaptainState(global) {
  function deriveAllianceCaptainState(rankedTeamIds, options = {}) {
    const rankings = Array.from(new Set(Array.isArray(rankedTeamIds) ? rankedTeamIds : []));
    const accepted = new Set(options.acceptedTeamIds || []);
    for (const teamId of options.placedTeamIds || []) accepted.add(teamId);
    const eligible = rankings.filter((teamId) => !accepted.has(teamId));
    const leadCount = Number.isFinite(Number(options.leadCount))
      ? Math.max(0, Number(options.leadCount))
      : 8;
    const possibleCount = Number.isFinite(Number(options.possibleCount))
      ? Math.max(0, Number(options.possibleCount))
      : Math.max(0, 7 - Math.max(0, Number(options.completedFirstRoundPicks) || 0));
    const confirmed = eligible.slice(0, leadCount);
    const confirmedSet = new Set(confirmed);
    const possible = eligible.filter((teamId) => !confirmedSet.has(teamId)).slice(0, possibleCount);
    return { confirmed, possible };
  }

  function completedFirstRoundPickCount(allianceBoard) {
    return (Array.isArray(allianceBoard) ? allianceBoard : [])
      .filter((teamId, index) => index % 3 === 1 && teamId !== null && teamId !== undefined && teamId !== "")
      .length;
  }

  function emptyCaptainSlotCount(allianceBoard) {
    return (Array.isArray(allianceBoard) ? allianceBoard : [])
      .filter((teamId, index) => index % 3 === 0 && (teamId === null || teamId === undefined || teamId === ""))
      .length;
  }

  function deriveAllianceCaptainStateForBoard(rankedTeamIds, allianceBoard, options = {}) {
    return deriveAllianceCaptainState(rankedTeamIds, {
      ...options,
      leadCount: emptyCaptainSlotCount(allianceBoard),
      completedFirstRoundPicks: completedFirstRoundPickCount(allianceBoard),
    });
  }

  global.allianceCaptainState = Object.freeze({
    deriveAllianceCaptainState,
    deriveAllianceCaptainStateForBoard,
    completedFirstRoundPickCount,
    emptyCaptainSlotCount,
  });
})(globalThis);
