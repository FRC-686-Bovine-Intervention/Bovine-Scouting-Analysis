(function () {
function normalizeText(value) {
  return String(value ?? "").trim();
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeFieldDefinition(fieldDefinition) {
  const fieldId = normalizeText(fieldDefinition?.id);
  if (!fieldId) return null;
  return {
    id: fieldId,
    label: normalizeText(fieldDefinition?.label || fieldId),
    type: normalizeText(fieldDefinition?.type),
    unit: normalizeText(fieldDefinition?.unit),
    aggregate: normalizeText(fieldDefinition?.aggregate),
    optional: fieldDefinition?.optional === true,
  };
}

function normalizeFieldMigrationRecords(records) {
  return (Array.isArray(records) ? records : [])
    .map((record, index) => {
      const kind = normalizeText(record?.kind).toLowerCase();
      const id = normalizeText(record?.id) || `field-migration-${index + 1}`;
      if (kind === "rename") {
        const fromFieldId = normalizeText(record?.fromFieldId || record?.from || record?.fieldId);
        const toFieldId = normalizeText(record?.toFieldId || record?.to);
        if (!fromFieldId || !toFieldId) return null;
        return {
          id,
          kind,
          fromFieldId,
          toFieldId,
          label: normalizeText(record?.label || `${fromFieldId} -> ${toFieldId}`),
          note: normalizeText(record?.note || record?.description),
          recordedAt: normalizeText(record?.recordedAt || record?.timestamp),
        };
      }
      if (kind === "add" || kind === "remove") {
        const fieldId = normalizeText(record?.fieldId || record?.toFieldId || record?.fromFieldId);
        if (!fieldId) return null;
        return {
          id,
          kind,
          fieldId,
          label: normalizeText(record?.label || fieldId),
          note: normalizeText(record?.note || record?.description),
          recordedAt: normalizeText(record?.recordedAt || record?.timestamp),
        };
      }
      return null;
    })
    .filter(Boolean);
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
  const normalizedFieldMigrations = normalizeFieldMigrationRecords(profile?.fieldMigrations || profile?.fieldMigrationRecords);
  const normalizedEquations = (Array.isArray(profile?.equations) ? profile.equations : [])
    .map((definition) => ({
      id: normalizeText(definition?.id),
      name: normalizeText(definition?.name),
      formula: normalizeText(definition?.formula),
      unit: normalizeText(definition?.unit),
      usage: normalizeText(definition?.usage),
      sourceOrder: Number.isFinite(Number(definition?.sourceOrder)) ? Number(definition.sourceOrder) : 0,
    }))
    .filter((definition) => definition.id);
  const fingerprint = fnv1aHash(JSON.stringify(stableValue({
    fields: normalizedFields,
    fieldMigrations: normalizedFieldMigrations,
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

function mergeSeededProfileCatalog(profileCatalog = {}, seededCatalog = {}) {
  const nextCatalog = Object.fromEntries(
    Object.entries(profileCatalog && typeof profileCatalog === "object" ? profileCatalog : {})
      .map(([catalogKey, profiles]) => [normalizeText(catalogKey), Array.isArray(profiles) ? cloneJsonValue(profiles) : []])
      .filter(([catalogKey, profiles]) => catalogKey && profiles.length),
  );
  Object.entries(seededCatalog && typeof seededCatalog === "object" ? seededCatalog : {}).forEach(([catalogKey, profiles]) => {
    const normalizedKey = normalizeText(catalogKey);
    if (!normalizedKey || nextCatalog[normalizedKey]?.length || !Array.isArray(profiles) || !profiles.length) return;
    nextCatalog[normalizedKey] = cloneJsonValue(profiles);
  });
  return nextCatalog;
}

globalThis.ScoutingProfiles = {
  buildProfileVersionKey,
  materializeEventScopedProfileCatalog,
  mergeSeededProfileCatalog,
  normalizeFieldDefinition,
  normalizeFieldMigrationRecords,
};
})();
