(function () {
  const TEAM_KEY_PATTERN = /^(\d+)([A-Za-z]+)?$/;

  function normalizeText(value) {
    return String(value ?? "").trim();
  }

  function normalizeTeamIdentity(value) {
    const raw = normalizeText(value).replace(/^frc/i, "");
    if (!raw) return null;
    const match = raw.match(TEAM_KEY_PATTERN);
    if (!match) return null;
    const baseNumber = Number(match[1]);
    if (!Number.isSafeInteger(baseNumber) || baseNumber <= 0) return null;
    const suffix = (match[2] || "").toUpperCase();
    const label = `${match[1]}${suffix}`;
    const key = `frc${label}`;
    return {
      id: key,
      key,
      label,
      baseNumber,
      isSuffixed: Boolean(suffix),
    };
  }

  function normalizeNumericTeamIdentity(value) {
    const number = Number(value);
    return Number.isSafeInteger(number) && number > 0 ? normalizeTeamIdentity(number) : null;
  }

  function identityFromProviderValue(value) {
    if (typeof value === "number") return normalizeNumericTeamIdentity(value);
    return normalizeTeamIdentity(value);
  }

  function identityFromSubmissionValues({ teamKey = "", teamNumber = "" } = {}) {
    const explicit = normalizeText(teamKey);
    const rawNumber = normalizeText(teamNumber);
    const identity = explicit ? normalizeTeamIdentity(explicit) : normalizeTeamIdentity(rawNumber);
    if (explicit && !identity) return { identity: null, error: "teamKey is not a valid provider team key." };
    if (identity?.isSuffixed && !explicit) return { identity: null, error: "A suffixed team number requires an explicit teamKey." };
    if (!identity) return { identity: null, error: "teamNumber is required and must be a positive number." };
    if (explicit && rawNumber && /^\d+$/.test(rawNumber) && Number(rawNumber) !== identity.baseNumber) {
      return { identity: null, error: "teamNumber does not match teamKey." };
    }
    return { identity };
  }

  globalThis.TeamIdentity = {
    identityFromProviderValue,
    identityFromSubmissionValues,
    normalizeNumericTeamIdentity,
    normalizeTeamIdentity,
  };
})();
