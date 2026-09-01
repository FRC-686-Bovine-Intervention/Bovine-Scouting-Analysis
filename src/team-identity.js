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

  globalThis.TeamIdentity = {
    identityFromProviderValue,
    normalizeNumericTeamIdentity,
    normalizeTeamIdentity,
  };
})();
