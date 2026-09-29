(function attachMobileAllianceDisplay(global) {
  const MAX_COLUMNS = 24;
  const MAX_TEAMS = 300;
  const MAX_LABEL_LENGTH = 120;

  function cleanText(value, limit = MAX_LABEL_LENGTH) {
    return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, limit);
  }

  function normalizeTeamNumber(value) {
    const candidate = value && typeof value === "object"
      ? value.teamNumber ?? value.number ?? value.team ?? value.team_key ?? value.key ?? value.id ?? ""
      : value;
    return cleanText(candidate, 12).replace(/^frc(?=\d+$)/i, "");
  }

  function cleanScore(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 1000) / 1000 : null;
  }

  function buildMobileAllianceSnapshot(input = {}) {
    const eventKey = cleanText(input.eventKey, 64).toLowerCase();
    if (!/^[a-z0-9]{1,64}$/.test(eventKey)) throw new Error("A valid event key is required for the mobile alliance snapshot.");
    const board = (Array.isArray(input.board) ? input.board : []).slice(0, 24).map((slot, index) => ({
      slot: index,
      teamNumber: normalizeTeamNumber(slot?.teamNumber ?? slot),
      teamName: cleanText(slot?.teamName, 80),
      alliance: Math.floor(index / 3) + 1,
    }));
    while (board.length < 24) board.push({ slot: board.length, teamNumber: "", teamName: "", alliance: Math.floor(board.length / 3) + 1 });

    const rankings = (Array.isArray(input.rankings) ? input.rankings : []).slice(0, MAX_TEAMS).map((team, index) => ({
      rank: index + 1,
      teamNumber: normalizeTeamNumber(team?.teamNumber ?? team),
      state: ["picked", "confirmed", "possible"].includes(team?.state) ? team.state : "normal",
    })).filter((team) => team.teamNumber);
    const columns = (Array.isArray(input.columns) ? input.columns : []).slice(0, MAX_COLUMNS).map((column, columnIndex) => ({
      id: cleanText(column?.id, 64),
      label: cleanText(column?.label),
      teams: (Array.isArray(column?.teams) ? column.teams : []).slice(0, MAX_TEAMS).map((team, index) => {
        const row = {
          rank: index + 1,
          teamNumber: normalizeTeamNumber(team?.teamNumber ?? team),
          state: ["picked", "confirmed", "possible"].includes(team?.state) ? team.state : "normal",
        };
        const score = cleanScore(team?.score);
        if (score !== null) row.score = score;
        return row;
      }).filter((team) => team.teamNumber),
      order: columnIndex,
    })).filter((column) => column.id && column.label);

    return {
      version: 1,
      eventKey,
      eventName: cleanText(input.eventName),
      board,
      rankings,
      columns,
    };
  }

  function validateMobileAllianceSnapshot(snapshot) {
    const exactKeys = (value, keys) => value && typeof value === "object" && !Array.isArray(value)
      && Object.keys(value).length === keys.length && Object.keys(value).every((key) => keys.includes(key));
    const allowedSnapshotKeys = ["version", "eventKey", "eventName", "board", "rankings", "columns", "publishedAt"];
    const snapshotKeysValid = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot)
      && Object.keys(snapshot).length >= 6 && Object.keys(snapshot).length <= 7
      && Object.keys(snapshot).every((key) => allowedSnapshotKeys.includes(key));
    return Boolean(snapshotKeysValid && snapshot.version === 1
      && /^[a-z0-9]{1,64}$/.test(snapshot.eventKey || "")
      && typeof snapshot.eventName === "string" && snapshot.eventName.length <= MAX_LABEL_LENGTH
      && Array.isArray(snapshot.board) && snapshot.board.length === 24
      && Array.isArray(snapshot.rankings) && snapshot.rankings.length <= MAX_TEAMS
      && snapshot.board.every((slot, index) => exactKeys(slot, ["slot", "teamNumber", "teamName", "alliance"])
        && slot.slot === index && typeof slot.teamNumber === "string" && slot.teamNumber.length <= 12
        && typeof slot.teamName === "string" && slot.teamName.length <= 80 && slot.alliance === Math.floor(index / 3) + 1)
      && snapshot.rankings.every((team, index) => exactKeys(team, ["rank", "teamNumber", "state"])
        && team.rank === index + 1 && typeof team.teamNumber === "string" && team.teamNumber.length <= 12
        && ["normal", "picked", "confirmed", "possible"].includes(team.state))
      && Array.isArray(snapshot.columns) && snapshot.columns.length <= MAX_COLUMNS
      && snapshot.columns.every((column, index) => exactKeys(column, ["id", "label", "teams", "order"])
        && typeof column.id === "string" && column.id.length <= 64
        && typeof column.label === "string" && column.label.length <= MAX_LABEL_LENGTH
        && column.order === index && Array.isArray(column.teams) && column.teams.length <= MAX_TEAMS
        && column.teams.every((team, teamIndex) => exactKeys(team, Object.hasOwn(team, "score") ? ["rank", "teamNumber", "state", "score"] : ["rank", "teamNumber", "state"])
          && team.rank === teamIndex + 1 && typeof team.teamNumber === "string" && team.teamNumber.length <= 12
          && ["normal", "picked", "confirmed", "possible"].includes(team.state)
          && (!Object.hasOwn(team, "score") || (typeof team.score === "number" && Number.isFinite(team.score))))));
  }

  global.mobileAllianceDisplay = Object.freeze({ buildMobileAllianceSnapshot, normalizeTeamNumber, validateMobileAllianceSnapshot });
})(globalThis);
