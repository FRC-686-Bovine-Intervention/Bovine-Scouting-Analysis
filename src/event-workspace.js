(function () {
const sourceRefresh = globalThis.SourceRefresh || {};
const defaultRefreshPolicyForSource = sourceRefresh.defaultPolicyForSource || (() => ({ baseIntervalMs: 60 * 1000, staleAfterMs: 5 * 60 * 1000, maxBackoffMs: 20 * 60 * 1000 }));
const computeSourceNextPollAt = sourceRefresh.computeNextPollAt || (() => "");
const computeSourceFreshness = sourceRefresh.freshnessForSource || ((source) => source?.freshness || "unknown");

function normalizeText(value) {
  return String(value || "").trim();
}

function looksLikeRemoteUrl(value) {
  return /^(https?|file):\/\//i.test(normalizeText(value));
}

function looksLikeGoogleSheetUrl(value) {
  return /\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(normalizeText(value));
}

function fileExtension(value) {
  const normalized = normalizeText(value).split(/[?#]/)[0];
  const match = normalized.match(/\.([a-z0-9]+)$/i);
  return normalizeText(match?.[1]).toLowerCase();
}

function inferredAttachmentFormat(currentFormat, value, isRemoteUrl) {
  if (looksLikeGoogleSheetUrl(value)) return "legacy-sheet-url";
  const extension = fileExtension(value);
  if (extension === "json") return "scouting-json";
  if (["csv", "tsv", "txt"].includes(extension)) return "legacy-sheet-csv";
  if (isRemoteUrl) return normalizeText(currentFormat);
  if (normalizeText(currentFormat).toLowerCase() === "legacy-sheet-url") return "legacy-sheet-csv";
  return normalizeText(currentFormat);
}

function createExternalSourceState(sourceId, eventModel, storedSource = {}) {
  const baseNotes = eventModel?.dataSources?.find((source) => normalizeText(source?.name).toLowerCase().includes(sourceId)) || null;
  return {
    sourceId,
    kind: "external",
    status: normalizeText(storedSource.status) || "ready",
    freshness: normalizeText(storedSource.freshness) || "snapshot",
    lastAttemptedAt: normalizeText(storedSource.lastAttemptedAt) || "",
    lastSuccessfulAt: normalizeText(storedSource.lastSuccessfulAt) || "",
    nextPollAt: normalizeText(storedSource.nextPollAt) || "",
    consecutiveFailures: Math.max(0, Number(storedSource.consecutiveFailures) || 0),
    pollingEnabled: storedSource.pollingEnabled !== undefined ? Boolean(storedSource.pollingEnabled) : true,
    error: normalizeText(storedSource.error) || "",
    sourceFingerprint: normalizeText(storedSource.sourceFingerprint) || "",
    provenance: {
      mode: normalizeText(storedSource?.provenance?.mode) || "local-snapshot",
      notes: normalizeText(storedSource?.provenance?.notes) || normalizeText(baseNotes?.notes),
    },
  };
}

function buildDefaultScoutingAttachment(eventModel) {
  const attachmentId = `scouting-${eventModel.key}-default`;
  if (!eventModel?.sheet) {
    return [
      {
        attachmentId,
        eventKey: eventModel.key,
        label: `${normalizeText(eventModel?.name) || normalizeText(eventModel?.key)} Scouting`,
        format: "scouting-json",
        locationKind: "manual",
          location: {
            url: "",
            sampleKey: "",
            schemaUrl: "",
            schemaPath: "",
          },
        translatorId: "canonical-json-v1",
        profileId: "canonical-json-v1",
        profileLabel: "Canonical JSON",
        profileVersionKey: "",
        status: "stale",
        freshness: "unknown",
        autoLoad: false,
        schemaSignature: "",
        sourceFingerprint: "",
        error: "",
        lastAttemptedAt: "",
        lastSuccessfulAt: "",
        nextPollAt: "",
        consecutiveFailures: 0,
        pollingEnabled: true,
      },
    ];
  }
  const hasSample = Boolean(eventModel.sheet.sampleCsvText);
  const url = normalizeText(eventModel.sheet.url);
  return [
    {
      attachmentId,
      eventKey: eventModel.key,
      label: `${normalizeText(eventModel.name) || normalizeText(eventModel.key)} Scouting`,
      format: hasSample ? "legacy-sheet-csv" : "legacy-sheet-url",
      locationKind: hasSample ? "embedded-sample" : url ? "url" : "manual",
        location: {
          url,
          sampleKey: hasSample ? `${eventModel.key}:sample-sheet` : "",
          schemaUrl: "",
          schemaPath: "",
        },
      translatorId: normalizeText(eventModel.sheet.recommendedProfileId) || "match-current-v2",
      profileId: normalizeText(eventModel.sheet.recommendedProfileId) || "match-current-v2",
      profileLabel: "",
      profileVersionKey: "",
      status: hasSample ? "ready" : "stale",
      freshness: hasSample ? "snapshot" : "unknown",
      autoLoad: hasSample,
      schemaSignature: "",
      sourceFingerprint: "",
      error: "",
      lastAttemptedAt: "",
      lastSuccessfulAt: "",
      nextPollAt: "",
      consecutiveFailures: 0,
      pollingEnabled: true,
    },
  ];
}

function normalizeScoutingAttachment(attachment, eventModel) {
  const defaultAttachment = buildDefaultScoutingAttachment(eventModel)[0] || {};
  const attachmentId = normalizeText(attachment?.attachmentId) || normalizeText(defaultAttachment.attachmentId) || `scouting-${eventModel?.key || "event"}-default`;
  return {
    attachmentId,
    eventKey: normalizeText(attachment?.eventKey) || normalizeText(eventModel?.key),
    label: normalizeText(attachment?.label) || normalizeText(defaultAttachment.label) || attachmentId,
    format: normalizeText(attachment?.format) || normalizeText(defaultAttachment.format) || "legacy-sheet-url",
    locationKind: normalizeText(attachment?.locationKind) || normalizeText(defaultAttachment.locationKind) || "manual",
      location: {
        url: normalizeText(attachment?.location?.url)
          || ((normalizeText(attachment?.locationKind) === "path" || normalizeText(attachment?.location?.path)) ? "" : normalizeText(defaultAttachment?.location?.url)),
        sampleKey: normalizeText(attachment?.location?.sampleKey) || normalizeText(defaultAttachment?.location?.sampleKey),
        path: normalizeText(attachment?.location?.path),
        schemaUrl: normalizeText(attachment?.location?.schemaUrl),
        schemaPath: normalizeText(attachment?.location?.schemaPath),
      },
    translatorId: normalizeText(attachment?.translatorId) || normalizeText(defaultAttachment.translatorId) || "match-current-v2",
    profileId: normalizeText(attachment?.profileId) || normalizeText(defaultAttachment.profileId) || normalizeText(attachment?.translatorId) || normalizeText(defaultAttachment.translatorId) || "match-current-v2",
    profileLabel: normalizeText(attachment?.profileLabel) || normalizeText(defaultAttachment.profileLabel),
    profileVersionKey: normalizeText(attachment?.profileVersionKey) || normalizeText(defaultAttachment.profileVersionKey),
    status: normalizeText(attachment?.status) || normalizeText(defaultAttachment.status) || "stale",
    freshness: normalizeText(attachment?.freshness) || normalizeText(defaultAttachment.freshness) || "unknown",
    autoLoad: attachment?.autoLoad !== undefined ? Boolean(attachment.autoLoad) : Boolean(defaultAttachment.autoLoad),
    schemaSignature: normalizeText(attachment?.schemaSignature),
    translatorVersion: normalizeText(attachment?.translatorVersion),
    sourceFingerprint: normalizeText(attachment?.sourceFingerprint),
    error: normalizeText(attachment?.error),
    lastAttemptedAt: normalizeText(attachment?.lastAttemptedAt),
    lastSuccessfulAt: normalizeText(attachment?.lastSuccessfulAt),
    nextPollAt: normalizeText(attachment?.nextPollAt),
    consecutiveFailures: Math.max(0, Number(attachment?.consecutiveFailures) || 0),
    pollingEnabled: attachment?.pollingEnabled !== undefined ? Boolean(attachment.pollingEnabled) : Boolean(defaultAttachment.pollingEnabled ?? true),
  };
}

function mergeScoutingAttachments(eventModel, storedAttachments = []) {
  const defaults = buildDefaultScoutingAttachment(eventModel);
  const merged = new Map(defaults.map((attachment) => [attachment.attachmentId, attachment]));
  (Array.isArray(storedAttachments) ? storedAttachments : []).forEach((attachment) => {
    const normalized = normalizeScoutingAttachment(attachment, eventModel);
    merged.set(normalized.attachmentId, {
      ...(merged.get(normalized.attachmentId) || {}),
      ...normalized,
      location: {
        ...((merged.get(normalized.attachmentId) || {}).location || {}),
        ...(normalized.location || {}),
      },
    });
  });
  return [...merged.values()].map((attachment) => normalizeScoutingAttachment(attachment, eventModel));
}

function baseEventModelFromWorkspace(workspace, fallbackEventModel = {}) {
  return {
    key: normalizeText(workspace?.eventKey) || normalizeText(fallbackEventModel?.key),
    season: Number(workspace?.season || fallbackEventModel?.season || 0),
    name: normalizeText(workspace?.identity?.name) || normalizeText(fallbackEventModel?.name),
    seasonLabel: normalizeText(workspace?.identity?.seasonLabel) || normalizeText(fallbackEventModel?.seasonLabel),
    sheet: fallbackEventModel?.sheet || null,
  };
}

function createEventWorkspace(eventModel, storedWorkspace = {}) {
  const scoutingAttachments = mergeScoutingAttachments(eventModel, storedWorkspace?.sources?.scouting);
  const defaultActiveAttachmentId = scoutingAttachments[0]?.attachmentId || "";
  return {
    version: 1,
    eventKey: normalizeText(storedWorkspace?.eventKey) || normalizeText(eventModel?.key),
    season: Number(storedWorkspace?.season || eventModel?.season || 0),
    identity: {
      key: normalizeText(eventModel?.key),
      name: normalizeText(storedWorkspace?.identity?.name) || normalizeText(eventModel?.name),
      seasonLabel: normalizeText(storedWorkspace?.identity?.seasonLabel) || normalizeText(eventModel?.seasonLabel),
    },
    sources: {
      tba: createExternalSourceState("tba", eventModel, storedWorkspace?.sources?.tba),
      statbotics: createExternalSourceState("statbotics", eventModel, storedWorkspace?.sources?.statbotics),
      pridge: createExternalSourceState("pridge", eventModel, storedWorkspace?.sources?.pridge),
      scouting: scoutingAttachments,
    },
    activeScoutingAttachmentId: normalizeText(storedWorkspace?.activeScoutingAttachmentId) || defaultActiveAttachmentId,
  };
}

function updateExternalSource(workspace, sourceId, updater) {
  const normalizedSourceId = normalizeText(sourceId);
  if (!normalizedSourceId || !workspace?.sources?.[normalizedSourceId]) return workspace;
  const currentSource = workspace.sources[normalizedSourceId];
  const nextSource = typeof updater === "function" ? updater(currentSource) : currentSource;
  return {
    ...workspace,
    sources: {
      ...workspace.sources,
      [normalizedSourceId]: {
        ...currentSource,
        ...nextSource,
        provenance: {
          ...(currentSource.provenance || {}),
          ...(nextSource?.provenance || {}),
        },
      },
    },
  };
}

function activeScoutingAttachment(workspace) {
  if (!workspace?.sources?.scouting?.length) return null;
  return workspace.sources.scouting.find((attachment) => attachment.attachmentId === workspace.activeScoutingAttachmentId) || workspace.sources.scouting[0];
}

function activeScoutingAttachmentUsesSample(workspace) {
  return activeScoutingAttachment(workspace)?.locationKind === "embedded-sample";
}

function activeScoutingAttachmentSampleKey(workspace) {
  return normalizeText(activeScoutingAttachment(workspace)?.location?.sampleKey);
}

function activeScoutingAttachmentProfileId(workspace) {
  return normalizeText(activeScoutingAttachment(workspace)?.profileId) || normalizeText(activeScoutingAttachment(workspace)?.translatorId);
}

function activeScoutingAttachmentProfileVersionKey(workspace) {
  return normalizeText(activeScoutingAttachment(workspace)?.profileVersionKey);
}

function scoutingSourceUrl(workspace) {
  return normalizeText(activeScoutingAttachment(workspace)?.location?.url);
}

function scoutingSourcePath(workspace) {
  return normalizeText(activeScoutingAttachment(workspace)?.location?.path);
}

function activeScoutingAttachmentSourceValue(workspace, eventModel) {
  const attachment = activeScoutingAttachment(workspace);
  if (normalizeText(attachment?.locationKind) === "path" || normalizeText(attachment?.location?.path)) {
    return scoutingSourcePath(workspace);
  }
  return scoutingSourceUrl(workspace) || normalizeText(eventModel?.sheet?.url);
}

function activeScoutingAttachmentSchemaSourceValue(workspace) {
  const attachment = activeScoutingAttachment(workspace);
  if (!attachment) return "";
  if (normalizeText(attachment?.location?.schemaPath)) return normalizeText(attachment.location.schemaPath);
  return normalizeText(attachment?.location?.schemaUrl);
}

function activeScoutingAttachmentFormat(workspace, eventModel) {
  const attachment = activeScoutingAttachment(workspace);
  const explicitFormat = normalizeText(attachment?.format).toLowerCase();
  if (explicitFormat) return explicitFormat;
  if (attachment?.locationKind === "embedded-sample" || normalizeText(attachment?.location?.sampleKey)) return "legacy-sheet-csv";
  const url = normalizeText(attachment?.location?.url) || normalizeText(eventModel?.sheet?.url);
  const path = normalizeText(attachment?.location?.path);
  const extension = fileExtension(url) || fileExtension(path);
  if (extension === "json") return "scouting-json";
  if (extension === "csv" || extension === "tsv") return "legacy-sheet-csv";
  if (looksLikeGoogleSheetUrl(url)) return "legacy-sheet-url";
  return "legacy-sheet-url";
}

function describeActiveScoutingAttachmentLoad(workspace, eventModel) {
  const attachment = activeScoutingAttachment(workspace);
  const format = activeScoutingAttachmentFormat(workspace, eventModel);
  const url = scoutingSourceUrl(workspace);
  const path = normalizeText(attachment?.location?.path);
  const schemaUrl = normalizeText(attachment?.location?.schemaUrl);
  const schemaPath = normalizeText(attachment?.location?.schemaPath);
  const sampleKey = activeScoutingAttachmentSampleKey(workspace);
  if (!attachment) {
    return { kind: "none", format: "", url: "", path: "", schemaUrl: "", schemaPath: "", sampleKey: "", canLoad: false };
  }
  if (attachment.locationKind === "embedded-sample" && activeScoutingAttachmentHasSample(workspace, eventModel)) {
    return { kind: "embedded-sample", format, url, path, schemaUrl, schemaPath, sampleKey, canLoad: true };
  }
  if (path && format === "scouting-json") {
    return { kind: "local-json", format, url, path, schemaUrl, schemaPath, sampleKey, canLoad: true };
  }
  if (path && format === "legacy-sheet-csv") {
    return { kind: "local-csv", format, url, path, schemaUrl, schemaPath, sampleKey, canLoad: true };
  }
  if (url && format === "scouting-json") {
    return { kind: "remote-json", format, url, path, schemaUrl, schemaPath, sampleKey, canLoad: true };
  }
  if (url && looksLikeGoogleSheetUrl(url)) {
    return { kind: "google-sheet-url", format, url, path, schemaUrl, schemaPath, sampleKey, canLoad: true };
  }
  if (url && format === "legacy-sheet-csv") {
    return { kind: "remote-csv", format, url, path, schemaUrl, schemaPath, sampleKey, canLoad: true };
  }
  if (sampleKey) {
    return { kind: "embedded-sample", format, url, path, schemaUrl, schemaPath, sampleKey, canLoad: activeScoutingAttachmentHasSample(workspace, eventModel) };
  }
  return { kind: "unsupported", format, url, path, schemaUrl, schemaPath, sampleKey, canLoad: false };
}

function activeScoutingAttachmentHasSample(workspace, eventModel) {
  if (!activeScoutingAttachmentUsesSample(workspace)) return false;
  return Boolean(normalizeText(eventModel?.sheet?.sampleCsvText));
}

function activeScoutingAttachmentCanLoad(workspace, eventModel) {
  return Boolean(describeActiveScoutingAttachmentLoad(workspace, eventModel).canLoad);
}

function shouldAutoLoadScoutingAttachment(workspace, eventModel) {
  const attachment = activeScoutingAttachment(workspace);
  if (!attachment?.autoLoad) return false;
  if (!activeScoutingAttachmentCanLoad(workspace, eventModel)) return false;
  return true;
}

function resolveScoutingImportSourceUrl(workspace, eventModel, storedUrl = "") {
  return normalizeText(storedUrl) || scoutingSourceUrl(workspace) || normalizeText(eventModel?.sheet?.url);
}

function setScoutingSourceLocation(workspace, value) {
  const normalizedValue = normalizeText(value);
  const isRemoteUrl = looksLikeRemoteUrl(normalizedValue);
  return updateActiveScoutingAttachment(workspace, (attachment) => ({
    ...attachment,
    format: normalizedValue ? (inferredAttachmentFormat(attachment?.format, normalizedValue, isRemoteUrl) || attachment?.format) : attachment?.format,
    locationKind: !normalizedValue ? attachment.locationKind : (isRemoteUrl ? "url" : "path"),
    location: {
      ...(attachment.location || {}),
      url: isRemoteUrl ? normalizedValue : "",
      path: !normalizedValue ? normalizeText(attachment?.location?.path) : (isRemoteUrl ? "" : normalizedValue),
    },
    autoLoad: Boolean(normalizedValue) || Boolean(attachment.autoLoad),
    status: normalizedValue ? "stale" : attachment.status,
  }));
}

function setScoutingSchemaSourceLocation(workspace, value) {
  const normalizedValue = normalizeText(value);
  const isRemoteUrl = looksLikeRemoteUrl(normalizedValue);
  return updateActiveScoutingAttachment(workspace, (attachment) => ({
    ...attachment,
    location: {
      ...(attachment.location || {}),
      schemaUrl: isRemoteUrl ? normalizedValue : "",
      schemaPath: !normalizedValue ? normalizeText(attachment?.location?.schemaPath) : (isRemoteUrl ? "" : normalizedValue),
    },
    status: normalizedValue ? "stale" : attachment.status,
  }));
}

function rebuildSampleBackedScoutingState({
  workspace,
  eventModel,
  submissions = [],
  activity = [],
  shouldRefreshSampleBackedSubmissions = () => false,
  adaptEventSheetCsv = (_eventModel, csvText) => csvText,
  translateEventSheetToCanonical = null,
  previewScoutingImport = () => null,
  previewScoutingJsonImport = () => null,
  commitScoutingImport = () => null,
  stampScoutingSubmissionMetadata = (nextSubmissions) => nextSubmissions || [],
}) {
  if (!Array.isArray(submissions) || !submissions.length) return null;
  if (!activeScoutingAttachmentHasSample(workspace, eventModel)) return null;
  const sampleCsvText = normalizeText(eventModel?.sheet?.sampleCsvText);
  if (!sampleCsvText) return null;
  const profileId = activeScoutingAttachmentProfileId(workspace) || normalizeText(eventModel?.sheet?.recommendedProfileId);
  const translated = typeof translateEventSheetToCanonical === "function"
    ? translateEventSheetToCanonical(eventModel, sampleCsvText, { templateProfileId: profileId })
    : null;
  const preview = translated
    ? previewScoutingJsonImport({
        jsonText: JSON.stringify({
          meta: translated.meta || {},
          schema: translated.schema || {},
          entries: translated.entries || [],
        }),
        eventModel,
        activeEventKey: normalizeText(eventModel?.key),
        existingSubmissions: [],
        profileId: translated.templateProfileId,
        profileLabel: translated.profileLabel,
        translationVersion: translated.translatorVersion,
      })
    : previewScoutingImport({
        csvText: adaptEventSheetCsv(eventModel, sampleCsvText, {
          templateProfileId: profileId,
        }),
        eventModel,
        activeEventKey: normalizeText(eventModel?.key),
        existingSubmissions: [],
        templateProfileId: profileId,
      });
  if (!preview?.ok || !preview.summary) return null;
  if (!shouldRefreshSampleBackedSubmissions(submissions, eventModel, {
    schemaFields: preview.summary.schemaFields,
    translationVersion: preview.summary.metadata?.translationVersion,
  })) {
    return null;
  }
  const committed = commitScoutingImport({
    preview,
    existingSubmissions: [],
    existingActivity: Array.isArray(activity) ? activity : [],
    replaceExisting: true,
  });
  if (!committed) return null;
  return {
    submissions: stampScoutingSubmissionMetadata(committed.submissions, eventModel, {
      scoutingImportSource: "event-sheet-sample",
      schemaFields: preview.summary.schemaFields,
    }),
    activity: committed.activity,
  };
}

function updateActiveScoutingAttachment(workspace, updater) {
  if (!workspace?.sources?.scouting?.length) return workspace;
  const activeAttachment = activeScoutingAttachment(workspace);
  if (!activeAttachment) return workspace;
  const nextAttachment = typeof updater === "function" ? updater(activeAttachment) : activeAttachment;
  return {
    ...workspace,
    sources: {
      ...workspace.sources,
      scouting: workspace.sources.scouting.map((attachment) =>
        attachment.attachmentId === activeAttachment.attachmentId
          ? normalizeScoutingAttachment(
              {
                ...attachment,
                ...nextAttachment,
                location: {
                  ...(attachment.location || {}),
                  ...(nextAttachment?.location || {}),
                },
              },
              { key: workspace.eventKey, season: workspace.season, name: workspace.identity?.name, seasonLabel: workspace.identity?.seasonLabel },
            )
          : attachment,
      ),
    },
  };
}

function setActiveScoutingAttachment(workspace, attachmentId) {
  const normalizedAttachmentId = normalizeText(attachmentId);
  if (!workspace?.sources?.scouting?.length || !normalizedAttachmentId) return workspace;
  if (!workspace.sources.scouting.some((attachment) => attachment.attachmentId === normalizedAttachmentId)) return workspace;
  return {
    ...workspace,
    activeScoutingAttachmentId: normalizedAttachmentId,
  };
}

function upsertScoutingAttachment(workspace, attachment, fallbackEventModel = {}) {
  const eventModel = baseEventModelFromWorkspace(workspace, fallbackEventModel);
  const normalized = normalizeScoutingAttachment(attachment, eventModel);
  const existingAttachments = Array.isArray(workspace?.sources?.scouting) ? workspace.sources.scouting : [];
  const hasExisting = existingAttachments.some((candidate) => candidate.attachmentId === normalized.attachmentId);
  const nextAttachments = hasExisting
    ? existingAttachments.map((candidate) =>
        candidate.attachmentId === normalized.attachmentId
          ? normalizeScoutingAttachment(
              {
                ...candidate,
                ...normalized,
                location: {
                  ...(candidate.location || {}),
                  ...(normalized.location || {}),
                },
              },
              eventModel,
            )
          : candidate,
      )
    : [...existingAttachments, normalized];
  return {
    ...workspace,
    sources: {
      ...workspace.sources,
      scouting: nextAttachments,
    },
    activeScoutingAttachmentId: hasExisting
      ? workspace.activeScoutingAttachmentId || normalized.attachmentId
      : normalized.attachmentId,
  };
}

function removeScoutingAttachment(workspace, attachmentId) {
  const normalizedAttachmentId = normalizeText(attachmentId);
  const existingAttachments = Array.isArray(workspace?.sources?.scouting) ? workspace.sources.scouting : [];
  if (!normalizedAttachmentId || !existingAttachments.length) return workspace;
  const nextAttachments = existingAttachments.filter((attachment) => attachment.attachmentId !== normalizedAttachmentId);
  if (nextAttachments.length === existingAttachments.length) return workspace;
  return {
    ...workspace,
    sources: {
      ...workspace.sources,
      scouting: nextAttachments,
    },
    activeScoutingAttachmentId:
      workspace.activeScoutingAttachmentId === normalizedAttachmentId
        ? nextAttachments[0]?.attachmentId || ""
        : workspace.activeScoutingAttachmentId,
  };
}

function setScoutingSourceUrl(workspace, url) {
  const normalizedUrl = normalizeText(url);
  return updateActiveScoutingAttachment(workspace, (attachment) => ({
    ...attachment,
    locationKind: normalizedUrl ? "url" : attachment.locationKind,
    location: {
      ...(attachment.location || {}),
      url: normalizedUrl,
    },
    autoLoad: Boolean(normalizedUrl) || Boolean(attachment.autoLoad),
    status: normalizedUrl ? "stale" : attachment.status,
  }));
}

function markActiveScoutingAttachmentAttempt(workspace, update = {}) {
  const timestamp = normalizeText(update.timestamp) || new Date().toISOString();
  const activeAttachment = activeScoutingAttachment(workspace);
  const policy = defaultRefreshPolicyForSource({ kind: "scouting", sourceId: activeAttachment?.attachmentId });
  return updateActiveScoutingAttachment(workspace, (attachment) => ({
    ...attachment,
    status: normalizeText(update.status) || "loading",
    freshness: normalizeText(update.freshness) || attachment.freshness || "unknown",
    error: normalizeText(update.error),
    lastAttemptedAt: timestamp,
    nextPollAt: normalizeText(update.nextPollAt) || computeSourceNextPollAt({ ...attachment, lastAttemptedAt: timestamp }, policy, Date.parse(timestamp) || Date.now()),
  }));
}

function markActiveScoutingAttachmentSuccess(workspace, update = {}) {
  const timestamp = normalizeText(update.timestamp) || new Date().toISOString();
  const activeAttachment = activeScoutingAttachment(workspace);
  const policy = defaultRefreshPolicyForSource({ kind: "scouting", sourceId: activeAttachment?.attachmentId });
  return updateActiveScoutingAttachment(workspace, (attachment) => ({
    ...attachment,
    status: normalizeText(update.status) || "ready",
    freshness: normalizeText(update.freshness) || computeSourceFreshness({ ...attachment, status: "ready", lastSuccessfulAt: timestamp }, policy, Date.parse(timestamp) || Date.now()),
    error: "",
    profileId: normalizeText(update.profileId) || attachment.profileId,
    profileLabel: normalizeText(update.profileLabel) || attachment.profileLabel,
    profileVersionKey: normalizeText(update.profileVersionKey) || attachment.profileVersionKey,
    schemaSignature: normalizeText(update.schemaSignature) || attachment.schemaSignature,
    translatorVersion: normalizeText(update.translatorVersion) || attachment.translatorVersion,
    sourceFingerprint: normalizeText(update.sourceFingerprint) || attachment.sourceFingerprint,
    lastAttemptedAt: timestamp,
    lastSuccessfulAt: timestamp,
    nextPollAt: normalizeText(update.nextPollAt) || computeSourceNextPollAt({ ...attachment, lastAttemptedAt: timestamp, consecutiveFailures: 0 }, policy, Date.parse(timestamp) || Date.now()),
    consecutiveFailures: 0,
  }));
}

function markActiveScoutingAttachmentFailure(workspace, update = {}) {
  const timestamp = normalizeText(update.timestamp) || new Date().toISOString();
  const activeAttachment = activeScoutingAttachment(workspace);
  const policy = defaultRefreshPolicyForSource({ kind: "scouting", sourceId: activeAttachment?.attachmentId });
  return updateActiveScoutingAttachment(workspace, (attachment) => ({
    ...attachment,
    status: normalizeText(update.status) || "error",
    freshness: normalizeText(update.freshness) || "stale",
    error: normalizeText(update.error),
    lastAttemptedAt: timestamp,
    consecutiveFailures: Math.max(0, Number(attachment?.consecutiveFailures) || 0) + 1,
    nextPollAt:
      normalizeText(update.nextPollAt) ||
      computeSourceNextPollAt(
        {
          ...attachment,
          lastAttemptedAt: timestamp,
          consecutiveFailures: Math.max(0, Number(attachment?.consecutiveFailures) || 0) + 1,
        },
        policy,
        Date.parse(timestamp) || Date.now(),
      ),
  }));
}

function markExternalSourceAttempt(workspace, sourceId, update = {}) {
  const timestamp = normalizeText(update.timestamp) || new Date().toISOString();
  const policy = defaultRefreshPolicyForSource({ kind: "external", sourceId });
  return updateExternalSource(workspace, sourceId, (source) => ({
    ...source,
    status: normalizeText(update.status) || "loading",
    freshness: normalizeText(update.freshness) || source.freshness || "unknown",
    error: normalizeText(update.error),
    lastAttemptedAt: timestamp,
    nextPollAt: normalizeText(update.nextPollAt) || computeSourceNextPollAt({ ...source, lastAttemptedAt: timestamp }, policy, Date.parse(timestamp) || Date.now()),
  }));
}

function markExternalSourceSuccess(workspace, sourceId, update = {}) {
  const timestamp = normalizeText(update.timestamp) || new Date().toISOString();
  const policy = defaultRefreshPolicyForSource({ kind: "external", sourceId });
  return updateExternalSource(workspace, sourceId, (source) => ({
    ...source,
    status: normalizeText(update.status) || "ready",
    freshness: normalizeText(update.freshness) || computeSourceFreshness({ ...source, status: "ready", lastSuccessfulAt: timestamp }, policy, Date.parse(timestamp) || Date.now()),
    error: "",
    lastAttemptedAt: timestamp,
    lastSuccessfulAt: timestamp,
    nextPollAt: normalizeText(update.nextPollAt) || computeSourceNextPollAt({ ...source, lastAttemptedAt: timestamp, consecutiveFailures: 0 }, policy, Date.parse(timestamp) || Date.now()),
    consecutiveFailures: 0,
    sourceFingerprint: normalizeText(update.sourceFingerprint) || source.sourceFingerprint,
    provenance: {
      ...(source.provenance || {}),
      ...(update.provenance || {}),
    },
  }));
}

function markExternalSourceFailure(workspace, sourceId, update = {}) {
  const timestamp = normalizeText(update.timestamp) || new Date().toISOString();
  const policy = defaultRefreshPolicyForSource({ kind: "external", sourceId });
  return updateExternalSource(workspace, sourceId, (source) => ({
    ...source,
    status: normalizeText(update.status) || "error",
    freshness: normalizeText(update.freshness) || "stale",
    error: normalizeText(update.error),
    lastAttemptedAt: timestamp,
    consecutiveFailures: Math.max(0, Number(source?.consecutiveFailures) || 0) + 1,
    nextPollAt:
      normalizeText(update.nextPollAt) ||
      computeSourceNextPollAt(
        {
          ...source,
          lastAttemptedAt: timestamp,
          consecutiveFailures: Math.max(0, Number(source?.consecutiveFailures) || 0) + 1,
        },
        policy,
        Date.parse(timestamp) || Date.now(),
      ),
  }));
}

function setExternalSourcePollingEnabled(workspace, sourceId, pollingEnabled) {
  return updateExternalSource(workspace, sourceId, (source) => ({
    ...source,
    pollingEnabled: Boolean(pollingEnabled),
  }));
}

function setActiveScoutingAttachmentPollingEnabled(workspace, pollingEnabled) {
  return updateActiveScoutingAttachment(workspace, (attachment) => ({
    ...attachment,
    pollingEnabled: Boolean(pollingEnabled),
  }));
}

globalThis.EventWorkspace = {
  activeScoutingAttachment,
  activeScoutingAttachmentCanLoad,
  activeScoutingAttachmentFormat,
  activeScoutingAttachmentHasSample,
  activeScoutingAttachmentProfileId,
  activeScoutingAttachmentProfileVersionKey,
  activeScoutingAttachmentSampleKey,
  activeScoutingAttachmentSourceValue,
  activeScoutingAttachmentSchemaSourceValue,
  activeScoutingAttachmentUsesSample,
  createEventWorkspace,
  describeActiveScoutingAttachmentLoad,
  markActiveScoutingAttachmentAttempt,
  markActiveScoutingAttachmentFailure,
  markActiveScoutingAttachmentSuccess,
  markExternalSourceAttempt,
  markExternalSourceFailure,
  markExternalSourceSuccess,
  removeScoutingAttachment,
  rebuildSampleBackedScoutingState,
  resolveScoutingImportSourceUrl,
  setActiveScoutingAttachmentPollingEnabled,
  setActiveScoutingAttachment,
  setExternalSourcePollingEnabled,
  setScoutingSourceLocation,
  setScoutingSchemaSourceLocation,
  setScoutingSourceUrl,
  scoutingSourcePath,
  scoutingSourceUrl,
  shouldAutoLoadScoutingAttachment,
  upsertScoutingAttachment,
  updateExternalSource,
  updateActiveScoutingAttachment,
};
})();
