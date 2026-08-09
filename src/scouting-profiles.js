(function () {
function normalizeText(value) {
  return String(value ?? "").trim();
}

function sanitizeProfileIdentifier(value, fallback = "value") {
  const trimmed = normalizeText(value);
  const normalized = trimmed
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return fallback;
  if (/^[A-Za-z_]/.test(normalized)) return normalized;
  return `_${normalized}`;
}

function isValidProfileIdentifier(value) {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(normalizeText(value));
}

function canonicalProfileEquationName(definition, fallback = "equation") {
  const explicitId = normalizeText(definition?.id);
  const explicitName = normalizeText(definition?.name);
  const explicitLabel = normalizeText(definition?.label);
  if (isValidProfileIdentifier(explicitId)) return explicitId;
  if (isValidProfileIdentifier(explicitName)) return explicitName;
  if (isValidProfileIdentifier(explicitLabel)) return explicitLabel;
  return sanitizeProfileIdentifier(explicitId || explicitName || explicitLabel, fallback);
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

const defaultMetricDiscoveryBlacklist = Object.freeze({
  tba: Object.freeze([
    "scoreBreakdown.adjustPoints",
    "scoreBreakdown.rp",
  ]),
  statbotics: Object.freeze([
    "country",
    "district",
    "event",
    "event_name",
    "first_event",
    "state",
    "status",
    "team",
    "team_name",
    "time",
    "type",
    "week",
    "year",
  ]),
});

function metricDiscoveryBlacklist(schemaPayload = {}, sourceId = "") {
  const normalizedSourceId = normalizeText(sourceId);
  const metricPresentation = schemaPayload?.schema?.metricPresentation || schemaPayload?.metricPresentation || {};
  const schemaPatterns = Array.isArray(metricPresentation?.blacklist?.[normalizedSourceId])
    ? metricPresentation.blacklist[normalizedSourceId]
    : [];
  return [
    ...(defaultMetricDiscoveryBlacklist[normalizedSourceId] || []),
    ...schemaPatterns,
  ].map(normalizeText).filter(Boolean);
}

function metricDiscoveryGlobMatches(pattern, fieldId) {
  const escapedPattern = normalizeText(pattern)
    .split("*")
    .map((segment) => segment.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${escapedPattern}$`).test(String(fieldId || ""));
}

function isProviderMetricDiscoverable(sourceId, fieldId, schemaPayload = {}) {
  return !metricDiscoveryBlacklist(schemaPayload, sourceId)
    .some((pattern) => metricDiscoveryGlobMatches(pattern, fieldId));
}

function normalizeFieldDefinition(fieldDefinition) {
  const fieldId = normalizeText(fieldDefinition?.id);
  if (!fieldId) return null;
  return {
    id: fieldId,
    label: normalizeText(fieldDefinition?.label || fieldId),
    type: normalizeText(fieldDefinition?.type),
    unit: normalizeText(fieldDefinition?.unit),
  };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, stableValue(value[key])]),
  );
}

function fnv1aHash(value) {
  let hash = 0x811c9dc5;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function buildProfileVersionKey(profile = {}) {
  const profileId = normalizeText(profile?.id || profile?.profileId) || "profile";
  const normalizedFields = (Array.isArray(profile?.fields) ? profile.fields : [])
    .map(normalizeFieldDefinition)
    .filter(Boolean);
  const normalizedEquations = (Array.isArray(profile?.derivedEquations) ? profile.derivedEquations : (Array.isArray(profile?.equations) ? profile.equations : []))
    .map((definition) => ({
      name: canonicalProfileEquationName(definition),
      formula: normalizeText(definition?.formula),
    }))
    .filter((definition) => definition.name);
  const fingerprint = fnv1aHash(JSON.stringify(stableValue({
    fields: normalizedFields,
    equations: normalizedEquations,
  })));
  return `${profileId}|${fingerprint}`;
}

function materializeEventScopedProfileCatalog(profileCatalog = {}, eventModels = []) {
  const catalog = profileCatalog && typeof profileCatalog === "object" ? profileCatalog : {};
  const nextCatalog = Object.fromEntries(
    Object.entries(catalog)
      .map(([catalogKey, profiles]) => [normalizeText(catalogKey), Array.isArray(profiles) ? cloneJsonValue(profiles) : []])
      .filter(([catalogKey, profiles]) => catalogKey && profiles.length),
  );
  (Array.isArray(eventModels) ? eventModels : []).forEach((eventModel) => {
    const eventKey = normalizeText(eventModel?.key);
    if (!eventKey || nextCatalog[eventKey]?.length) return;
    const seasonKey = normalizeText(eventModel?.season);
    const seasonProfiles = Array.isArray(catalog?.[seasonKey]) ? catalog[seasonKey] : [];
    if (!seasonProfiles.length) return;
    nextCatalog[eventKey] = cloneJsonValue(seasonProfiles);
  });
  return nextCatalog;
}

globalThis.ScoutingProfiles = {
  buildProfileVersionKey,
  defaultMetricDiscoveryBlacklist,
  isProviderMetricDiscoverable,
  materializeEventScopedProfileCatalog,
  metricDiscoveryBlacklist,
  metricDiscoveryGlobMatches,
  normalizeFieldDefinition,
};
})();
