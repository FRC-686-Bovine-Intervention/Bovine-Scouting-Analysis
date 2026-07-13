const globalEventCatalog = globalThis.eventCatalog || [];
const externalEventLoader = globalThis.ExternalEventLoader || {};
const importFoundation = globalThis.ImportFoundation || {};
const externalSourceSnapshots = globalThis.ExternalSourceSnapshots || {};
const dynamicScoutingFields = globalThis.DynamicScoutingFields || {};
const localFileAccess = globalThis.LocalFileAccess || {};
const scoutingDependencyDiagnostics = globalThis.ScoutingDependencyDiagnostics || {};
const scoutingDiagnosticsState = globalThis.ScoutingDiagnosticsState || {};
const scoutingSourceUtils = globalThis.ScoutingSourceUtils || {};
const scoutingJsonImport = globalThis.ScoutingJsonImport || {};
const sourceRefresh = globalThis.SourceRefresh || {};
const seasonFramework = globalThis.SeasonFramework || {};
const metricEngine = globalThis.MetricEngine || {};
const sheetImportAdapters = globalThis.SheetImportAdapters || {};
const scoutingImportRepair = globalThis.ScoutingImportRepair || {};
const eventWorkspaceApi = globalThis.EventWorkspace || {};
const seededSeasonDerivedEquations = globalThis.SeasonDerivedEquations || { seasons: {} };
const seededSeasonFilters = globalThis.SeasonFilters || { seasons: {} };
const commitScoutingImport = importFoundation.commitScoutingImport;
const buildSampleCsv = importFoundation.buildSampleCsv;
const previewScoutingImport = importFoundation.previewScoutingImport;
const buildExternalSourceSnapshot = externalSourceSnapshots.buildExternalSourceSnapshot || ((sourceId, eventModel) => ({ eventKey: eventModel?.key, sourceId }));
const buildExternalSnapshotFingerprint = externalSourceSnapshots.buildSnapshotFingerprint || ((value) => JSON.stringify(value || null));
const seedWorkspaceExternalSourceFingerprints = externalSourceSnapshots.seedExternalSourceFingerprints || ((workspace) => workspace);
const localAttachmentFilesSupported = localFileAccess.supportsPersistentLocalFiles || (() => false);
const pickLocalAttachmentFile = localFileAccess.pickAttachmentFile || (async () => {
  throw new Error("Persistent local scouting files are unavailable in this browser.");
});
const readLocalAttachmentText = localFileAccess.readAttachmentText || (async () => {
  throw new Error("Persistent local scouting files are unavailable in this browser.");
});
const clearLocalAttachmentFile = localFileAccess.removeAttachment || (async () => false);
const normalizeScoutingSourceUrl = scoutingSourceUtils.normalizeSourceUrl || ((value) => String(value || "").trim());
const describeGoogleSheetInfo = scoutingSourceUtils.googleSheetInfo || (() => null);
const matchesEventSheetSourceUrl = scoutingSourceUtils.sourceUrlMatchesEventSheet || (() => false);
const shouldFallbackToCachedEventSheetSample = scoutingSourceUtils.shouldFallbackToEventSheetSample || (() => false);
const sharedDuplicateSubmissionKey =
  scoutingSourceUtils.duplicateSubmissionKey ||
  ((submission) => `${submission?.eventKey || ""}:${submission?.matchNumber || ""}:${submission?.teamNumber || ""}`);
const previewScoutingJsonImport = scoutingJsonImport.previewScoutingJsonImport;
const defaultRefreshPolicyForSource = sourceRefresh.defaultPolicyForSource || (() => ({ baseIntervalMs: 60 * 1000, staleAfterMs: 5 * 60 * 1000, maxBackoffMs: 20 * 60 * 1000 }));
const freshnessForSource = sourceRefresh.freshnessForSource || ((source) => source?.freshness || "unknown");
const shouldPollRefreshSource = sourceRefresh.shouldPollSource || (() => false);
const seasonBuildMetrics = seasonFramework.buildMetrics || ((eventModel) => eventModel?.metrics || []);
const seasonScouterMetricDefinitions = seasonFramework.scouterMetricDefinitions || ((eventModel) => eventModel?.scoringComponents || []);
const seasonFormulaFieldDefinitions = seasonFramework.formulaFieldDefinitions || seasonScouterMetricDefinitions;
const buildDynamicScoutingFieldDefinitions =
  dynamicScoutingFields.buildDynamicScoutingFieldDefinitions ||
  ((options = {}) => seasonFormulaFieldDefinitions(options.eventModel));
const buildScoutingDependencyDiagnostics =
  scoutingDependencyDiagnostics.buildScoutingDependencyDiagnostics ||
  (() => ({ schemaDiff: { added: [], removed: [], typeChanged: [] }, diagnostics: { roots: [], equations: [], filters: [], sortEquations: [] } }));
const buildScoutingDiagnosticsState =
  scoutingDiagnosticsState.buildScoutingDiagnosticsState ||
  ((options = {}) => ({
    committedFields: [],
    currentDiagnostics: buildScoutingDependencyDiagnostics(options),
    pendingDiagnostics: null,
  }));
const seasonDerivedMetricDefinitions = seasonFramework.derivedMetricDefinitions || (() => []);
const seasonMetricFieldId = seasonFramework.csvHeaderForMetric || ((metricDefinition) => (metricDefinition.unit === "pts" ? `${metricDefinition.id}Pts` : metricDefinition.id));
const humanizeDynamicFieldId =
  dynamicScoutingFields.humanizeFieldId ||
  ((fieldId) =>
    String(fieldId || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/[_\-\.]+/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
      .join(" "));
const sharedAdaptEventSheetCsv = sheetImportAdapters.adaptEventSheetCsv || ((eventModel, csvText) => csvText);
const sharedTranslateEventSheetToCanonical = sheetImportAdapters.translateEventSheetToCanonical || null;
const buildCanonicalSheetJsonText = sheetImportAdapters.buildCanonicalJsonText || ((dataset) => JSON.stringify(dataset || {}));
const shouldRefreshSampleBackedScoutingSubmissions =
  scoutingImportRepair.shouldRefreshSampleBackedScoutingSubmissions || (() => false);
const repairLegacySubmissionRawMetrics = scoutingImportRepair.repairLegacySubmissionRawMetrics || ((rawMetrics) => rawMetrics || {});
const stampScoutingSubmissionMetadata = scoutingImportRepair.stampScoutingSubmissionMetadata || ((submissions) => submissions || []);
const createEventWorkspace = eventWorkspaceApi.createEventWorkspace || ((eventModel) => ({ eventKey: eventModel?.key || "", season: Number(eventModel?.season || 0), identity: { key: eventModel?.key || "", name: eventModel?.name || "", seasonLabel: eventModel?.seasonLabel || "" }, sources: { tba: {}, statbotics: {}, pridge: {}, scouting: [] }, activeScoutingAttachmentId: "" }));
const markEventWorkspaceScoutingAttachmentAttempt = eventWorkspaceApi.markActiveScoutingAttachmentAttempt || ((workspace) => workspace);
const markEventWorkspaceScoutingAttachmentFailure = eventWorkspaceApi.markActiveScoutingAttachmentFailure || ((workspace) => workspace);
const markEventWorkspaceScoutingAttachmentSuccess = eventWorkspaceApi.markActiveScoutingAttachmentSuccess || ((workspace) => workspace);
const markEventWorkspaceExternalSourceAttempt = eventWorkspaceApi.markExternalSourceAttempt || ((workspace) => workspace);
const markEventWorkspaceExternalSourceFailure = eventWorkspaceApi.markExternalSourceFailure || ((workspace) => workspace);
const markEventWorkspaceExternalSourceSuccess = eventWorkspaceApi.markExternalSourceSuccess || ((workspace) => workspace);
const rebuildSampleBackedEventWorkspaceState = eventWorkspaceApi.rebuildSampleBackedScoutingState || (() => null);
const describeEventWorkspaceScoutingAttachmentLoad = eventWorkspaceApi.describeActiveScoutingAttachmentLoad || (() => ({ kind: "none", format: "", url: "", path: "", sampleKey: "", canLoad: false }));
const resolveEventWorkspaceScoutingSourceUrl =
  eventWorkspaceApi.resolveScoutingImportSourceUrl || ((_workspace, eventModel, storedUrl = "") => normalizeScoutingSourceUrl(storedUrl || eventModel?.sheet?.url || ""));
const eventWorkspaceUsesSample = eventWorkspaceApi.activeScoutingAttachmentUsesSample || (() => false);
const activeEventWorkspaceScoutingAttachment = eventWorkspaceApi.activeScoutingAttachment || (() => null);
const eventWorkspaceProfileId = eventWorkspaceApi.activeScoutingAttachmentProfileId || (() => "");
const activeEventWorkspaceScoutingAttachmentFormat = eventWorkspaceApi.activeScoutingAttachmentFormat || (() => "legacy-sheet-url");
const removeEventWorkspaceScoutingAttachment = eventWorkspaceApi.removeScoutingAttachment || ((workspace) => workspace);
const setEventWorkspaceExternalSourcePollingEnabled = eventWorkspaceApi.setExternalSourcePollingEnabled || ((workspace) => workspace);
const setEventWorkspaceScoutingAttachmentPollingEnabled = eventWorkspaceApi.setActiveScoutingAttachmentPollingEnabled || ((workspace) => workspace);
const setActiveEventWorkspaceScoutingAttachment = eventWorkspaceApi.setActiveScoutingAttachment || ((workspace) => workspace);
const setEventWorkspaceScoutingSourceLocation = eventWorkspaceApi.setScoutingSourceLocation || ((workspace) => workspace);
const setEventWorkspaceScoutingSourceUrl = eventWorkspaceApi.setScoutingSourceUrl || ((workspace) => workspace);
const shouldAutoLoadEventWorkspaceScoutingAttachment = eventWorkspaceApi.shouldAutoLoadScoutingAttachment || (() => false);
const upsertEventWorkspaceScoutingAttachment = eventWorkspaceApi.upsertScoutingAttachment || ((workspace) => workspace);
const activeEventWorkspaceScoutingAttachmentSourceValue =
  eventWorkspaceApi.activeScoutingAttachmentSourceValue || ((_workspace, eventModel) => normalizeScoutingSourceUrl(eventModel?.sheet?.url || ""));
const loadExternalEventByCode =
  externalEventLoader.loadEventByCode ||
  (async () => {
    throw new Error("External event loading is unavailable.");
  });
const normalizeExternalEventCode = externalEventLoader.normalizeEventCode || ((value) => String(value || "").trim().toLowerCase());
const buildTeamScoutingOverlay = metricEngine.buildTeamScoutingOverlay;
const engineMetricTrendValues = metricEngine.metricTrendValues;
const engineTeamMetricValue = metricEngine.teamMetricValue;
const aggregateSubmissionMatches = metricEngine.aggregateSubmissionMatches;
const evaluateDerivedMetricDefinition = metricEngine.evaluateDerivedMetricDefinition;
const evaluateFormulaExpression = metricEngine.evaluateFormulaExpression || (() => metricEngine.errorResult?.("Formula engine unavailable.") || { kind: "error", error: "Formula engine unavailable." });
const isErrorFormulaResult = metricEngine.isErrorResult || ((result) => result?.kind === "error");
const isSeriesFormulaResult = metricEngine.isSeriesResult || ((result) => result?.kind === "series");

const storageKeys = {
  user: "frc-scouting-user",
  users: "frc-scouting-users",
  theme: "frc-scouting-theme",
  activeEvent: "frc-scouting-active-event",
  activeView: "frc-scouting-view",
  metric: "frc-scouting-metric",
  analysisFilter: "frc-scouting-analysis-filter",
  teamDetailMetric: "frc-scouting-team-detail-metric",
  picklistCompareMetric: "frc-scouting-picklist-compare-metric",
  selectedTeam: "frc-scouting-selected-team",
  selectedMatch: "frc-scouting-selected-match",
  menuExpanded: "frc-scouting-menu-expanded",
  loadedPicklists: "frc-scouting-loaded-picklists",
  allianceBoard: "frc-scouting-alliance-board",
  picklists: "frc-scouting-picklists",
  activePicklist: "frc-scouting-active-picklist",
  sortEquations: "frc-scouting-sort-equations",
  activeSortEquation: "frc-scouting-active-sort-equation",
  picklistColumns: "frc-scouting-picklist-columns",
  picklistCompareTeams: "frc-scouting-picklist-compare-teams",
  scoutingSubmissions: "frc-scouting-submissions",
  scoutingReviewOverrides: "frc-scouting-review-overrides",
  activityLog: "frc-scouting-activity-log",
  importSourceUrl: "frc-scouting-import-source-url",
  scoutingWindow: "frc-scouting-window",
  recentMatchCount: "frc-scouting-recent-match-count",
  tbaAuthKey: "frc-scouting-tba-auth-key",
  seasonProfiles: "frc-scouting-season-profiles",
  seasonDerivedEquations: "frc-scouting-season-derived-equations",
  seasonFilters: "frc-scouting-season-filters",
  eventWorkspace: "frc-scouting-event-workspace",
  dynamicEvents: "frc-scouting-dynamic-events",
};

const globalStorageKeys = new Set([
  storageKeys.user,
  storageKeys.users,
  storageKeys.theme,
  storageKeys.activeEvent,
  storageKeys.menuExpanded,
  storageKeys.tbaAuthKey,
  storageKeys.seasonProfiles,
  storageKeys.seasonDerivedEquations,
  storageKeys.seasonFilters,
  storageKeys.dynamicEvents,
]);
const seedUsers = ["Avery", "Jordan", "Morgan"];
const adminUsers = ["Avery"];
const importProfileOptions = [
  { id: "", label: "Auto-detect profile" },
  { id: "match-current-v2", label: "Current Match Template" },
  { id: "match-legacy-v1", label: "Legacy Match Template" },
];

const navItems = [
  { view: "teams", label: "Teams", icon: "teams" },
  { view: "rankings", label: "Rankings", icon: "rankings" },
  { view: "schedule", label: "Match Schedule", icon: "schedule" },
  { view: "matchup", label: "Matchup", icon: "matchup" },
  { view: "quality", label: "Data Quality", icon: "quality" },
  { view: "analysis", label: "Analysis", icon: "analysis" },
  { view: "derivedBuilder", label: "Derived Equation Builder", icon: "derivedBuilder" },
  { view: "picklistBuilder", label: "Picklist Builder", icon: "picklists" },
  { view: "alliance", label: "Alliance Selection", icon: "alliance" },
  { view: "admin", label: "Admin", icon: "admin" },
];

const appViews = [...navItems, { view: "teamDetail", label: "Team Detail", icon: "teams" }];

const picklistColumnCount = 4;
const picklistCompareLimit = 4;
const protectedEpaSortId = "sort-epa";
const compareTeamPalette = ["#2563eb", "#ca8a04", "#7c3aed", "#0891b2"];

function readBootstrapStoredJson(key, fallback) {
  try {
    if (!globalThis.localStorage) return fallback;
    const raw = globalThis.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function mergePersistedDynamicEventsIntoCatalog() {
  const persistedEvents = readBootstrapStoredJson(storageKeys.dynamicEvents, []);
  if (!Array.isArray(persistedEvents) || !persistedEvents.length) return;
  const catalogKeys = new Set(globalEventCatalog.map((eventModel) => eventModel?.key));
  persistedEvents.forEach((eventModel) => {
    const eventKey = String(eventModel?.key || "").trim();
    if (!eventKey || catalogKeys.has(eventKey)) return;
    globalEventCatalog.push(eventModel);
    catalogKeys.add(eventKey);
  });
}

mergePersistedDynamicEventsIntoCatalog();

const defaultAllianceBoard = Array(24).fill(null);
const protectedEpaSortEquation = {
  id: protectedEpaSortId,
  name: "EPA",
  metricId: "source:epa:total",
  locked: true,
};

const knownImportProfileLabels = {
  "match-current-v2": "Current Match Template",
  "match-legacy-v1": "Legacy Match Template",
};

const initialEventKey = resolveEventKey(readStoredItem(storageKeys.activeEvent));
const initialEvent = eventModelByKey(initialEventKey);
const initialWorkspace = createEventWorkspace(initialEvent, readStoredJson(storageKeys.eventWorkspace, null, initialEventKey));
const state = {
  activeEventKey: initialEventKey,
  user: readStoredItem(storageKeys.user) || "",
  users: readStoredJson(storageKeys.users, seedUsers),
  theme: readStoredItem(storageKeys.theme) || "light",
  activeView: "teams",
  metric: initialEvent.defaultMetricId,
  activeAnalysisFilterId: "",
  teamDetailMetric: initialEvent.defaultTeamDetailMetricId,
  picklistCompareMetric: initialEvent.defaultTeamDetailMetricId,
  selectedTeam: initialEvent.teams[0].number,
  selectedMatch: initialEvent.matches[0].number,
  menuExpanded: readStoredItem(storageKeys.menuExpanded) === "true",
  picklists: [],
  sortEquations: [],
  loadedSources: [],
  activePicklist: "",
  activeSortEquation: "",
  picklistColumns: [],
  allianceBoard: normalizeBoard(defaultAllianceBoard, initialEvent),
  contextMenu: null,
  inlineRename: null,
  picklistSelectedTeam: null,
  picklistCompareTeams: normalizePicklistCompareTeams([], initialEvent),
  builderFocus: { sortBuilder: "list", picklistBuilder: "list", derivedBuilder: "equations" },
  scoutingSubmissions: [],
  scoutingReviewOverrides: [],
  activityLog: [],
  importCsvText: "",
  importSelectedProfileId: "",
  importDraftSource: "",
  importSourceUrl: activeEventWorkspaceScoutingAttachmentSourceValue(initialWorkspace, initialEvent),
  tbaAuthKey: readStoredItem(storageKeys.tbaAuthKey) || normalizeText(globalThis.__TBA_AUTH_KEY || globalThis.TBA_AUTH_KEY),
  importResult: null,
  scoutingWindow: readStoredItem(storageKeys.scoutingWindow) || "all",
  recentMatchCount: Math.max(1, Number(readStoredItem(storageKeys.recentMatchCount) || 12)),
  seasonDerivedEquationCatalog: normalizeSeasonDerivedEquationCatalog(
    mergeSeededSeasonCatalog(
      readStoredJson(storageKeys.seasonDerivedEquations, {}),
      seededSeasonDerivedEquations,
    ),
  ),
  seasonFilterCatalog: normalizeSeasonFilterCatalog(
    mergeSeededSeasonCatalog(
      readStoredJson(storageKeys.seasonFilters, {}),
      seededSeasonFilters,
    ),
  ),
  seasonProfileCatalog: normalizeSeasonProfileCatalog(readStoredJson(storageKeys.seasonProfiles, {})),
  activeDerivedEquationId: "",
  activeSeasonFilterId: "",
  activeDerivedPreviewMetricId: "",
  eventWorkspace: null,
  eventLookupPending: false,
  eventLookupResult: null,
  builderGridScroll: {
    derivedBuilder: { shellLeft: 0, columnTops: {} },
    filterBuilder: { shellLeft: 0, columnTops: {} },
  },
  viewHistory: [],
};
globalThis.__scoutingAppState = state;
globalThis.__scoutingActiveEventKey = state.activeEventKey;
globalThis.__TBA_AUTH_KEY = state.tbaAuthKey;
let pendingScoutingAutoloadToken = "";
let attemptedScoutingAutoloadToken = "";
const pendingExternalRefreshSourceIds = new Set();
let sourceRefreshIntervalId = null;

const app = document.querySelector("#app");
installGlobalRecoveryGuards();

function bootstrapApp() {
  try {
    hydrateEventState(state.activeEventKey);
    document.documentElement.dataset.theme = state.theme;
    renderSafely();
    maybeAutoloadScoutingAttachment();
    ensureSourceRefreshLoop();
  } catch (error) {
    console.error("App bootstrap failed before first render", error);
    state.activeView = "teams";
    state.contextMenu = null;
    state.inlineRename = null;
    try {
      document.documentElement.dataset.theme = state.theme || "light";
    } catch (themeError) {
      console.error("Failed to restore theme during recovery", themeError);
    }
    renderRecoveryScreen(error);
  }
}

function eventModelByKey(key) {
  return globalEventCatalog.find((eventModel) => eventModel.key === key) || globalEventCatalog[0];
}

function resolveEventKey(value) {
  return eventModelByKey(value).key;
}

function currentEvent() {
  return eventModelByKey(state?.activeEventKey || initialEventKey);
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function currentEventWorkspace() {
  return state?.eventWorkspace || createEventWorkspace(currentEvent());
}

function mergeProviderSourceState(currentSource = {}, nextSource = {}) {
  return {
    ...currentSource,
    ...nextSource,
    provenance: {
      ...(currentSource.provenance || {}),
      ...(nextSource.provenance || {}),
    },
  };
}

function currentDynamicEvents() {
  return globalEventCatalog.filter((eventModel) => eventModel?.catalogSource === "dynamic-external");
}

function persistDynamicEvents() {
  localStorage.setItem(eventStorageKey(storageKeys.dynamicEvents), JSON.stringify(currentDynamicEvents()));
}

function registerEventModel(eventModel) {
  const eventKey = normalizeText(eventModel?.key);
  if (!eventKey) return null;
  const existingIndex = globalEventCatalog.findIndex((candidate) => candidate?.key === eventKey);
  if (existingIndex >= 0) {
    globalEventCatalog.splice(existingIndex, 1, eventModel);
  } else {
    globalEventCatalog.push(eventModel);
  }
  persistDynamicEvents();
  return eventModelByKey(eventKey);
}

function applyLoadedExternalSourceState(loadResult, options = {}) {
  const eventModel = loadResult?.eventModel || currentEvent();
  const eventKey = normalizeText(eventModel?.key) || state.activeEventKey;
  const storedWorkspace = readStoredJson(storageKeys.eventWorkspace, null, eventKey);
  const seededWorkspace = createEventWorkspace(eventModel, storedWorkspace);
  const nextSources = { ...(seededWorkspace.sources || {}) };
  Object.entries(loadResult?.sourceStates || {}).forEach(([sourceId, sourceState]) => {
    nextSources[sourceId] = mergeProviderSourceState(nextSources[sourceId], sourceState);
  });
  state.eventWorkspace = {
    ...seededWorkspace,
    sources: nextSources,
  };
  state.importSourceUrl = currentScoutingSourceInputValue(
    state.eventWorkspace,
    eventModel,
    readStoredItem(storageKeys.importSourceUrl, eventKey),
  );
  if (Array.isArray(loadResult?.warnings) && loadResult.warnings.length) {
    loadResult.warnings.forEach((warning) => pushActivity(warning));
  }
  saveState();
  if (options.render !== false) render();
}

function currentScoutingAttachment() {
  return activeEventWorkspaceScoutingAttachment(currentEventWorkspace());
}

function currentScoutingSourceInputValue(workspace = currentEventWorkspace(), eventModel = currentEvent(), storedValue = state.importSourceUrl) {
  const normalizedStored = normalizeText(storedValue);
  if (normalizedStored) return normalizedStored;
  return activeEventWorkspaceScoutingAttachmentSourceValue(workspace, eventModel);
}

function currentScoutingSourceUrl() {
  return normalizeScoutingSourceUrl(resolveEventWorkspaceScoutingSourceUrl(currentEventWorkspace(), currentEvent(), state.importSourceUrl));
}

function setCurrentScoutingSourceUrl(url, options = {}) {
  const normalizedUrl = normalizeScoutingSourceUrl(url);
  state.importSourceUrl = normalizedUrl;
  state.eventWorkspace = setEventWorkspaceScoutingSourceLocation(currentEventWorkspace(), normalizedUrl);
  if (options.save) saveState();
}

function inferredScoutingAttachmentFormat(currentFormat, source) {
  const normalizedSource = normalizeScoutingSourceUrl(source).split(/[?#]/)[0];
  const normalizedFormat = normalizeText(currentFormat).toLowerCase();
  if (/\.json$/i.test(normalizedSource)) return "scouting-json";
  if (/\.(csv|tsv|txt)$/i.test(normalizedSource)) return "legacy-sheet-csv";
  if (/\/spreadsheets\/d\/[a-zA-Z0-9-_]+/.test(normalizedSource)) return "legacy-sheet-url";
  return normalizedFormat || "scouting-json";
}

function inferredScoutingTranslatorId(currentTranslatorId, format) {
  const normalizedTranslatorId = normalizeText(currentTranslatorId);
  const normalizedFormat = normalizeText(format);
  const defaultLegacyTranslatorIds = new Set(["", "match-current-v2", "match-legacy-v1"]);
  if (normalizedFormat === "scouting-json") {
    if (defaultLegacyTranslatorIds.has(normalizedTranslatorId) || normalizedTranslatorId === "canonical-json-v1") {
      return "canonical-json-v1";
    }
    return normalizedTranslatorId;
  }
  if (!normalizedTranslatorId || normalizedTranslatorId === "canonical-json-v1") {
    return "match-current-v2";
  }
  return normalizedTranslatorId;
}

function setTbaAuthKey(value, options = {}) {
  state.tbaAuthKey = normalizeText(value);
  globalThis.__TBA_AUTH_KEY = state.tbaAuthKey;
  if (options.save) saveState();
}

function buildScoutingSourceFingerprint(text) {
  const input = String(text || "");
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}:${input.length}`;
}

function currentScoutingAttachmentFingerprint() {
  return normalizeText(currentScoutingAttachment()?.sourceFingerprint);
}

function currentExternalSourceFingerprint(sourceId) {
  return normalizeText(currentEventWorkspace()?.sources?.[sourceId]?.sourceFingerprint);
}

function shouldSkipUnchangedAttachedSource(text, options = {}) {
  if (!options.skipUnchanged) return false;
  if (state.importDraftSource !== "attached" && options.importDraftSource !== "attached") return false;
  return currentScoutingAttachmentFingerprint() === buildScoutingSourceFingerprint(text);
}

function markCurrentScoutingAttachmentAttempt(update = {}) {
  state.eventWorkspace = markEventWorkspaceScoutingAttachmentAttempt(currentEventWorkspace(), update);
}

function markCurrentScoutingAttachmentFailure(message, update = {}) {
  state.eventWorkspace = markEventWorkspaceScoutingAttachmentFailure(currentEventWorkspace(), {
    ...update,
    error: message,
  });
}

function markCurrentScoutingAttachmentSuccess(preview, csvText, update = {}) {
  state.eventWorkspace = markEventWorkspaceScoutingAttachmentSuccess(currentEventWorkspace(), {
    ...update,
    schemaSignature: preview?.summary?.metadata?.schemaId || preview?.summary?.metadata?.schemaVersion || preview?.summary?.profileId || "",
    translatorVersion: preview?.summary?.metadata?.translationVersion || "",
    sourceFingerprint: buildScoutingSourceFingerprint(csvText),
  });
}

function markExternalSourceAttempt(sourceId, update = {}) {
  state.eventWorkspace = markEventWorkspaceExternalSourceAttempt(currentEventWorkspace(), sourceId, update);
}

function markExternalSourceSuccess(sourceId, update = {}) {
  state.eventWorkspace = markEventWorkspaceExternalSourceSuccess(currentEventWorkspace(), sourceId, update);
}

function markExternalSourceFailure(sourceId, message, update = {}) {
  state.eventWorkspace = markEventWorkspaceExternalSourceFailure(currentEventWorkspace(), sourceId, {
    ...update,
    error: message,
  });
}

function maybeAutoloadScoutingAttachment() {
  const eventModel = currentEvent();
  const attachmentId = currentScoutingAttachment()?.attachmentId || "";
  const autoloadToken = `${eventModel.key}:${attachmentId}`;
  if (!shouldAutoLoadEventWorkspaceScoutingAttachment(currentEventWorkspace(), eventModel, state.scoutingSubmissions)) return;
  if (attemptedScoutingAutoloadToken === autoloadToken) return;
  if (pendingScoutingAutoloadToken === autoloadToken) return;
  pendingScoutingAutoloadToken = autoloadToken;
  attemptedScoutingAutoloadToken = autoloadToken;
  Promise.resolve(loadScoutingData({ autoCommit: true, scoutingImportSource: "attached-autoload" }))
    .catch((error) => {
      console.error("Automatic scouting attachment load failed", eventModel.key, error);
    })
    .finally(() => {
      if (pendingScoutingAutoloadToken === autoloadToken) pendingScoutingAutoloadToken = "";
    });
}

function maybePollActiveScoutingAttachment() {
  const eventModel = currentEvent();
  const attachment = currentScoutingAttachment();
  if (!attachment?.attachmentId || attachment.pollingEnabled === false) return;
  if (pendingScoutingAutoloadToken === `${eventModel.key}:${attachment.attachmentId}`) return;
  const policy = defaultRefreshPolicyForSource({ kind: "scouting", sourceId: attachment.attachmentId });
  if (!shouldPollRefreshSource(attachment, policy, Date.now())) return;
  const pollToken = `${eventModel.key}:${attachment.attachmentId}`;
  pendingScoutingAutoloadToken = pollToken;
  Promise.resolve(loadScoutingData({ autoCommit: true, scoutingImportSource: "poll-refresh", skipUnchanged: true, importDraftSource: "attached" }))
    .catch((error) => {
      console.error("Polling scouting attachment failed", eventModel.key, error);
    })
    .finally(() => {
      if (pendingScoutingAutoloadToken === pollToken) pendingScoutingAutoloadToken = "";
    });
}

function maybePollExternalSources() {
  if (currentEvent()?.catalogSource === "dynamic-external") return;
  const workspace = currentEventWorkspace();
  ["tba", "statbotics", "pridge"].forEach((sourceId) => {
    const source = workspace.sources?.[sourceId];
    if (!source || source.pollingEnabled === false || pendingExternalRefreshSourceIds.has(sourceId)) return;
    const policy = defaultRefreshPolicyForSource({ kind: "external", sourceId });
    if (!shouldPollRefreshSource(source, policy, Date.now())) return;
    pendingExternalRefreshSourceIds.add(sourceId);
    Promise.resolve(refreshDataSource(sourceId, { trigger: "poll" }))
      .catch((error) => {
        console.error("Polling external source failed", sourceId, error);
        markExternalSourceFailure(sourceId, error?.message || `Unable to refresh ${sourceId}.`);
        saveState();
        render();
      })
      .finally(() => {
        pendingExternalRefreshSourceIds.delete(sourceId);
      });
  });
}

function ensureSourceRefreshLoop() {
  if (sourceRefreshIntervalId !== null) return;
  sourceRefreshIntervalId = globalThis.setInterval(() => {
    maybePollActiveScoutingAttachment();
    maybePollExternalSources();
  }, 30000);
}

async function refreshDataSource(sourceId, options = {}) {
  if (sourceId === "scouting") {
    saveCurrentScoutingAttachmentDraftFromDom({ render: false });
    await loadScoutingData({ autoCommit: true, scoutingImportSource: "manual-refresh", skipUnchanged: true, importDraftSource: "attached" });
    return;
  }
  if (currentEvent()?.catalogSource === "dynamic-external") {
    await loadArbitraryEventCode(currentEvent().key, {
      activeView: state.activeView,
    });
    return;
  }
  const event = currentEvent();
  const label = { tba: "The Blue Alliance", statbotics: "Statbotics EPA", pridge: "pRidge" }[sourceId] || sourceId;
  const trigger = options.trigger || "manual";
  const snapshot = buildExternalSourceSnapshot(sourceId, event);
  const nextFingerprint = buildExternalSnapshotFingerprint(snapshot);
  const didChange = nextFingerprint !== currentExternalSourceFingerprint(sourceId);
  markExternalSourceAttempt(sourceId);
  markExternalSourceSuccess(sourceId, {
    sourceFingerprint: nextFingerprint,
    provenance: {
      mode: "local-snapshot",
      notes: didChange
        ? `${label} snapshot changed and was reloaded from the current local event model.`
        : `${label} refresh checked the current local event snapshot and found no content changes.`,
    },
  });
  if (didChange) {
    pushActivity(`Updated ${label} for ${event.name} from the current local snapshot.`);
  } else if (trigger === "manual") {
    pushActivity(`Checked ${label} for ${event.name}. No snapshot changes detected.`);
  }
  saveState();
  render();
}

async function refreshAllDataSources() {
  for (const sourceId of ["scouting", "tba", "statbotics", "pridge"]) {
    await refreshDataSource(sourceId);
  }
}

function setDataSourcePollingEnabled(sourceId, pollingEnabled) {
  if (sourceId === "scouting") {
    state.eventWorkspace = setEventWorkspaceScoutingAttachmentPollingEnabled(currentEventWorkspace(), pollingEnabled);
  } else {
    state.eventWorkspace = setEventWorkspaceExternalSourcePollingEnabled(currentEventWorkspace(), sourceId, pollingEnabled);
  }
  saveState();
  render();
}

function setCurrentScoutingAttachment(attachmentId) {
  state.eventWorkspace = setActiveEventWorkspaceScoutingAttachment(currentEventWorkspace(), attachmentId);
  state.importSourceUrl = activeEventWorkspaceScoutingAttachmentSourceValue(state.eventWorkspace, currentEvent());
  state.importDraftSource = "";
  state.importResult = null;
  saveState();
  render();
}

function saveCurrentScoutingAttachmentDraft(draft, options = {}) {
  const activeAttachment = currentScoutingAttachment();
  if (!activeAttachment) return;
  const normalizedSource = normalizeScoutingSourceUrl(draft.source);
  const normalizedFormat = inferredScoutingAttachmentFormat(
    normalizeText(draft.format) || activeEventWorkspaceScoutingAttachmentFormat(currentEventWorkspace(), currentEvent()),
    normalizedSource,
  );
  const isRemoteSource = /^https?:\/\//i.test(normalizedSource);
  state.eventWorkspace = upsertEventWorkspaceScoutingAttachment(
    currentEventWorkspace(),
    {
      ...activeAttachment,
      label: normalizeText(draft.label) || activeAttachment.label,
      format: normalizedFormat,
      locationKind: normalizedSource ? (isRemoteSource ? "url" : "path") : activeAttachment.locationKind,
      location: {
        ...(activeAttachment.location || {}),
        url: isRemoteSource ? normalizedSource : "",
        path: normalizedSource && !isRemoteSource ? normalizedSource : "",
      },
      translatorId: inferredScoutingTranslatorId(normalizeText(draft.translatorId) || activeAttachment.translatorId, normalizedFormat),
      autoLoad: Boolean(draft.autoLoad),
    },
    currentEvent(),
  );
  state.importSourceUrl = currentScoutingSourceInputValue();
  state.importDraftSource = "";
  state.importResult = null;
  saveState();
  if (options.render !== false) render();
}

function addScoutingAttachmentDraft() {
  const event = currentEvent();
  const defaultLabel = `${event.name} Attachment ${currentEventWorkspace().sources?.scouting?.length || 1}`;
  state.eventWorkspace = upsertEventWorkspaceScoutingAttachment(
    currentEventWorkspace(),
    {
      attachmentId: createId("scouting"),
      eventKey: event.key,
      label: defaultLabel,
      format: "scouting-json",
      locationKind: "url",
      location: { url: "" },
      translatorId: "canonical-json-v1",
      status: "manual",
      freshness: "unknown",
      autoLoad: false,
    },
    event,
  );
  state.importSourceUrl = currentScoutingSourceInputValue();
  state.importDraftSource = "";
  state.importResult = null;
  saveState();
  render();
}

async function chooseLocalScoutingAttachmentFile() {
  const attachment = currentScoutingAttachment();
  if (!attachment?.attachmentId) return;
  const draft = readCurrentScoutingAttachmentDraftFromDom();
  const selectedFormat = inferredScoutingAttachmentFormat(
    normalizeText(draft.format) || activeEventWorkspaceScoutingAttachmentFormat(currentEventWorkspace(), currentEvent()),
    normalizeText(draft.source) || attachment.location?.path,
  );
  if (!localAttachmentFilesSupported()) {
    setImportError("Local scouting file selection is unavailable in this browser. Paste a URL/path instead, or use a browser that supports the File System Access API.");
    return;
  }
  try {
    const selected = await pickLocalAttachmentFile({
      attachmentId: attachment.attachmentId,
      format: selectedFormat,
      path: normalizeText(draft.source) || attachment.location?.path,
    });
    saveCurrentScoutingAttachmentDraft(
      {
        ...draft,
        label: normalizeText(draft.label) || attachment.label,
        format: selectedFormat,
        translatorId: inferredScoutingTranslatorId(normalizeText(draft.translatorId) || attachment.translatorId, selectedFormat),
        source: selected.path,
        autoLoad: true,
      },
      { render: false },
    );
    state.importResult = {
      ok: true,
      errors: [],
      warnings: [`Bound local scouting file ${selected.path} to ${attachment.label || attachment.attachmentId}. Click Load Scouting Data to import it.`],
      summary: null,
    };
    pushActivity(`Bound local scouting file ${selected.path} to ${attachment.label || attachment.attachmentId}.`);
    saveState();
    render();
  } catch (error) {
    markCurrentScoutingAttachmentFailure(error?.message || "Unable to bind a local scouting file.");
    setImportError(`Unable to bind a local scouting file. ${error?.message || "Try again or use a remote source instead."}`);
  }
}

async function deleteScoutingAttachment(attachmentId) {
  await clearLocalAttachmentFile(attachmentId).catch(() => {});
  state.eventWorkspace = removeEventWorkspaceScoutingAttachment(currentEventWorkspace(), attachmentId);
  state.importSourceUrl = currentScoutingSourceInputValue();
  state.importDraftSource = "";
  state.importResult = null;
  saveState();
  render();
}

function readCurrentScoutingAttachmentDraftFromDom() {
  const source = document.querySelector("#importSourceUrl")?.value;
  const inferredFormat = inferredScoutingAttachmentFormat(document.querySelector("#scoutingAttachmentFormatSelect")?.value, source);
  return {
    label: document.querySelector("#scoutingAttachmentLabel")?.value,
    format: inferredFormat,
    translatorId: inferredScoutingTranslatorId(document.querySelector("#scoutingAttachmentTranslatorId")?.value, inferredFormat),
    source,
    autoLoad: document.querySelector("#scoutingAttachmentAutoLoad")?.checked,
  };
}

function syncScoutingAttachmentInferenceFromDom() {
  const sourceInput = document.querySelector("#importSourceUrl");
  const formatSelect = document.querySelector("#scoutingAttachmentFormatSelect");
  const translatorInput = document.querySelector("#scoutingAttachmentTranslatorId");
  if (!sourceInput || !formatSelect || !translatorInput) return;
  const inferredFormat = inferredScoutingAttachmentFormat(formatSelect.value, sourceInput.value);
  formatSelect.value = inferredFormat;
  if (!normalizeText(translatorInput.value)) {
    translatorInput.value = inferredScoutingTranslatorId("", inferredFormat);
  }
}

function saveCurrentScoutingAttachmentDraftFromDom(options = {}) {
  saveCurrentScoutingAttachmentDraft(readCurrentScoutingAttachmentDraftFromDom(), options);
}

function currentScoutingSubmissions() {
  const overrideMap = activeScoutingReviewOverrideMap();
  return currentRawScoutingSubmissions().map((submission) => applyScoutingReviewOverride(submission, overrideMap));
}

function currentRawScoutingSubmissions() {
  const allSubmissions = Array.isArray(state.scoutingSubmissions) ? state.scoutingSubmissions : [];
  return allSubmissions.filter((submission) => submission.eventKey === state.activeEventKey);
}

function currentTeams() {
  return currentEvent().teams.map((team) => overlayTeamWithScouting(team));
}

function currentMatches() {
  return currentEvent().matches;
}

function currentMetrics() {
  const eventModel = {
    ...currentEvent(),
    derivedMetricDefinitions: currentDerivedMetricDefinitions(),
  };
  return [
    ...seasonBuildMetrics(eventModel),
    ...currentDynamicTbaMetricDefinitions(eventModel),
  ];
}

function currentDataSources() {
  const event = currentEvent();
  const workspace = currentEventWorkspace();
  const now = Date.now();
  const externalSources = [
    { sourceId: "tba", label: "The Blue Alliance" },
    { sourceId: "statbotics", label: "Statbotics EPA" },
    { sourceId: "pridge", label: "pRidge" },
  ].map((definition) => {
    const sourceState = workspace.sources?.[definition.sourceId] || {};
    const policy = defaultRefreshPolicyForSource({ kind: "external", sourceId: definition.sourceId });
    const dataSourceNote = (event.dataSources || []).find((source) => String(source.name || "").includes(definition.label)) || {};
    return {
      sourceId: definition.sourceId,
      name: definition.label,
      status: sourceState.status || dataSourceNote.status || "ready",
      updated: sourceState.lastSuccessfulAt ? formatTimestamp(sourceState.lastSuccessfulAt) : (dataSourceNote.updated || "Pending"),
      freshness: freshnessForSource(sourceState, policy, now),
      notes: sourceState.error || sourceState.provenance?.notes || dataSourceNote.notes || "",
      kind: "external",
      nextPollAt: sourceState.nextPollAt ? formatTimestamp(sourceState.nextPollAt) : "Pending",
      pollingEnabled: sourceState.pollingEnabled !== false,
    };
  });
  const activeAttachment = currentScoutingAttachment();
  const scoutingPolicy = defaultRefreshPolicyForSource({ kind: "scouting", sourceId: activeAttachment?.attachmentId });
  return [
    {
      sourceId: "scouting",
      name: activeAttachment?.label || "Scouting Attachment",
      status: activeAttachment?.status || "manual",
      updated: activeAttachment?.lastSuccessfulAt ? formatTimestamp(activeAttachment.lastSuccessfulAt) : "Pending",
      freshness: freshnessForSource(activeAttachment || {}, scoutingPolicy, now),
      notes: activeAttachment?.error || currentScoutingSourceUrl() || "No attachment source configured.",
      kind: "scouting",
      nextPollAt: activeAttachment?.nextPollAt ? formatTimestamp(activeAttachment.nextPollAt) : "Pending",
      pollingEnabled: activeAttachment?.pollingEnabled !== false,
    },
    ...externalSources,
  ];
}

function currentScouterMetricDefinitions(eventModel = currentEvent()) {
  return seasonScouterMetricDefinitions(eventModel);
}

function currentFormulaFieldDefinitions(eventModel = currentEvent()) {
  return buildDynamicScoutingFieldDefinitions({
    eventModel,
    submissions: currentScoutingSubmissions(),
  });
}

function currentAtomicScouterMetricDefinitions(eventModel = currentEvent()) {
  const seasonDefinition = currentSeasonDefinition(eventModel);
  if (Array.isArray(seasonDefinition?.scouterMetrics) && seasonDefinition.scouterMetrics.length) {
    return seasonDefinition.scouterMetrics;
  }
  const scoringComponentIds = new Set((eventModel?.scoringComponents || []).map((component) => component.id));
  return currentScouterMetricDefinitions(eventModel).filter((metricDefinition) => !scoringComponentIds.has(metricDefinition.id));
}

function currentAvailableScoutingFieldDefinitions(eventModel = currentEvent()) {
  const scoringComponentIds = new Set((eventModel?.scoringComponents || []).map((component) => component.id));
  return currentFormulaFieldDefinitions(eventModel).filter((fieldDefinition) => !scoringComponentIds.has(fieldDefinition.id));
}

function importedProfileScopeKey(eventModel = currentEvent()) {
  const appState = globalThis.__scoutingAppState;
  if (!appState?.activeEventKey) return "";
  const importedProfileIds = uniqueValues(
    (appState.scoutingSubmissions || [])
      .filter((submission) => submission.eventKey === appState.activeEventKey)
      .map((submission) => String(submission?.templateProfileId || "").trim())
      .filter(Boolean),
  );
  if (importedProfileIds.length === 1) return importedProfileIds[0];
  if (appState.importResult?.summary?.profileId) return String(appState.importResult.summary.profileId);
  return "";
}

function currentProfileMetricScopeKey(eventModel = currentEvent()) {
  return importedProfileScopeKey(eventModel) || eventModel.sheet?.recommendedProfileId || "match-current-v2";
}

function currentSeasonDerivedEquationDefinitions(eventModel = currentEvent()) {
  return (state.seasonDerivedEquationCatalog?.seasons?.[String(eventModel.season)] || []).map((definition) => ({
    id: definition.id,
    label: definition.name,
    unit: definition.unit || "pts",
    expression: definition.formula,
    formula: "expression",
    source: "season_equation",
  }));
}

function currentDerivedMetricDefinitions(eventModel = currentEvent()) {
  return [...seasonDerivedMetricDefinitions(eventModel), ...currentSeasonDerivedEquationDefinitions(eventModel)];
}

function currentScoutingDiagnosticsState() {
  const committedSignature = normalizeText(state.scoutingSubmissions.find((submission) => submission?.eventKey === state.activeEventKey)?.scoutingSchemaSignature);
  const currentFieldDefinitions = currentAvailableScoutingFieldDefinitions();
  const previewFieldDefinitions = Array.isArray(state.importResult?.summary?.schemaFields)
    ? state.importResult.summary.schemaFields
    : [];
  return buildScoutingDiagnosticsState({
    committedSchemaSignature: committedSignature,
    currentFieldDefinitions,
    previewFieldDefinitions,
    equations: currentSeasonEquationList(),
    filters: currentSeasonFilterList(),
    sortEquations: state.sortEquations.filter((equation) => !isProtectedSortEquation(equation)),
  });
}

function currentRankableMetrics(eventModel = currentEvent()) {
  const previewTeam = eventModel.teams[0];
  return currentMetrics().filter((metric) => {
    if (!metric) return false;
    if (metric.kind === "derived" && metric.definition?.expression) {
      const evaluation = evaluateEquationForTeam(previewTeam, metric.componentId, { eventModel });
      return !isErrorFormulaResult(evaluation.result) && evaluation.result.granularity === "event" && Number.isFinite(Number(evaluation.result.value));
    }
    const value = teamMetricValue(previewTeam, metric);
    return Number.isFinite(Number(value));
  });
}

function currentSeasonEquationList(eventModel = currentEvent()) {
  return [...(state.seasonDerivedEquationCatalog?.seasons?.[String(eventModel.season)] || [])]
    .sort((left, right) => Number(left.sourceOrder || 0) - Number(right.sourceOrder || 0) || left.name.localeCompare(right.name));
}

function currentSeasonFilterList(eventModel = currentEvent()) {
  return [...(state.seasonFilterCatalog?.seasons?.[String(eventModel.season)] || [])]
    .sort((left, right) => Number(left.sourceOrder || 0) - Number(right.sourceOrder || 0) || left.name.localeCompare(right.name));
}

function equationDefinitionById(id, eventModel = currentEvent()) {
  return currentSeasonEquationList(eventModel).find((definition) => definition.id === id) || null;
}

function seasonFilterDefinitionById(id, eventModel = currentEvent()) {
  return currentSeasonFilterList(eventModel).find((definition) => definition.id === id) || null;
}

function sanitizeFormulaReferenceToken(value) {
  const trimmed = String(value || "").trim();
  const normalized = trimmed
    .trim()
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!normalized) return "filter";
  if (/^[A-Za-z_]/.test(normalized)) return normalized;
  return `_${normalized}`;
}

function seasonFilterReferenceEntries(eventModel = currentEvent()) {
  const counts = new Map();
  return currentSeasonFilterList(eventModel).map((definition) => {
    const baseToken = sanitizeFormulaReferenceToken(definition.id || definition.name);
    const nextCount = (counts.get(baseToken) || 0) + 1;
    counts.set(baseToken, nextCount);
    return {
      token: `filter.${nextCount === 1 ? baseToken : `${baseToken}_${nextCount}`}`,
      definition,
    };
  });
}

function seasonFilterDefinitionByReference(reference, eventModel = currentEvent()) {
  const normalizedReference = String(reference || "").toLowerCase();
  return seasonFilterReferenceEntries(eventModel).find((entry) => entry.token.toLowerCase() === normalizedReference)?.definition || null;
}

function ensureActiveDerivedEquation(eventModel = currentEvent()) {
  const definitions = currentSeasonEquationList(eventModel);
  if (definitions.some((definition) => definition.id === state.activeDerivedEquationId)) return state.activeDerivedEquationId;
  state.activeDerivedEquationId = definitions[0]?.id || "";
  return state.activeDerivedEquationId;
}

function activeDerivedEquation(eventModel = currentEvent()) {
  return equationDefinitionById(ensureActiveDerivedEquation(eventModel), eventModel);
}

function currentDerivedAvailableMetrics(eventModel = currentEvent(), activeEquation = activeDerivedEquation(eventModel)) {
  return [
    { id: "scouting.total" },
    ...currentAvailableScoutingFieldDefinitions(eventModel).map((metricDefinition) => ({ id: `scouting.${metricDefinition.id}` })),
    ...currentAvailableTbaFormulaIdentifiers(eventModel).map((id) => ({ id })),
    ...eventModel.scoringComponents.map((component) => ({ id: `statbotics.${component.id}` })),
    { id: "statbotics.total" },
    { id: "pridge.total" },
    ...currentSeasonEquationList(eventModel).filter((definition) => definition.id !== activeEquation?.id).map((definition) => ({ id: definition.id })),
  ];
}

function ensureActiveSeasonFilter(eventModel = currentEvent()) {
  const definitions = currentSeasonFilterList(eventModel);
  if (definitions.some((definition) => definition.id === state.activeSeasonFilterId)) return state.activeSeasonFilterId;
  state.activeSeasonFilterId = definitions[0]?.id || "";
  return state.activeSeasonFilterId;
}

function activeSeasonFilter(eventModel = currentEvent()) {
  return seasonFilterDefinitionById(ensureActiveSeasonFilter(eventModel), eventModel);
}

function activeAnalysisFilter(eventModel = currentEvent()) {
  return seasonFilterDefinitionById(state.activeAnalysisFilterId, eventModel);
}

const tbaMatchMetricsCache = new WeakMap();
const tbaMetricDefinitionCache = new WeakMap();

function scalarTbaValue(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "number" || typeof value === "string") return value;
  return null;
}

function identifierTokens(value) {
  return String(value || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/[_\-\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function camelCaseSegment(value) {
  return identifierTokens(value)
    .map((token, index) => {
      const lower = token.toLowerCase();
      if (index === 0) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join("");
}

function flattenTbaScalarEntries(value, prefix = "") {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => flattenTbaScalarEntries(entry, prefix ? `${prefix}.${index}` : String(index)));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, entryValue]) => {
      const segment = camelCaseSegment(key);
      if (!segment) return [];
      return flattenTbaScalarEntries(entryValue, prefix ? `${prefix}.${segment}` : segment);
    });
  }
  const scalar = scalarTbaValue(value);
  return prefix && scalar !== null ? [[prefix, scalar]] : [];
}

function tbaMatchMetricsByTeam(teamNumber, eventModel = currentEvent()) {
  if (!tbaMatchMetricsCache.has(eventModel)) {
    tbaMatchMetricsCache.set(eventModel, new Map());
  }
  const cache = tbaMatchMetricsCache.get(eventModel);
  const normalizedTeamNumber = Number(teamNumber);
  if (!cache.has(normalizedTeamNumber)) {
    cache.set(
      normalizedTeamNumber,
      (eventModel.matches || [])
        .filter((match) => match.red.includes(normalizedTeamNumber) || match.blue.includes(normalizedTeamNumber))
        .map((match) => {
          const allianceKey = match.red.includes(normalizedTeamNumber) ? "red" : "blue";
          const breakdown = match.scoreBreakdown?.[allianceKey] || null;
          const flattenedBreakdown = Object.fromEntries(flattenTbaScalarEntries(breakdown || {}));
          return {
            matchNumber: match.number,
            allianceKey,
            allianceTeams: allianceKey === "red" ? match.red : match.blue,
            allTeams: [...match.red, ...match.blue],
            ...flattenedBreakdown,
          };
        })
        .sort((left, right) => left.matchNumber - right.matchNumber),
    );
  }
  return cache.get(normalizedTeamNumber);
}

function collectTbaMetricDefinitions(eventModel = currentEvent()) {
  if (tbaMetricDefinitionCache.has(eventModel)) return tbaMetricDefinitionCache.get(eventModel);

  const eventDefinitions = new Map();
  const matchDefinitions = new Map();
  const internalMatchFields = new Set(["matchNumber", "allianceKey", "allianceTeams", "allTeams"]);
  const addDefinition = (bucket, fieldId, value, granularity) => {
    const sampleValue = scalarTbaValue(value);
    if (!fieldId || sampleValue === null) return;
    if (!bucket.has(fieldId)) bucket.set(fieldId, []);
    bucket.get(fieldId).push(sampleValue);
  };

  (eventModel.teams || []).forEach((team) => {
    Object.entries(team?.sources?.tba?.components || {}).forEach(([fieldId, value]) => {
      addDefinition(eventDefinitions, fieldId, value, "event");
    });
    tbaMatchMetricsByTeam(team.number, eventModel).forEach((matchMetrics) => {
      Object.entries(matchMetrics || {}).forEach(([fieldId, value]) => {
        if (internalMatchFields.has(fieldId)) return;
        addDefinition(matchDefinitions, fieldId, value, "match");
      });
    });
  });

  const buildDefinition = (fieldId, samples, granularity) => {
    const nonEmptySamples = (samples || []).filter((value) => value !== "");
    const allNumeric = nonEmptySamples.length > 0 && nonEmptySamples.every((value) => Number.isFinite(Number(value)));
    const type = allNumeric ? "number" : "string";
    const normalizedFieldId = String(fieldId || "");
    const lowerFieldId = normalizedFieldId.toLowerCase();
    const unit = type !== "number"
      ? "text"
      : /pct|percent|percentage|accuracy/.test(lowerFieldId)
        ? "%"
        : /score|point|opr|dpr|ccwm|rps/.test(lowerFieldId)
          ? "pts"
          : "count";
    return {
      id: `tba.${normalizedFieldId}`,
      fieldId: normalizedFieldId,
      label: `TBA ${humanizeDynamicFieldId(normalizedFieldId)}`,
      shortLabel: humanizeDynamicFieldId(normalizedFieldId),
      granularity,
      type,
      unit,
    };
  };

  const formulaDefinitions = [
    ...[...eventDefinitions.entries()].map(([fieldId, samples]) => buildDefinition(fieldId, samples, "event")),
    ...[...matchDefinitions.entries()].map(([fieldId, samples]) => buildDefinition(fieldId, samples, "match")),
  ].sort((left, right) => left.id.localeCompare(right.id));

  const metricDefinitions = formulaDefinitions
    .filter((definition) => definition.type === "number")
    .filter((definition) => definition.fieldId !== "opr.total")
    .map((definition) => ({
      id: `source:tba:${definition.fieldId}`,
      kind: "source",
      sourceId: "tba",
      componentId: definition.fieldId,
      label: definition.label,
      shortLabel: definition.shortLabel,
      unit: definition.unit,
      granularity: definition.granularity,
    }));

  const result = { formulaDefinitions, metricDefinitions };
  tbaMetricDefinitionCache.set(eventModel, result);
  return result;
}

function currentAvailableTbaFormulaIdentifiers(eventModel = currentEvent()) {
  return collectTbaMetricDefinitions(eventModel).formulaDefinitions.map((definition) => definition.id);
}

function currentDynamicTbaMetricDefinitions(eventModel = currentEvent()) {
  return collectTbaMetricDefinitions(eventModel).metricDefinitions;
}

function preferredFormulaSubmission(submissions, scouterMetricIds = []) {
  const metricIds = Array.isArray(scouterMetricIds) ? scouterMetricIds : [];
  const usable = (submissions || [])
    .filter((submission) => submission?.validity !== "excluded");
  if (!usable.length) return null;
  const scoreSubmission = (submission) => {
    const validityRank = submission?.validity === "valid" ? 2 : 1;
    const noShowPenalty = Number(submission?.rawMetrics?.noShow || 0) > 0 ? 0 : 1;
    const populatedMetricCount = metricIds.filter((metricId) => {
      const value = submission?.rawMetrics?.[metricId];
      return value !== null && value !== undefined && value !== "";
    }).length;
    return validityRank * 100000 + noShowPenalty * 10000 + populatedMetricCount;
  };
  return usable
    .slice()
    .sort((left, right) => scoreSubmission(right) - scoreSubmission(left))
    [0] || null;
}

function buildFormulaScoutingMatches(submissions, scoringComponents, scouterMetricIds) {
  const grouped = new Map();
  (submissions || []).forEach((submission) => {
    const matchNumber = Number(submission?.matchNumber);
    if (!Number.isFinite(matchNumber) || submission?.validity === "excluded") return;
    if (!grouped.has(matchNumber)) grouped.set(matchNumber, []);
    grouped.get(matchNumber).push(submission);
  });
  return [...grouped.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([matchNumber, matchSubmissions]) => {
      const selectedSubmission = preferredFormulaSubmission(matchSubmissions, scouterMetricIds);
      const components = Object.fromEntries(
        scouterMetricIds.map((componentId) => {
          const value = selectedSubmission?.rawMetrics?.[componentId];
          const numeric = Number(value);
          return [componentId, Number.isFinite(numeric) ? numeric : 0];
        }),
      );
      const total = scoringComponents.reduce((sum, componentId) => sum + Number(components[componentId] || 0), 0);
      return {
        matchNumber,
        submissions: matchSubmissions,
        selectedSubmission,
        components,
        total,
      };
    });
}

const formulaSubmissionTeamCache = new WeakMap();
const teamFormulaContextCache = new WeakMap();

function formulaSubmissionsForTeam(teamNumber, submissions) {
  const source = Array.isArray(submissions) ? submissions : [];
  if (!formulaSubmissionTeamCache.has(source)) {
    formulaSubmissionTeamCache.set(source, new Map());
  }
  const cache = formulaSubmissionTeamCache.get(source);
  const normalizedTeamNumber = Number(teamNumber);
  if (!cache.has(normalizedTeamNumber)) {
    cache.set(
      normalizedTeamNumber,
      source.filter((submission) => Number(submission.teamNumber) === normalizedTeamNumber),
    );
  }
  return cache.get(normalizedTeamNumber);
}

function buildTeamFormulaContext(team, eventModel = currentEvent()) {
  const baseTeam = team?.number ? team : eventModel.teams.find((entry) => entry.number === Number(team)) || null;
  if (!baseTeam) return null;
  const eventSubmissions = currentScoutingSubmissions();
  if (!teamFormulaContextCache.has(eventSubmissions)) {
    teamFormulaContextCache.set(eventSubmissions, new Map());
  }
  const cache = teamFormulaContextCache.get(eventSubmissions);
  const cacheKey = `${eventModel.key}:${baseTeam.number}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const overlayTeam = baseTeam;
  const scoringComponents = (eventModel.scoringComponents || []).map((component) => component.id);
  const scouterMetricIds = currentScouterMetricDefinitions(eventModel).map((metricDefinition) => metricDefinition.id);
  const scoutingMatches = buildFormulaScoutingMatches(
    formulaSubmissionsForTeam(baseTeam.number, eventSubmissions),
    scoringComponents,
    scouterMetricIds,
  );
  const scoutingByMatch = new Map(scoutingMatches.map((match) => [match.matchNumber, match]));
  const tbaByMatch = new Map(tbaMatchMetricsByTeam(Number(baseTeam.number), eventModel).map((entry) => [entry.matchNumber, entry]));
  const teamSchedule = (eventModel.matches || [])
    .filter((match) => match.red.includes(baseTeam.number) || match.blue.includes(baseTeam.number))
    .map((match) => match.number)
    .sort((left, right) => left - right);
  const rowMatchNumbers = (teamSchedule.length ? teamSchedule : [...new Set([...scoutingByMatch.keys(), ...tbaByMatch.keys()])]).sort(
    (left, right) => left - right,
  );
  const matchRows = rowMatchNumbers.map((matchNumber) => ({
    matchNumber,
    scouting: scoutingByMatch.get(matchNumber) || null,
    tba: tbaByMatch.get(matchNumber) || null,
  }));
  const context = {
    baseTeam,
    overlayTeam,
    eventModel,
    matchRows,
  };
  cache.set(cacheKey, context);
  return context;
}

function formulaSeriesFromRows(matchRows, readValue) {
  return {
    kind: "series",
    granularity: "match",
    entries: matchRows.map((row) => ({
      key: row.matchNumber,
      value: readValue(row),
    })),
  };
}

function formulaScalarValue(value, granularity = "event") {
  return {
    kind: "scalar",
    granularity,
    value,
  };
}

function formulaResultForEventAggregate(value) {
  if (metricEngine.isErrorResult(value)) return { valid: false, reason: value.error || "Invalid event aggregate input." };
  if (metricEngine.isSeriesResult(value)) {
    return {
      valid: false,
      reason: "event* requires a per-team event value such as statbotics.total or average(scouting.autoSpeakerMade), not a raw match-level series.",
    };
  }
  if (!metricEngine.isScalarResult(value)) {
    return { valid: false, reason: "event* requires a per-team event value." };
  }
  return { valid: true, value: value.value };
}

function rawScoutingMetricValue(matchRow, fieldId) {
  if (fieldId === "hasEntry") {
    return matchRow.scouting?.selectedSubmission ? 1 : 0;
  }
  if (fieldId === "total") return matchRow.scouting?.total ?? Number.NaN;
  if (Object.prototype.hasOwnProperty.call(matchRow.scouting?.components || {}, fieldId)) {
    return matchRow.scouting.components[fieldId];
  }
  if (matchRow.scouting?.selectedSubmission?.rawMetrics && Object.prototype.hasOwnProperty.call(matchRow.scouting.selectedSubmission.rawMetrics, fieldId)) {
    return matchRow.scouting.selectedSubmission.rawMetrics[fieldId];
  }
  const submissions = Array.isArray(matchRow.scouting?.submissions) ? matchRow.scouting.submissions : [];
  const validSubmission = submissions.find((submission) => submission?.validity === "valid") || submissions[0] || null;
  return validSubmission?.rawMetrics?.[fieldId] ?? null;
}

function extractSeriesEntryValue(result, matchNumber) {
  if (result?.kind === "series") {
    return (result.entries || []).find((entry) => entry.key === matchNumber)?.value;
  }
  return result?.value;
}

function aggregateGroupValues(name, values) {
  const numericValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (name === "groupsum") return numericValues.length ? numericValues.reduce((sum, value) => sum + value, 0) : Number.NaN;
  if (name === "groupaverage") return numericValues.length ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length : Number.NaN;
  if (name === "groupcount") return values.filter((value) => value !== null && value !== undefined && value !== "" && value !== 0 && value !== "0").length;
  return Number.NaN;
}

const formulaAstKeyCache = new WeakMap();
let formulaAstKeySequence = 1;

function formulaAstCacheKey(ast) {
  if (!ast || typeof ast !== "object") return String(ast || "");
  if (!formulaAstKeyCache.has(ast)) {
    formulaAstKeyCache.set(ast, `ast:${formulaAstKeySequence++}`);
  }
  return formulaAstKeyCache.get(ast);
}

function evaluateGroupFormulaForContext(groupRequest, formulaContext, evaluationCache, evaluationStack, filterEvaluationCache, filterEvaluationStack, groupEvaluationCache = new Map()) {
  const peerContextCache = new Map();
  const peerOptionsCache = new Map();
  const peerSeriesResultCache = new Map();
  const peerFilterResultCache = new Map();
  const evaluateGroup = ({ name, seriesAst, scopeId, filterAst, parentOptions }, context) => {
    const recentEntryCount = Number(parentOptions?.recentEntryCount) || currentRecentMatchCount();
    const cacheKey = [
      context?.eventModel?.key || "",
      context?.baseTeam?.number || "",
      name,
      scopeId,
      recentEntryCount,
      formulaAstCacheKey(seriesAst),
      filterAst ? formulaAstCacheKey(filterAst) : "",
    ].join(":");
    if (groupEvaluationCache.has(cacheKey)) return groupEvaluationCache.get(cacheKey);
    const entries = context.matchRows.map((row) => {
      const peerTeams = scopeId === "allianceMatch"
        ? (row.tba?.allianceTeams || [])
        : (row.tba?.allTeams || []);
      const peerValues = peerTeams.flatMap((peerTeamNumber) => {
        if (!peerContextCache.has(peerTeamNumber)) {
          peerContextCache.set(peerTeamNumber, buildTeamFormulaContext(peerTeamNumber, context.eventModel));
        }
        const peerFormulaContext = peerContextCache.get(peerTeamNumber);
        if (!peerFormulaContext) return [];
        if (!peerOptionsCache.has(peerTeamNumber)) {
          peerOptionsCache.set(peerTeamNumber, {
            ...parentOptions,
            groupEvaluationCache,
            resolveIdentifier: (identifier) =>
              resolveFormulaIdentifier(
                identifier,
                peerFormulaContext,
                evaluationCache,
                evaluationStack,
                filterEvaluationCache,
                filterEvaluationStack,
                groupEvaluationCache,
              ) || { kind: "error", error: `Unknown identifier "${identifier}".` },
            evaluateGroupFunction: (nestedRequest) => evaluateGroup(nestedRequest, peerFormulaContext),
          });
        }
        const peerOptions = peerOptionsCache.get(peerTeamNumber);
        let peerSeriesCache = peerSeriesResultCache.get(peerTeamNumber);
        if (!peerSeriesCache) {
          peerSeriesCache = new Map();
          peerSeriesResultCache.set(peerTeamNumber, peerSeriesCache);
        }
        if (!peerSeriesCache.has(seriesAst)) {
          peerSeriesCache.set(seriesAst, metricEngine.evaluateFormulaAst(seriesAst, peerOptions));
        }
        const seriesResult = peerSeriesCache.get(seriesAst);
        if (isErrorFormulaResult(seriesResult)) return [];
        let filterResult = null;
        if (filterAst) {
          let peerFilterCache = peerFilterResultCache.get(peerTeamNumber);
          if (!peerFilterCache) {
            peerFilterCache = new Map();
            peerFilterResultCache.set(peerTeamNumber, peerFilterCache);
          }
          if (!peerFilterCache.has(filterAst)) {
            peerFilterCache.set(filterAst, metricEngine.evaluateFormulaAst(filterAst, peerOptions));
          }
          filterResult = peerFilterCache.get(filterAst);
        }
        if (isErrorFormulaResult(filterResult)) return [];
        if (filterResult && !extractSeriesEntryValue(filterResult, row.matchNumber)) return [];
        return [extractSeriesEntryValue(seriesResult, row.matchNumber)];
      });
      return { key: row.matchNumber, value: aggregateGroupValues(name, peerValues) };
    });
    const result = { kind: "series", granularity: "match", entries };
    groupEvaluationCache.set(cacheKey, result);
    return result;
  };
  return evaluateGroup(groupRequest, formulaContext);
}

function evaluateEventFormulaForContext(eventRequest, formulaContext, evaluationCache, evaluationStack, filterEvaluationCache, filterEvaluationStack, groupEvaluationCache = new Map(), eventEvaluationCache = new Map()) {
  const peerContextCache = new Map();
  const peerOptionsCache = new Map();
  const peerValueResultCache = new Map();
  const peerFilterResultCache = new Map();
  const evaluateEvent = ({ name, valueAst, filterAst, parentOptions }, context) => {
    const recentEntryCount = Number(parentOptions?.recentEntryCount) || currentRecentMatchCount();
    const cacheKey = [
      context?.eventModel?.key || "",
      context?.baseTeam?.number || "",
      name,
      recentEntryCount,
      formulaAstCacheKey(valueAst),
      filterAst ? formulaAstCacheKey(filterAst) : "",
    ].join(":");
    if (eventEvaluationCache.has(cacheKey)) return eventEvaluationCache.get(cacheKey);
    const numericValues = [];
    const countableValues = [];
    for (const peerTeam of context.eventModel?.teams || []) {
      const peerTeamNumber = Number(peerTeam?.number);
      if (!Number.isFinite(peerTeamNumber)) continue;
      if (!peerContextCache.has(peerTeamNumber)) peerContextCache.set(peerTeamNumber, buildTeamFormulaContext(peerTeamNumber, context.eventModel));
      const peerFormulaContext = peerContextCache.get(peerTeamNumber);
      if (!peerFormulaContext) continue;
      if (!peerOptionsCache.has(peerTeamNumber)) {
        peerOptionsCache.set(peerTeamNumber, {
          ...parentOptions,
          groupEvaluationCache,
          eventEvaluationCache,
          resolveIdentifier: (identifier) =>
            resolveFormulaIdentifier(
              identifier,
              peerFormulaContext,
              evaluationCache,
              evaluationStack,
              filterEvaluationCache,
              filterEvaluationStack,
              groupEvaluationCache,
              eventEvaluationCache,
            ) || { kind: "error", error: `Unknown identifier "${identifier}".` },
          evaluateGroupFunction: (nestedRequest) => evaluateGroupFormulaForContext(
            nestedRequest,
            peerFormulaContext,
            evaluationCache,
            evaluationStack,
            filterEvaluationCache,
            filterEvaluationStack,
            groupEvaluationCache,
          ),
          evaluateEventFunction: (nestedRequest) => evaluateEvent(nestedRequest, peerFormulaContext),
        });
      }
      const peerOptions = peerOptionsCache.get(peerTeamNumber);
      if (!peerValueResultCache.has(peerTeamNumber)) peerValueResultCache.set(peerTeamNumber, new Map());
      const peerValueCache = peerValueResultCache.get(peerTeamNumber);
      if (!peerValueCache.has(valueAst)) peerValueCache.set(valueAst, metricEngine.evaluateFormulaAst(valueAst, peerOptions));
      const valueResult = peerValueCache.get(valueAst);
      const normalizedValue = formulaResultForEventAggregate(valueResult);
      if (!normalizedValue.valid) {
        const result = { kind: "error", error: normalizedValue.reason };
        eventEvaluationCache.set(cacheKey, result);
        return result;
      }
      let include = true;
      if (filterAst) {
        if (!peerFilterResultCache.has(peerTeamNumber)) peerFilterResultCache.set(peerTeamNumber, new Map());
        const peerFilterCache = peerFilterResultCache.get(peerTeamNumber);
        if (!peerFilterCache.has(filterAst)) peerFilterCache.set(filterAst, metricEngine.evaluateFormulaAst(filterAst, peerOptions));
        const filterResult = peerFilterCache.get(filterAst);
        const normalizedFilter = formulaResultForEventAggregate(filterResult);
        if (!normalizedFilter.valid) {
          const result = {
            kind: "error",
            error: "event* optional filters must resolve to a per-team scalar condition such as average(scouting.autoSpeakerMade) > 0.",
          };
          eventEvaluationCache.set(cacheKey, result);
          return result;
        }
        include = Number(normalizedFilter.value) !== 0;
      }
      if (!include) continue;
      countableValues.push(normalizedValue.value);
      const numeric = Number(normalizedValue.value);
      if (Number.isFinite(numeric)) numericValues.push(numeric);
    }
    let result = formulaScalarValue(Number.NaN, "event");
    if (name === "eventsum") result = formulaScalarValue(numericValues.length ? roundValue(numericValues.reduce((sum, value) => sum + value, 0), 1) : Number.NaN, "event");
    else if (name === "eventaverage") result = formulaScalarValue(numericValues.length ? roundValue(average(numericValues), 1) : Number.NaN, "event");
    else if (name === "eventcount") result = formulaScalarValue(countableValues.filter((value) => value !== null && value !== undefined && value !== "" && value !== 0 && value !== "0").length, "event");
    eventEvaluationCache.set(cacheKey, result);
    return result;
  };
  return evaluateEvent(eventRequest, formulaContext);
}

function resolveFormulaIdentifier(identifier, formulaContext, evaluationCache, evaluationStack, filterEvaluationCache = new Map(), filterEvaluationStack = [], groupEvaluationCache = new Map(), eventEvaluationCache = new Map()) {
  if (identifier.startsWith("scouting.")) {
    const fieldId = identifier.slice("scouting.".length);
    return formulaSeriesFromRows(formulaContext.matchRows, (row) => rawScoutingMetricValue(row, fieldId));
  }
  if (identifier.startsWith("tba.")) {
    const fieldId = identifier.slice("tba.".length);
    if (Object.prototype.hasOwnProperty.call(formulaContext.overlayTeam.sources?.tba?.components || {}, fieldId)) {
      return formulaScalarValue(formulaContext.overlayTeam.sources?.tba?.components?.[fieldId] ?? Number.NaN);
    }
    return formulaSeriesFromRows(formulaContext.matchRows, (row) => row.tba?.[fieldId] ?? Number.NaN);
  }
  if (identifier.startsWith("statbotics.")) {
    const componentId = identifier.slice("statbotics.".length);
    if (componentId === "total") return formulaScalarValue(formulaContext.overlayTeam.sources?.epa?.total || Number.NaN);
    return formulaScalarValue(formulaContext.overlayTeam.sources?.epa?.components?.[componentId] || Number.NaN);
  }
  if (identifier.startsWith("pridge.")) {
    const componentId = identifier.slice("pridge.".length);
    if (componentId === "total") return formulaScalarValue(formulaContext.overlayTeam.sources?.pridge?.total || Number.NaN);
    return formulaScalarValue(formulaContext.overlayTeam.sources?.pridge?.components?.[componentId] || Number.NaN);
  }
  if (identifier.startsWith("opr.")) {
    const componentId = identifier.slice("opr.".length);
    if (componentId === "total") return formulaScalarValue(formulaContext.overlayTeam.sources?.opr?.total || Number.NaN);
    return formulaScalarValue(formulaContext.overlayTeam.sources?.opr?.components?.[componentId] || Number.NaN);
  }
  if (identifier.startsWith("filter.")) {
    const referencedFilter = seasonFilterDefinitionByReference(identifier, formulaContext.eventModel);
    if (!referencedFilter) return null;
    return evaluateSeasonFilterDefinitionForTeam(formulaContext.baseTeam, referencedFilter, {
      eventModel: formulaContext.eventModel,
      formulaContext,
      evaluationCache: filterEvaluationCache,
      evaluationStack: filterEvaluationStack,
      equationEvaluationCache: evaluationCache,
      equationEvaluationStack: evaluationStack,
      groupEvaluationCache,
      eventEvaluationCache,
    }).result;
  }
  const referencedEquation = equationDefinitionById(identifier, formulaContext.eventModel);
  if (!referencedEquation) return null;
  return evaluateEquationForTeam(formulaContext.baseTeam, referencedEquation.id, {
    eventModel: formulaContext.eventModel,
    evaluationCache,
    evaluationStack,
    filterEvaluationCache,
    filterEvaluationStack,
    groupEvaluationCache,
    eventEvaluationCache,
  }).result;
}

function evaluateEquationForTeam(team, equationId, options = {}) {
  const eventModel = options.eventModel || currentEvent();
  const formulaContext = options.formulaContext || buildTeamFormulaContext(team, eventModel);
  const evaluationCache = options.evaluationCache || new Map();
  const evaluationStack = Array.isArray(options.evaluationStack) ? [...options.evaluationStack] : [];
  const filterEvaluationCache = options.filterEvaluationCache || new Map();
  const filterEvaluationStack = Array.isArray(options.filterEvaluationStack) ? [...options.filterEvaluationStack] : [];
  const groupEvaluationCache = options.groupEvaluationCache || new Map();
  const eventEvaluationCache = options.eventEvaluationCache || new Map();
  const recentEntryCount = currentRecentMatchCount();
  const cacheKey = `${formulaContext?.baseTeam?.number || team}:${equationId}:${eventModel.key}:${recentEntryCount}`;
  if (evaluationCache.has(cacheKey)) return evaluationCache.get(cacheKey);
  if (evaluationStack.includes(equationId)) {
    const circular = { definition: equationDefinitionById(equationId, eventModel), result: { kind: "error", error: `Circular derived equation reference: ${[...evaluationStack, equationId].join(" -> ")}.` } };
    evaluationCache.set(cacheKey, circular);
    return circular;
  }
  const definition = equationDefinitionById(equationId, eventModel);
  if (!definition || !formulaContext) {
    const missing = { definition, result: { kind: "error", error: `Unknown derived equation "${equationId}".` } };
    evaluationCache.set(cacheKey, missing);
    return missing;
  }
  const result = evaluateFormulaExpression(definition.formula, {
    recentEntryCount,
    resolveIdentifier: (identifier) =>
      resolveFormulaIdentifier(
        identifier,
        formulaContext,
        evaluationCache,
        [...evaluationStack, equationId],
        filterEvaluationCache,
        filterEvaluationStack,
        groupEvaluationCache,
        eventEvaluationCache,
      ) || { kind: "error", error: `Unknown identifier "${identifier}".` },
    evaluateGroupFunction: ({ name, seriesAst, scopeId, filterAst, parentOptions }) =>
      evaluateGroupFormulaForContext(
        { name, seriesAst, scopeId, filterAst, parentOptions },
        formulaContext,
        evaluationCache,
        [...evaluationStack, equationId],
        filterEvaluationCache,
        filterEvaluationStack,
        groupEvaluationCache,
      ),
    evaluateEventFunction: ({ name, valueAst, filterAst, parentOptions }) =>
      evaluateEventFormulaForContext(
        { name, valueAst, filterAst, parentOptions },
        formulaContext,
        evaluationCache,
        [...evaluationStack, equationId],
        filterEvaluationCache,
        filterEvaluationStack,
        groupEvaluationCache,
        eventEvaluationCache,
      ),
    groupEvaluationCache,
    eventEvaluationCache,
  });
  const evaluation = { definition, result, formulaContext };
  evaluationCache.set(cacheKey, evaluation);
  return evaluation;
}

function equationStatusForTeam(team, equationId, eventModel = currentEvent()) {
  const evaluation = evaluateEquationForTeam(team, equationId, { eventModel });
  if (isErrorFormulaResult(evaluation.result)) return { label: "Invalid", severity: "danger", detail: evaluation.result.error };
  if (evaluation.result.granularity !== "event") return { label: "Match Only", severity: "warn", detail: "Equation stays at match granularity until averaged." };
  return null;
}

function scouterMetricFieldId(metricDefinition) {
  return seasonMetricFieldId(metricDefinition);
}

function defaultScopedEventKey(eventKey) {
  return eventKey || globalThis.__scoutingActiveEventKey || globalEventCatalog[0]?.key;
}

function eventStorageKey(baseKey, eventKey) {
  const resolvedEventKey = defaultScopedEventKey(eventKey);
  return globalStorageKeys.has(baseKey) ? baseKey : `${baseKey}:${resolvedEventKey}`;
}

function readStoredItem(baseKey, eventKey) {
  const resolvedEventKey = defaultScopedEventKey(eventKey);
  const value = localStorage.getItem(eventStorageKey(baseKey, eventKey));
  if (value !== null) return value;
  if (globalStorageKeys.has(baseKey)) return localStorage.getItem(`${baseKey}:${resolvedEventKey}`);
  return null;
}

function readStoredJson(key, fallback, eventKey) {
  try {
    return JSON.parse(readStoredItem(key, eventKey)) || fallback;
  } catch {
    return fallback;
  }
}

function readLegacyJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) || fallback;
  } catch {
    return fallback;
  }
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeStoredFormula(value, fallback = "0") {
  const trimmed = String(value || "").trim();
  const normalized = trimmed.replace(/^=\s*/, "").trim();
  return normalized || fallback;
}

function formulaAstPrecedence(ast) {
  if (!ast || typeof ast !== "object") return 99;
  if (["number", "string", "identifier", "call"].includes(ast.type)) return 99;
  if (ast.type === "unary") return 80;
  if (ast.type === "binary") return ["*", "/"].includes(ast.operator) ? 70 : 60;
  if (ast.type === "comparison") return 50;
  if (ast.type === "logical") {
    if (ast.operator === "and") return 40;
    if (ast.operator === "xor") return 30;
    return 20;
  }
  return 99;
}

function canonicalFormulaCall(ast) {
  const normalizedName = String(ast?.callee || "").trim().toLowerCase();
  const args = Array.isArray(ast?.args) ? ast.args : [];
  if (normalizedName === "teamaverage") return { name: "average", args };
  if (normalizedName === "teamsum") return { name: "sum", args };
  if (normalizedName === "teamcount") return { name: "count", args };
  if (["groupaverage", "groupsum", "groupcount"].includes(normalizedName) && args.length >= 2 && args[1]?.type === "call") {
    const scopeName = String(args[1].callee || "").trim().toLowerCase();
    const scopedNameMap = {
      groupaverage: { match: "matchAverage", alliancematch: "allianceAverage" },
      groupsum: { match: "matchSum", alliancematch: "allianceSum" },
      groupcount: { match: "matchCount", alliancematch: "allianceCount" },
    };
    const nextName = scopedNameMap[normalizedName]?.[scopeName];
    if (nextName) return { name: nextName, args: [args[0], ...args.slice(2)] };
  }
  const canonicalNameMap = {
    average: "average",
    sum: "sum",
    count: "count",
    matchaverage: "matchAverage",
    matchsum: "matchSum",
    matchcount: "matchCount",
    allianceaverage: "allianceAverage",
    alliancesum: "allianceSum",
    alliancecount: "allianceCount",
    eventaverage: "eventAverage",
    eventsum: "eventSum",
    eventcount: "eventCount",
    groupaverage: "groupAverage",
    groupsum: "groupSum",
    groupcount: "groupCount",
    alliancematch: "allianceMatch",
    match: "match",
    if: "if",
    valueor: "valueOr",
    startswith: "startsWith",
    contains: "contains",
    and: "and",
    or: "or",
    xor: "xor",
    not: "not",
  };
  return { name: canonicalNameMap[normalizedName] || ast.callee, args };
}

function serializeFormulaAst(ast, parentPrecedence = -1) {
  if (!ast) return "";
  if (ast.type === "number") return String(ast.value);
  if (ast.type === "string") return JSON.stringify(ast.value);
  if (ast.type === "identifier") return ast.name;
  if (ast.type === "call") {
    const canonical = canonicalFormulaCall(ast);
    return `${canonical.name}(${canonical.args.map((argument) => serializeFormulaAst(argument)).join(", ")})`;
  }
  if (ast.type === "unary") {
    const precedence = formulaAstPrecedence(ast);
    const text = `${ast.operator}${serializeFormulaAst(ast.argument, precedence)}`;
    return precedence < parentPrecedence ? `(${text})` : text;
  }
  if (ast.type === "binary" || ast.type === "comparison" || ast.type === "logical") {
    const precedence = formulaAstPrecedence(ast);
    const operator = ast.type === "logical"
      ? { and: "&&", or: "||", xor: "^" }[ast.operator] || ast.operator
      : ast.operator;
    const text = `${serializeFormulaAst(ast.left, precedence)} ${operator} ${serializeFormulaAst(ast.right, precedence + 1)}`;
    return precedence < parentPrecedence ? `(${text})` : text;
  }
  return "";
}

function canonicalizeStoredFormula(value, fallback = "0") {
  const normalized = normalizeStoredFormula(value, fallback);
  const parsed = metricEngine.parseFormulaExpression(normalized);
  if (parsed?.error || !parsed?.ast) return normalized || fallback;
  const serialized = serializeFormulaAst(parsed.ast).trim();
  return serialized || fallback;
}

function roundValue(value, digits = 1) {
  return Number(Number(value || 0).toFixed(digits));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function builderGridScrollState(view = state.activeView) {
  if (!state.builderGridScroll?.[view]) {
    if (!state.builderGridScroll) state.builderGridScroll = {};
    state.builderGridScroll[view] = { shellLeft: 0, columnTops: {} };
  }
  if (!state.builderGridScroll[view].columnTops) state.builderGridScroll[view].columnTops = {};
  return state.builderGridScroll[view];
}

function builderListScrollState(view = state.activeView) {
  if (!state.builderListScroll?.[view]) {
    if (!state.builderListScroll) state.builderListScroll = {};
    state.builderListScroll[view] = {};
  }
  return state.builderListScroll[view];
}

function captureBuilderGridScroll(view = state.activeView) {
  const scrollState = builderGridScrollState(view);
  const shell = document.querySelector("[data-builder-grid-shell]");
  if (shell) scrollState.shellLeft = shell.scrollLeft;
  document.querySelectorAll("[data-builder-grid-column-scroll]").forEach((column) => {
    const key = column.dataset.builderGridColumnScroll;
    if (!key) return;
    scrollState.columnTops[key] = column.scrollTop;
  });
}

function restoreBuilderGridScroll(view = state.activeView) {
  const scrollState = builderGridScrollState(view);
  requestAnimationFrame(() => {
    const shell = document.querySelector("[data-builder-grid-shell]");
    if (shell) shell.scrollLeft = Number(scrollState.shellLeft || 0);
    document.querySelectorAll("[data-builder-grid-column-scroll]").forEach((column) => {
      const key = column.dataset.builderGridColumnScroll;
      if (!key) return;
      column.scrollTop = Number(scrollState.columnTops?.[key] || 0);
    });
  });
}

function captureBuilderListScroll(view = state.activeView) {
  const scrollState = builderListScrollState(view);
  document.querySelectorAll("[data-builder-list-scroll]").forEach((list) => {
    const key = list.dataset.builderListScroll;
    if (!key) return;
    scrollState[key] = list.scrollTop;
  });
}

function restoreBuilderListScroll(view = state.activeView) {
  const scrollState = builderListScrollState(view);
  requestAnimationFrame(() => {
    document.querySelectorAll("[data-builder-list-scroll]").forEach((list) => {
      const key = list.dataset.builderListScroll;
      if (!key) return;
      list.scrollTop = Number(scrollState[key] || 0);
    });
  });
}

function saveState() {
  localStorage.setItem(eventStorageKey(storageKeys.users), JSON.stringify(state.users));
  localStorage.setItem(eventStorageKey(storageKeys.user), state.user);
  localStorage.setItem(eventStorageKey(storageKeys.theme), state.theme);
  localStorage.setItem(eventStorageKey(storageKeys.activeEvent), state.activeEventKey);
  localStorage.setItem(eventStorageKey(storageKeys.activeView), state.activeView);
  localStorage.setItem(eventStorageKey(storageKeys.metric), state.metric);
  localStorage.setItem(eventStorageKey(storageKeys.analysisFilter), state.activeAnalysisFilterId);
  localStorage.setItem(eventStorageKey(storageKeys.teamDetailMetric), state.teamDetailMetric);
  localStorage.setItem(eventStorageKey(storageKeys.picklistCompareMetric), state.picklistCompareMetric);
  localStorage.setItem(eventStorageKey(storageKeys.selectedTeam), String(state.selectedTeam));
  localStorage.setItem(eventStorageKey(storageKeys.selectedMatch), String(state.selectedMatch));
  localStorage.setItem(eventStorageKey(storageKeys.menuExpanded), String(state.menuExpanded));
  localStorage.setItem(eventStorageKey(storageKeys.picklists), JSON.stringify(state.picklists));
  localStorage.setItem(eventStorageKey(storageKeys.sortEquations), JSON.stringify(state.sortEquations));
  localStorage.setItem(eventStorageKey(storageKeys.loadedPicklists), JSON.stringify(state.loadedSources));
  localStorage.setItem(eventStorageKey(storageKeys.activePicklist), state.activePicklist);
  localStorage.setItem(eventStorageKey(storageKeys.activeSortEquation), state.activeSortEquation);
  localStorage.setItem(eventStorageKey(storageKeys.picklistColumns), JSON.stringify(state.picklistColumns));
  localStorage.setItem(eventStorageKey(storageKeys.allianceBoard), JSON.stringify(state.allianceBoard));
  localStorage.setItem(eventStorageKey(storageKeys.picklistCompareTeams), JSON.stringify(state.picklistCompareTeams));
  localStorage.setItem(eventStorageKey(storageKeys.scoutingSubmissions), JSON.stringify(state.scoutingSubmissions));
  localStorage.setItem(eventStorageKey(storageKeys.scoutingReviewOverrides), JSON.stringify(state.scoutingReviewOverrides));
  localStorage.setItem(eventStorageKey(storageKeys.activityLog), JSON.stringify(state.activityLog));
  localStorage.setItem(eventStorageKey(storageKeys.importSourceUrl), state.importSourceUrl);
  localStorage.setItem(eventStorageKey(storageKeys.scoutingWindow), state.scoutingWindow);
  localStorage.setItem(eventStorageKey(storageKeys.recentMatchCount), String(state.recentMatchCount));
  localStorage.setItem(eventStorageKey(storageKeys.tbaAuthKey), state.tbaAuthKey);
  localStorage.setItem(eventStorageKey(storageKeys.seasonProfiles), JSON.stringify(state.seasonProfileCatalog));
  localStorage.setItem(eventStorageKey(storageKeys.seasonDerivedEquations), JSON.stringify(state.seasonDerivedEquationCatalog));
  localStorage.setItem(eventStorageKey(storageKeys.seasonFilters), JSON.stringify(state.seasonFilterCatalog));
  localStorage.setItem(eventStorageKey(storageKeys.eventWorkspace), JSON.stringify(state.eventWorkspace));
}

function clearAppStorage() {
  const keysToRemove = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key && key.startsWith("frc-scouting-")) keysToRemove.push(key);
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

function readStoredScoutingSubmissions(eventKey, eventModel = currentEvent()) {
  const scoped = readStoredJson(storageKeys.scoutingSubmissions, null, eventKey);
  if (Array.isArray(scoped)) return scoped;

  const legacy = readLegacyJson(storageKeys.scoutingSubmissions, null);
  if (!Array.isArray(legacy) || !legacy.length) return [];

  const matchingLegacy = legacy.filter((submission) => submission?.eventKey === eventModel.key);
  if (matchingLegacy.length) {
    localStorage.setItem(eventStorageKey(storageKeys.scoutingSubmissions, eventKey), JSON.stringify(matchingLegacy));
    return matchingLegacy;
  }

  const hasAnyEventKey = legacy.some((submission) => submission?.eventKey);
  if (hasAnyEventKey) return [];

  const migrated = legacy.map((submission) => ({
    ...submission,
    eventKey: eventModel.key,
  }));
  localStorage.setItem(eventStorageKey(storageKeys.scoutingSubmissions, eventKey), JSON.stringify(migrated));
  return migrated;
}

function registerSeasonScoutingProfile(seasonKey, profile) {
  const normalized = normalizeSeasonProfileCatalog(state.seasonProfileCatalog);
  const key = String(seasonKey);
  const existing = normalized[key] || [];
  normalized[key] = normalizeSeasonProfileCatalog({
    [key]: [
      ...existing,
      {
        id: String(profile?.id || "").trim(),
        label: String(profile?.label || knownImportProfileLabels[String(profile?.id || "").trim()] || profile?.id || "").trim(),
      },
    ],
  })[key] || [];
  state.seasonProfileCatalog = normalized;
}

function seasonScoutingProfiles(seasonKey = String(currentEvent().season)) {
  return state.seasonProfileCatalog?.[String(seasonKey)] || [];
}

function backfillSeasonProfilesFromSubmissions(eventModel = currentEvent()) {
  const seasonKey = String(eventModel.season);
  const profiles = seasonScoutingProfiles(seasonKey);
  if (profiles.length) return;
  const discovered = new Map();
  state.scoutingSubmissions.forEach((submission) => {
    const profileId = String(submission?.templateProfileId || "").trim();
    if (!profileId || discovered.has(profileId)) return;
    discovered.set(profileId, {
      id: profileId,
      label: knownImportProfileLabels[profileId] || profileId,
    });
  });
  if (!discovered.size) return;
  state.seasonProfileCatalog = normalizeSeasonProfileCatalog({
    ...state.seasonProfileCatalog,
    [seasonKey]: [...discovered.values()],
  });
}

function hydrateEventState(eventKey) {
  const resolvedEventKey = resolveEventKey(eventKey);
  state.activeEventKey = resolvedEventKey;
  globalThis.__scoutingActiveEventKey = state.activeEventKey;
  const eventModel = currentEvent();
  state.eventWorkspace = createEventWorkspace(eventModel, readStoredJson(storageKeys.eventWorkspace, null, resolvedEventKey));
  const seededWorkspace = seedWorkspaceExternalSourceFingerprints(state.eventWorkspace, eventModel);
  const repairedWorkspaceFingerprints = seededWorkspace !== state.eventWorkspace;
  state.eventWorkspace = seededWorkspace;
  state.activeView = normalizeView(readStoredItem(storageKeys.activeView, resolvedEventKey));
  state.metric = normalizeAnalysisSelection(readStoredItem(storageKeys.metric, resolvedEventKey), eventModel);
  state.activeAnalysisFilterId = normalizeAnalysisFilterSelection(readStoredItem(storageKeys.analysisFilter, resolvedEventKey), eventModel);
  state.teamDetailMetric = normalizeTeamDetailMetric(readStoredItem(storageKeys.teamDetailMetric, resolvedEventKey), eventModel);
  state.picklistCompareMetric = normalizeTeamDetailMetric(readStoredItem(storageKeys.picklistCompareMetric, resolvedEventKey), eventModel);
  state.selectedTeam = Number(readStoredItem(storageKeys.selectedTeam, resolvedEventKey)) || eventModel.teams[0].number;
  state.selectedMatch = Number(readStoredItem(storageKeys.selectedMatch, resolvedEventKey)) || eventModel.matches[0].number;
  state.picklists = normalizePicklists(readStoredJson(storageKeys.picklists, eventModel.seedPicklists, resolvedEventKey), eventModel);
  state.sortEquations = normalizeSortEquations(readStoredJson(storageKeys.sortEquations, eventModel.seedSortEquations, resolvedEventKey), eventModel);
  state.activePicklist = resolvePicklistId(readStoredItem(storageKeys.activePicklist, resolvedEventKey), state.picklists) || state.picklists[0]?.id || "";
  state.activeSortEquation =
    resolveSortEquationId(readStoredItem(storageKeys.activeSortEquation, resolvedEventKey), state.sortEquations) || state.sortEquations[0]?.id || "";
  state.loadedSources = normalizeLoadedSources(readStoredJson(storageKeys.loadedPicklists, [`picklist:${eventModel.seedPicklists[0].id}`], resolvedEventKey));
  state.picklistColumns = normalizePicklistColumns(readStoredJson(storageKeys.picklistColumns, Array(picklistColumnCount).fill(""), resolvedEventKey));
  state.allianceBoard = normalizeBoard(readStoredJson(storageKeys.allianceBoard, defaultAllianceBoard, resolvedEventKey), eventModel);
  state.picklistCompareTeams = normalizePicklistCompareTeams(readStoredJson(storageKeys.picklistCompareTeams, [], resolvedEventKey), eventModel);
  state.scoutingSubmissions = normalizeScoutingSubmissions(readStoredScoutingSubmissions(resolvedEventKey, eventModel), eventModel);
  state.scoutingReviewOverrides = normalizeScoutingReviewOverrides(readStoredJson(storageKeys.scoutingReviewOverrides, [], resolvedEventKey), eventModel);
  backfillSeasonProfilesFromSubmissions(eventModel);
  state.activityLog = normalizeActivityLog(readStoredJson(storageKeys.activityLog, [], resolvedEventKey));
  state.importSourceUrl = currentScoutingSourceInputValue(
    state.eventWorkspace,
    eventModel,
    readStoredItem(storageKeys.importSourceUrl, resolvedEventKey),
  );
  let repairedScoutingSubmissions = false;
  const refreshedWorkspaceState = rebuildSampleBackedEventWorkspaceState({
    workspace: state.eventWorkspace,
    eventModel,
    submissions: state.scoutingSubmissions,
    activity: state.activityLog,
    shouldRefreshSampleBackedSubmissions: shouldRefreshSampleBackedScoutingSubmissions,
    adaptEventSheetCsv: sharedAdaptEventSheetCsv,
    translateEventSheetToCanonical: sharedTranslateEventSheetToCanonical,
    previewScoutingImport,
    previewScoutingJsonImport,
    commitScoutingImport,
    stampScoutingSubmissionMetadata,
  });
  if (refreshedWorkspaceState) {
    state.scoutingSubmissions = normalizeScoutingSubmissions(refreshedWorkspaceState.submissions, eventModel);
    state.activityLog = normalizeActivityLog(refreshedWorkspaceState.activity);
    repairedScoutingSubmissions = true;
  }
  state.scoutingWindow = readStoredItem(storageKeys.scoutingWindow, resolvedEventKey) || "all";
  state.recentMatchCount = Math.max(1, Number(readStoredItem(storageKeys.recentMatchCount, resolvedEventKey) || state.recentMatchCount || 12));
  ensureActiveDerivedEquation(eventModel);
  ensureActiveSeasonFilter(eventModel);
  if (!state.loadedSources.length && state.picklists.length) state.loadedSources = [`picklist:${state.picklists[0].id}`];
  state.selectedTeam = teamByNumber(state.selectedTeam)?.number || eventModel.teams[0].number;
  state.selectedMatch = currentMatches().some((match) => match.number === state.selectedMatch) ? state.selectedMatch : eventModel.matches[0].number;
  state.contextMenu = null;
  state.inlineRename = null;
  state.picklistSelectedTeam = null;
  state.activeDerivedPreviewMetricId = "";
  state.importResult = null;
  state.eventLookupPending = false;
  state.eventLookupResult = null;
  if (repairedScoutingSubmissions || repairedWorkspaceFingerprints) saveState();
}

function resetTransientEventState() {
  state.contextMenu = null;
  state.inlineRename = null;
  state.picklistSelectedTeam = null;
  state.activeDerivedPreviewMetricId = "";
  state.builderFocus.derivedBuilder = "equations";
  state.viewHistory = [];
}

function switchActiveEvent(eventKey, options = {}) {
  if (!eventKey) return false;
  const resolvedEventKey = resolveEventKey(eventKey);
  const previousEventKey = state.activeEventKey;
  const previousImportCsvText = state.importCsvText;
  const previousImportSelectedProfileId = state.importSelectedProfileId;
  const previousImportResult = state.importResult;
  const previousViewHistory = Array.isArray(state.viewHistory) ? [...state.viewHistory] : [];
  try {
    hydrateEventState(resolvedEventKey);
    resetTransientEventState();
    if (options.activeView) state.activeView = normalizeView(options.activeView);
    if (!options.preserveImportDraft) {
      state.importCsvText = "";
      state.importSelectedProfileId = "";
      state.importDraftSource = "";
    }
    saveState();
    if (options.rerunImportPreview) {
      state.importResult = null;
      runImportPreview();
      return true;
    }
    renderSafely();
    maybeAutoloadScoutingAttachment();
    return true;
  } catch (error) {
    console.error("Failed to switch active event", resolvedEventKey, error);
    state.importCsvText = previousImportCsvText;
    state.importSelectedProfileId = previousImportSelectedProfileId;
    state.importResult = previousImportResult;
    state.viewHistory = previousViewHistory;
    try {
      hydrateEventState(previousEventKey);
      saveState();
      renderSafely();
    } catch (rollbackError) {
      console.error("Failed to recover previous event after switch failure", rollbackError);
      renderRecoveryScreen(rollbackError);
    }
    return false;
  }
}

async function loadArbitraryEventCode(eventCode, options = {}) {
  const normalizedEventCode = normalizeExternalEventCode(eventCode);
  if (!normalizedEventCode) {
    state.eventLookupResult = { kind: "error", message: "Enter a valid event code." };
    render();
    return false;
  }
  state.eventLookupPending = true;
  state.eventLookupResult = { kind: "info", message: `Loading ${normalizedEventCode} from external providers...` };
  render();
  try {
    const loadResult = await loadExternalEventByCode(normalizedEventCode, {
      tbaAuthKey: state.tbaAuthKey,
    });
    const registeredEvent = registerEventModel(loadResult.eventModel);
    switchActiveEvent(registeredEvent.key, {
      activeView: options.activeView || "admin",
      preserveImportDraft: true,
    });
    applyLoadedExternalSourceState(loadResult, { render: false });
    state.eventLookupResult = {
      kind: loadResult.warnings?.length ? "warn" : "success",
      message: loadResult.warnings?.length
        ? `${registeredEvent.key} loaded with warnings. ${loadResult.warnings.join(" ")}`
        : `${registeredEvent.key} loaded from external providers.`,
    };
    saveState();
    render();
    return true;
  } catch (error) {
    state.eventLookupResult = {
      kind: "error",
      message: error?.message || "Unable to load that event code right now.",
    };
    render();
    return false;
  } finally {
    state.eventLookupPending = false;
    render();
  }
}

function createDerivedMetricDraft(eventModel = currentEvent()) {
  return {
    scopeType: "season",
    presetId: "blank",
    id: "",
    idManuallyEdited: false,
    label: "",
    unit: "pts",
    template: "sum",
    fields: [],
    weightedFields: [],
    madeFields: [],
    missedFields: [],
    numeratorFields: [],
    denominatorFields: [],
    denominatorMode: "match_count",
    presenceFields: [],
    scoringMatrixPresetId: "",
    seasonKey: String(eventModel.season),
    profileKey: currentProfileMetricScopeKey(eventModel),
  };
}

function normalizeSeasonDerivedEquationCatalog(catalog) {
  const normalized = { seasons: {} };
  Object.entries(catalog?.seasons || {}).forEach(([seasonKey, definitions]) => {
    const seen = new Set();
    const nextDefinitions = [];
    (definitions || []).forEach((definition, index) => {
      const id = String(definition?.id || "").trim();
      const name = String(definition?.name || "").trim();
      const formula = String(definition?.formula || "");
      if (!id || !name || seen.has(id)) return;
      seen.add(id);
      nextDefinitions.push({
        id,
        name,
        formula: canonicalizeStoredFormula(formula, "0"),
        unit: String(definition?.unit || "pts").trim() || "pts",
        description: String(definition?.description || "").trim(),
        sourceOrder: Number.isFinite(Number(definition?.sourceOrder)) ? Number(definition.sourceOrder) : index,
      });
    });
    normalized.seasons[String(seasonKey)] = nextDefinitions;
  });
  return normalized;
}

function mergeSeededSeasonCatalog(storedCatalog, seededCatalog) {
  return {
    seasons: {
      ...((storedCatalog && storedCatalog.seasons) || {}),
      ...((seededCatalog && seededCatalog.seasons) || {}),
    },
  };
}

function normalizeSeasonProfileCatalog(catalog) {
  const normalized = {};
  Object.entries(catalog || {}).forEach(([seasonKey, profiles]) => {
    const seen = new Set();
    const nextProfiles = [];
    (profiles || []).forEach((profile) => {
      const id = String(profile?.id || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      nextProfiles.push({
        id,
        label: String(profile?.label || knownImportProfileLabels[id] || id).trim() || id,
      });
    });
    normalized[String(seasonKey)] = nextProfiles.sort((left, right) => left.label.localeCompare(right.label));
  });
  return normalized;
}

function normalizeSeasonFilterCatalog(catalog) {
  const normalized = { seasons: {} };
  Object.entries(catalog?.seasons || {}).forEach(([seasonKey, definitions]) => {
    const seen = new Set();
    const nextDefinitions = [];
    (definitions || []).forEach((definition, index) => {
      const id = String(definition?.id || "").trim();
      const name = String(definition?.name || "").trim();
      if (!id || !name || seen.has(id)) return;
      seen.add(id);
      nextDefinitions.push({
        id,
        name,
        formula: canonicalizeStoredFormula(String(definition?.formula || "").trim() || "0 > 1", "0 > 1"),
        description: String(definition?.description || "").trim(),
        sourceOrder: Number.isFinite(Number(definition?.sourceOrder)) ? Number(definition.sourceOrder) : index,
      });
    });
    normalized.seasons[String(seasonKey)] = nextDefinitions;
  });
  return normalized;
}

function knownScouterFieldIds() {
  return new Set(
    globalEventCatalog.flatMap((eventModel) => currentScouterMetricDefinitions(eventModel).map((metricDefinition) => metricDefinition.id)),
  );
}

function reservedMetricIds() {
  return new Set(globalEventCatalog.flatMap((eventModel) => (eventModel.metrics || []).map((metric) => metric.id)));
}

function normalizeView(view) {
  if (view === "scoringMatrixBuilder" || view === "sortBuilder" || view === "filterBuilder") return "derivedBuilder";
  return appViews.some((item) => item.view === view) ? view : "teams";
}

function normalizeBoard(board, eventModel = currentEvent()) {
  const next = Array.isArray(board) ? board.slice(0, 24) : [];
  while (next.length < 24) next.push(null);
  const allowedTeams = new Set((eventModel?.teams || []).map((team) => team.number));
  const seen = new Set();
  return next.map((value) => {
    const teamNumber = Number(value);
    if (!Number.isFinite(teamNumber) || value === "" || !allowedTeams.has(teamNumber) || seen.has(teamNumber)) return null;
    seen.add(teamNumber);
    return teamNumber;
  });
}

function normalizeAnalysisSelection(value, eventModel = currentEvent()) {
  if (typeof value !== "string" || !value) return eventModel.defaultMetricId;
  return currentMetrics().some((metric) => metric.id === value) ? value : eventModel.defaultMetricId;
}

function normalizeAnalysisFilterSelection(value, eventModel = currentEvent()) {
  if (typeof value !== "string" || !value) return "";
  return currentSeasonFilterList(eventModel).some((definition) => definition.id === value) ? value : "";
}

function normalizeTeamDetailMetric(value, eventModel = currentEvent()) {
  if (typeof value !== "string" || !value) return eventModel.defaultTeamDetailMetricId;
  return eventModel.metrics.some((metric) => metric.id === value) ? value : eventModel.defaultTeamDetailMetricId;
}

function pickedTeams() {
  return state.allianceBoard.filter((team) => team !== null);
}

function isAdmin() {
  return adminUsers.includes(state.user);
}

function userLabel(user) {
  return adminUsers.includes(user) ? `${user} (Admin)` : user;
}

function canView(view) {
  return view !== "admin" || isAdmin();
}

function visibleNavItems() {
  return navItems.filter((item) => canView(item.view));
}

function resolvePicklistId(value, picklists = state.picklists) {
  if (!value) return "";
  const stringValue = String(value);
  const match = picklists.find((picklist) => picklist.id === stringValue || picklist.name === stringValue);
  return match?.id || "";
}

function resolveSortEquationId(value, sortEquations = state.sortEquations) {
  if (!value) return "";
  const stringValue = String(value);
  const match = sortEquations.find((equation) => equation.id === stringValue || equation.name === stringValue);
  return match?.id || "";
}

function normalizeSortEquations(equations, eventModel = currentEvent()) {
  const source = Array.isArray(equations) ? equations : [];
  const hasPersistedValues = Array.isArray(equations);
  const normalized = source
    .filter((equation) => equation && equation.id !== protectedEpaSortId)
    .map((equation) => ({
      id: equation.id || createId("sort"),
      name: equation.name || "Sort Equation",
      terms: normalizeCriteriaTerms(equation.terms || termsFromLegacyWeights(equation.weights)),
      locked: false,
    }));
  const fallback = normalized.length || hasPersistedValues ? normalized : eventModel.seedSortEquations.map((equation) => ({
    id: equation.id || createId("sort"),
    name: equation.name || "Sort Equation",
    terms: normalizeCriteriaTerms(equation.terms || termsFromLegacyWeights(equation.weights)),
    locked: false,
  }));
  return [protectedEpaSortEquation, ...fallback];
}

function normalizePicklists(lists, eventModel = currentEvent()) {
  const source = Array.isArray(lists) && lists.length ? lists : eventModel.seedPicklists;
  return source.map((list) => ({
    id: list.id || createId("pick"),
    name: list.name || "Picklist",
    teams: normalizePicklistTeams(list.teams, eventModel),
  }));
}

function normalizePicklistTeams(values, eventModel = currentEvent()) {
  const ranked = Array.isArray(values)
    ? values.map(Number).filter((value, index, array) => eventModel.teams.some((team) => team.number === value) && array.indexOf(value) === index)
    : [];
  const missing = eventModel.teamNumbers.filter((number) => !ranked.includes(number));
  return [...ranked, ...missing];
}

function normalizeLoadedSources(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((entry) => normalizeSourceEntry(entry))
    .filter((entry, index, array) => entry && array.indexOf(entry) === index);
}

function normalizePicklistCompareTeams(values, eventModel = currentEvent()) {
  const next = Array.isArray(values) ? values.slice(0, picklistCompareLimit) : [];
  while (next.length < picklistCompareLimit) next.push(null);
  const seen = new Set();
  return next.map((value) => {
    const teamNumber = Number(value);
    if (!eventModel.teams.some((team) => team.number === teamNumber)) return null;
    if (seen.has(teamNumber)) return null;
    seen.add(teamNumber);
    return teamNumber;
  });
}

function normalizePicklistColumns(columns) {
  const next = Array.isArray(columns) ? columns.slice(0, picklistColumnCount) : [];
  while (next.length < picklistColumnCount) next.push("");
  return next.map((entry) => {
    if (!entry) return "";
    if (typeof entry !== "string") return "";
    return normalizeSourceEntry(entry);
  });
}

function normalizeSourceEntry(entry) {
  if (!entry || typeof entry !== "string") return "";
  if (entry.startsWith("metric:")) {
    const metricId = entry.slice(7);
    return currentRankableMetrics().some((metric) => metric.id === metricId) ? `metric:${metricId}` : "";
  }
  if (entry.startsWith("sort:")) {
    return entry === "sort:sort-epa" ? "metric:source:epa:total" : "";
  }
  if (entry.startsWith("picklist:")) {
    const id = resolvePicklistId(entry.slice(9));
    return id ? `picklist:${id}` : "";
  }
  if (currentRankableMetrics().some((metric) => metric.id === entry)) {
    return `metric:${entry}`;
  }
  const legacyPicklistId = resolvePicklistId(entry);
  return legacyPicklistId ? `picklist:${legacyPicklistId}` : "";
}

function activePicklist() {
  return state.picklists.find((picklist) => picklist.id === state.activePicklist) || state.picklists[0];
}

function activeSortEquation() {
  return state.sortEquations.find((equation) => equation.id === state.activeSortEquation) || state.sortEquations[0];
}

function isProtectedSortEquation(equation) {
  return Boolean(equation?.locked);
}

function updatePicklist(id, updater) {
  state.picklists = state.picklists.map((picklist) => (picklist.id === id ? updater(picklist) : picklist));
  saveState();
  render();
}

function updateSortEquation(id, updater) {
  if (id === protectedEpaSortId) return;
  state.sortEquations = state.sortEquations.map((equation) => (equation.id === id ? updater(equation) : equation));
  saveState();
  render();
}

function termsFromLegacyWeights(weights = {}) {
  const mappings = {
    scouterTotal: { metricId: "source:epa:total" },
    "source:scouter:total": { metricId: "source:epa:total" },
    epa: { metricId: "source:epa:total" },
    "source:epa:total": { metricId: "source:epa:total" },
    opr: { metricId: "source:opr:total" },
    "source:opr:total": { metricId: "source:opr:total" },
    pridge: { metricId: "source:pridge:total" },
    "source:pridge:total": { metricId: "source:pridge:total" },
    defenseImpact: { metricId: "derived:defenseImpact" },
    "derived:defenseImpact": { metricId: "derived:defenseImpact" },
    consistency: { metricId: "derived:consistency" },
    "derived:consistency": { metricId: "derived:consistency" },
  };
  const terms = Object.entries(weights)
    .filter(([, weight]) => Number(weight) !== 0)
    .map(([id, weight]) => ({ operator: "+", weight: Number(weight), ...(mappings[id] || mappings.epa) }));
  return terms.length ? terms : defaultCriteriaTerms;
}

function metricIdFromLegacyTerm(term) {
  if (typeof term?.metricId === "string" && term.metricId) return term.metricId;
  if (term?.source && term?.component) return `${term.source === "derived" ? "derived" : "source"}:${term.source}:${term.component}`.replace("derived:derived:", "derived:");
  return currentEvent().defaultMetricId;
}

function normalizeCriteriaTerms(terms) {
  const normalized = (Array.isArray(terms) && terms.length ? terms : defaultCriteriaTerms).slice(0, 5).map((term, index) => {
    const metric = metricById(metricIdFromLegacyTerm(term));
    return {
      operator: index === 0 ? "+" : term.operator === "-" ? "-" : "+",
      weight: Number.isFinite(Number(term.weight)) ? Number(term.weight) : 1,
      metricId: metric.id,
    };
  });
  return normalized.length ? normalized : defaultCriteriaTerms;
}

function componentValue(team, term) {
  return teamMetricValue(team, metricFromTerm(term));
}

function scoreTeamByTerms(team, terms) {
  return normalizeCriteriaTerms(terms).reduce((score, term, index) => {
    const sign = index === 0 || term.operator === "+" ? 1 : -1;
    return score + sign * Number(term.weight || 0) * componentValue(team, term);
  }, 0);
}

function rankTeamsByTerms(terms) {
  return [...currentTeams()].sort((a, b) => scoreTeamByTerms(b, terms) - scoreTeamByTerms(a, terms)).map((team) => team.number);
}

function scoreTeamByEquation(team, equation) {
  if (equation.metricId) return teamMetricValue(team, metricById(equation.metricId));
  return scoreTeamByTerms(team, equation.terms);
}

function rankTeamsByEquation(equation) {
  return [...currentTeams()]
    .sort((a, b) => scoreTeamByEquation(b, equation) - scoreTeamByEquation(a, equation) || a.number - b.number)
    .map((team) => team.number);
}

function colorForScore(score, min, max) {
  if (max === min) return "transparent";
  const ratio = (score - min) / (max - min);
  if (ratio >= 2 / 3) {
    const strength = (ratio - 2 / 3) * 3;
    return `rgba(34, 197, 94, ${strength.toFixed(3)})`;
  }
  if (ratio <= 1 / 3) {
    const strength = (1 / 3 - ratio) * 3;
    return `rgba(239, 68, 68, ${strength.toFixed(3)})`;
  }
  return "transparent";
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] === undefined ? sorted[base] : sorted[base] + rest * (sorted[base + 1] - sorted[base]);
}

function metricById(id) {
  const metrics = currentMetrics();
  return metrics.find((metric) => metric.id === id) || metrics.find((metric) => metric.id === currentEvent().defaultMetricId) || metrics[0];
}

function metricTokenLabel(metric) {
  if (!metric) return "";
  if (metric.kind === "source" && metric.sourceId === "tba") return `tba.${metric.componentId}`;
  if (metric.kind === "source" && metric.sourceId === "epa") return `statbotics.${metric.componentId}`;
  if (metric.kind === "source" && metric.sourceId === "opr" && metric.componentId === "total") return "tba.opr.total";
  if (metric.kind === "source" && metric.sourceId === "pridge" && metric.componentId === "total") return "pridge.total";
  return metric.label || metric.id || "";
}

function canonicalizeRawMetrics(rawMetrics, eventModel = currentEvent()) {
  if (!rawMetrics || typeof rawMetrics !== "object") return {};
  const repairedRawMetrics = repairLegacySubmissionRawMetrics(rawMetrics, eventModel);
  const aliases = new Map();
  const numericFieldIds = new Set(currentScouterMetricDefinitions(eventModel).map((metricDefinition) => metricDefinition.id));
  currentFormulaFieldDefinitions(eventModel).forEach((metricDefinition) => {
    const normalizedId = normalizeImportToken(metricDefinition.id);
    const normalizedLabel = normalizeImportToken(metricDefinition.label || metricDefinition.id);
    [
      metricDefinition.id,
      normalizedId,
      scouterMetricFieldId(metricDefinition),
      `${metricDefinition.label} Score`,
      `${metricDefinition.label} pts`,
      `${metricDefinition.id} score`,
      `${normalizedId}pts`,
      `${normalizedId}score`,
      `${normalizedLabel}pts`,
      `${normalizedLabel}score`,
      ...(Array.isArray(metricDefinition.aliases) ? metricDefinition.aliases : []),
    ].forEach((alias) => aliases.set(normalizeImportToken(alias), metricDefinition.id));
  });

  return Object.entries(repairedRawMetrics).reduce((next, [key, value]) => {
    const componentId = aliases.get(normalizeImportToken(key));
    if (!componentId) return next;
    if (numericFieldIds.has(componentId)) {
      const numeric = Number(value);
      next[componentId] = Number.isFinite(numeric) ? numeric : null;
      return next;
    }
    if (value === null || value === undefined || value === "") {
      next[componentId] = null;
      return next;
    }
    next[componentId] = typeof value === "string" ? value : String(value);
    return next;
  }, {});
}

function normalizeScoutingSubmissions(values, eventModel = currentEvent()) {
  if (!Array.isArray(values)) return [];
  return values
    .filter((submission) => submission && Number.isFinite(Number(submission.teamNumber)))
    .map((submission) => ({
      ...submission,
      eventKey: submission.eventKey || eventModel.key,
      rawMetrics: canonicalizeRawMetrics(submission.rawMetrics, eventModel),
      confidenceReasons: Array.isArray(submission.confidenceReasons) ? submission.confidenceReasons : [],
      validity: submission.validity || "valid",
      confidenceTier: submission.confidenceTier || "high",
    }));
}

function normalizeScoutingReviewOverrides(values, eventModel = currentEvent()) {
  if (!Array.isArray(values)) return [];
  return values
    .filter((override) => override && normalizeText(override.submissionId))
    .map((override) => ({
      ...override,
      id: normalizeText(override.id) || createId("reviewOverride"),
      submissionId: normalizeText(override.submissionId),
      eventKey: normalizeText(override.eventKey) || eventModel.key,
      action: normalizeText(override.action),
      timestamp: normalizeText(override.timestamp) || new Date(0).toISOString(),
      clearedAt: normalizeText(override.clearedAt),
    }));
}

function normalizeActivityLog(values) {
  if (!Array.isArray(values)) return [];
  return values
    .filter((entry) => entry && entry.id && entry.message)
    .slice(0, 24);
}

function importedMatchCount() {
  return new Set(currentScoutingSubmissions().map((submission) => submission.matchNumber).filter(Boolean)).size;
}

function importedTeamCount() {
  return new Set(currentScoutingSubmissions().map((submission) => submission.teamNumber).filter(Boolean)).size;
}

function formatTimestamp(value) {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatMetricValue(value) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "string") return value;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return "NaN";
  return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(1);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function confidenceReasonLabel(reason) {
  return {
    missing_metric: "Missing mapped metric",
    schema_gap: "Missing required identity fields",
    duplicate_submission: "Duplicate team/match submission",
    sparse_matches: "Sparse scouting coverage",
    no_scouting_data: "No imported scouting data",
    seeded_scouting: "Using seeded scouting estimate",
    external_source: "External source available",
  }[reason] || reason;
}

function uniqueValues(values) {
  return [...new Set(values)];
}

function duplicateSubmissionKey(submission) {
  return sharedDuplicateSubmissionKey(submission);
}

function recalculateSubmissionReview(submission) {
  const reasons = uniqueValues((submission.confidenceReasons || []).filter(Boolean));
  if (submission.validity === "excluded" || reasons.includes("schema_gap")) {
    return { ...submission, confidenceReasons: reasons, validity: "excluded", confidenceTier: "low" };
  }
  if (reasons.includes("duplicate_submission")) {
    return { ...submission, confidenceReasons: reasons, validity: "flagged", confidenceTier: "low" };
  }
  if (reasons.length) {
    return { ...submission, confidenceReasons: reasons, validity: "flagged", confidenceTier: "medium" };
  }
  return { ...submission, confidenceReasons: [], validity: "valid", confidenceTier: "high" };
}

function activeScoutingReviewOverrideMap() {
  const map = new Map();
  (state.scoutingReviewOverrides || [])
    .filter((override) => override?.eventKey === state.activeEventKey && !override?.clearedAt)
    .forEach((override) => {
      map.set(override.submissionId, override);
    });
  return map;
}

function applyScoutingReviewOverride(submission, overrideMap = activeScoutingReviewOverrideMap()) {
  const override = overrideMap.get(submission.id);
  if (!override) return submission;
  if (override.action === "exclude") {
    return {
      ...submission,
      validity: "excluded",
      confidenceTier: "low",
      reviewOverride: override,
    };
  }
  if (override.action === "keep") {
    return recalculateSubmissionReview({
      ...submission,
      confidenceReasons: (submission.confidenceReasons || []).filter((reason) => reason !== "duplicate_submission"),
      reviewOverride: override,
    });
  }
  return submission;
}

function setSubmissionReviewOverride(submissionId, action, activityMessage) {
  const timestamp = new Date().toISOString();
  state.scoutingReviewOverrides = normalizeScoutingReviewOverrides(
    [
      ...(state.scoutingReviewOverrides || []).map((override) => (
        override.submissionId === submissionId && override.eventKey === state.activeEventKey && !override.clearedAt
          ? { ...override, clearedAt: timestamp }
          : override
      )),
      {
        id: createId("reviewOverride"),
        submissionId,
        eventKey: state.activeEventKey,
        action,
        timestamp,
        clearedAt: "",
      },
    ],
    currentEvent(),
  );
  if (activityMessage) pushActivity(activityMessage);
  saveState();
  render();
}

function clearSubmissionReviewOverride(submissionId, activityMessage) {
  const timestamp = new Date().toISOString();
  state.scoutingReviewOverrides = normalizeScoutingReviewOverrides(
    (state.scoutingReviewOverrides || []).map((override) => (
      override.submissionId === submissionId && override.eventKey === state.activeEventKey && !override.clearedAt
        ? { ...override, clearedAt: timestamp }
        : override
    )),
    currentEvent(),
  );
  if (activityMessage) pushActivity(activityMessage);
  saveState();
  render();
}

function submissionNeedsReview(submission) {
  if (submission.reviewOverride && !submission.reviewOverride.clearedAt) return true;
  const reasons = submission.confidenceReasons || [];
  if (submission.validity === "flagged") return true;
  if (submission.validity === "excluded") return reasons.some((reason) => reason !== "duplicate_submission");
  return false;
}

function duplicateGroups() {
  const grouped = new Map();
  currentScoutingSubmissions().forEach((submission) => {
    const key = duplicateSubmissionKey(submission);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(submission);
  });
  return [...grouped.entries()]
    .map(([key, submissions]) => {
      const active = submissions.filter((submission) => submission.validity !== "excluded");
      const hasDuplicateReason = active.some((submission) => (submission.confidenceReasons || []).includes("duplicate_submission"));
      const hasActiveOverride = submissions.some((submission) => submission.reviewOverride && !submission.reviewOverride.clearedAt);
      return { key, submissions, active, hasDuplicateReason, hasActiveOverride };
    })
    .filter((group) => (group.active.length > 1 && group.hasDuplicateReason) || group.hasActiveOverride)
    .sort((left, right) => {
      const leftSubmission = left.submissions[0];
      const rightSubmission = right.submissions[0];
      return Number(leftSubmission.matchNumber) - Number(rightSubmission.matchNumber) || Number(leftSubmission.teamNumber) - Number(rightSubmission.teamNumber);
    });
}

function flaggedSubmissionGroups() {
  const duplicate = duplicateGroups();
  const duplicateKeys = new Set(duplicate.map((group) => group.key));
  const standalone = currentScoutingSubmissions()
    .filter((submission) => submissionNeedsReview(submission) && !duplicateKeys.has(duplicateSubmissionKey(submission)))
    .map((submission) => ({ key: `single:${submission.id}`, submissions: [submission] }));
  return [...duplicate, ...standalone];
}

function pushActivity(message) {
  state.activityLog = normalizeActivityLog([
    {
      id: createId("activity"),
      kind: "review",
      timestamp: new Date().toISOString(),
      message,
    },
    ...state.activityLog,
  ]);
}

function keepSubmission(submissionId) {
  const submission = currentScoutingSubmissions().find((item) => item.id === submissionId);
  if (!submission) return;
  setSubmissionReviewOverride(
    submissionId,
    "keep",
    `Admin kept scouting row for Team ${submission.teamNumber} in Q${submission.matchNumber}.`,
  );
}

function excludeSubmission(submissionId) {
  const submission = currentScoutingSubmissions().find((item) => item.id === submissionId);
  if (!submission) return;
  setSubmissionReviewOverride(
    submissionId,
    "exclude",
    `Admin excluded scouting row for Team ${submission.teamNumber} in Q${submission.matchNumber}.`,
  );
}

function resetSubmissionReview(submissionId) {
  const submission = currentScoutingSubmissions().find((item) => item.id === submissionId);
  if (!submission) return;
  clearSubmissionReviewOverride(submissionId, `Admin reset duplicate review for Team ${submission.teamNumber} in Q${submission.matchNumber}.`);
}

function clearDuplicateGroup(groupKey) {
  const group = duplicateGroups().find((entry) => entry.key === groupKey);
  if (!group) return;
  const timestamp = new Date().toISOString();
  const activeSubmissionIds = new Set(group.submissions.filter((submission) => submission.validity !== "excluded").map((submission) => submission.id));
  const nextOverrides = [
    ...(state.scoutingReviewOverrides || []).map((override) => (
      activeSubmissionIds.has(override.submissionId) && override.eventKey === state.activeEventKey && !override.clearedAt
        ? { ...override, clearedAt: timestamp }
        : override
    )),
    ...group.submissions
      .filter((submission) => submission.validity !== "excluded")
      .map((submission) => ({
        id: createId("reviewOverride"),
        submissionId: submission.id,
        eventKey: state.activeEventKey,
        action: "keep",
        timestamp,
        clearedAt: "",
      })),
  ];
  state.scoutingReviewOverrides = normalizeScoutingReviewOverrides(
    nextOverrides,
    currentEvent(),
  );
  const sample = group.submissions[0];
  pushActivity(`Admin cleared duplicate flags for Team ${sample.teamNumber} in Q${sample.matchNumber}.`);
  saveState();
  render();
}

function usableSubmission(submission) {
  return submission.validity !== "excluded";
}

function equationResultToTrendValues(result, baseTrend = []) {
  if (!isSeriesFormulaResult(result)) {
    const total = Number(result?.value);
    if (!Number.isFinite(total)) return Array.isArray(baseTrend) ? baseTrend.map(() => 0) : [];
    const baseline = average(Array.isArray(baseTrend) ? baseTrend : []) || 1;
    return (Array.isArray(baseTrend) ? baseTrend : []).map((value) => roundValue((value / baseline) * total));
  }
  return (result.entries || []).map((entry) => {
    const numeric = Number(entry.value);
    return Number.isFinite(numeric) ? roundValue(numeric) : 0;
  });
}

function applyEquationBackedScoutingRollups(baseTeam, overlaidTeam, eventModel = currentEvent()) {
  const scoringComponents = Array.isArray(eventModel?.scoringComponents) ? eventModel.scoringComponents : [];
  if (!scoringComponents.length) return overlaidTeam;
  const componentValues = {};
  const componentTrend = {};
  scoringComponents.forEach((component) => {
    const evaluation = evaluateEquationForTeam(baseTeam, component.id, { eventModel });
    const result = evaluation?.result;
    if (isErrorFormulaResult(result)) {
      componentValues[component.id] = 0;
      componentTrend[component.id] = Array.isArray(baseTeam.matches) ? baseTeam.matches.map(() => 0) : [];
      return;
    }
    if (isSeriesFormulaResult(result)) {
      const values = (result.entries || [])
        .map((entry) => Number(entry.value))
        .filter((value) => Number.isFinite(value));
      componentValues[component.id] = values.length ? roundValue(average(values)) : 0;
      componentTrend[component.id] = equationResultToTrendValues(result, baseTeam.matches);
      return;
    }
    const scalar = Number(result?.value);
    componentValues[component.id] = Number.isFinite(scalar) ? roundValue(scalar) : 0;
    componentTrend[component.id] = equationResultToTrendValues(result, baseTeam.matches);
  });
  const total = roundValue(Object.values(componentValues).reduce((sum, value) => sum + Number(value || 0), 0));
  const totalTrend = Array.isArray(baseTeam.matches) ? equationResultToTrendValues({ value: total }, baseTeam.matches) : [];
  return {
    ...overlaidTeam,
    sources: {
      ...overlaidTeam.sources,
      scouter: {
        ...(overlaidTeam.sources?.scouter || {}),
        total,
        components: {
          ...Object.fromEntries(scoringComponents.map((component) => [component.id, 0])),
          ...(overlaidTeam.sources?.scouter?.components || {}),
          ...componentValues,
        },
        trend: totalTrend,
        componentTrend: {
          ...(overlaidTeam.sources?.scouter?.componentTrend || {}),
          ...componentTrend,
        },
      },
    },
    recentWindow: overlaidTeam.recentWindow
      ? {
        ...overlaidTeam.recentWindow,
        sources: {
          ...overlaidTeam.recentWindow.sources,
          scouter: {
            ...(overlaidTeam.recentWindow.sources?.scouter || {}),
            total,
            components: {
              ...Object.fromEntries(scoringComponents.map((component) => [component.id, 0])),
              ...(overlaidTeam.recentWindow.sources?.scouter?.components || {}),
              ...componentValues,
            },
            trend: totalTrend,
            componentTrend: {
              ...(overlaidTeam.recentWindow.sources?.scouter?.componentTrend || {}),
              ...componentTrend,
            },
          },
        },
      }
      : overlaidTeam.recentWindow,
    matches: totalTrend.length ? totalTrend : overlaidTeam.matches,
  };
}

function overlayTeamWithScouting(baseTeam) {
  if (!buildTeamScoutingOverlay) return baseTeam;
  const overlaidTeam = buildTeamScoutingOverlay(baseTeam, {
    submissions: currentScoutingSubmissions(),
    scoringComponents: currentEvent().scoringComponents,
    scouterMetricDefinitions: currentScouterMetricDefinitions(),
    derivedMetricDefinitions: currentDerivedMetricDefinitions(),
    recentMatchCount: state.recentMatchCount,
  });
  return applyEquationBackedScoutingRollups(baseTeam, overlaidTeam, currentEvent());
}

function currentScoutingWindow() {
  return state.scoutingWindow === "recent" ? "recent" : "all";
}

function currentRecentMatchCount() {
  return Math.max(1, Number(state.recentMatchCount) || 12);
}

function currentScoutingImportShouldReplace() {
  const event = currentEvent();
  const sourceUrl = currentScoutingSourceUrl();
  if (matchesEventSheetSourceUrl(sourceUrl, event)) return true;
  return Boolean(eventWorkspaceUsesSample(currentEventWorkspace()) && !sourceUrl);
}

function scoutingWindowLabel() {
  return currentScoutingWindow() === "recent" ? `Recent ${currentRecentMatchCount()}` : "All Matches";
}

function derivedMetricFieldOptions() {
  return currentScouterMetricDefinitions().map((metricDefinition) => ({
    id: metricDefinition.id,
    label: metricDefinition.label,
    unit: metricDefinition.unit,
  }));
}

function currentSeasonDefinition(eventModel = currentEvent()) {
  return seasonFramework.seasonDefinitions?.[eventModel.season] || null;
}

function currentScoringMatrixPresets(eventModel = currentEvent()) {
  return Array.isArray(currentSeasonDefinition(eventModel)?.scoringMatrixPresets) ? currentSeasonDefinition(eventModel).scoringMatrixPresets : [];
}

function derivedMetricScopeSummary() {
  return {
    seasonKey: String(currentEvent().season),
    profileKey: currentProfileMetricScopeKey(),
    seasonDefinitions: derivedMetricConfigScopeDefinitions("season", String(currentEvent().season)),
    profileDefinitions: derivedMetricConfigScopeDefinitions("profile", currentProfileMetricScopeKey()),
  };
}

function derivedMetricPreviewValue(definition, team, window = "all") {
  if (!definition || !team || !aggregateSubmissionMatches || !evaluateDerivedMetricDefinition) return 0;
  const aggregatedMatches = aggregateSubmissionMatches(
    currentScoutingSubmissions().filter((submission) => Number(submission.teamNumber) === team.number),
    {
      scoringComponentIds: currentEvent().scoringComponents.map((component) => component.id),
      scouterMetricIds: currentScouterMetricDefinitions().map((metricDefinition) => metricDefinition.id),
    },
  );
  const scopedMatches = window === "recent" ? metricEngine.sliceRecentMatches(aggregatedMatches, currentRecentMatchCount()) : aggregatedMatches;
  const preciseScouterComponents = Object.fromEntries(
    currentScouterMetricDefinitions().map((metricDefinition) => [
      metricDefinition.id,
      average(scopedMatches.map((match) => Number(match.components?.[metricDefinition.id] || 0))),
    ]),
  );
  return evaluateDerivedMetricDefinition(definition, preciseScouterComponents, { aggregatedMatches: scopedMatches });
}

function confidenceRank(tier) {
  return { high: 0, medium: 1, low: 2 }[tier] ?? 1;
}

function confidenceSeverity(tier) {
  return { high: "good", medium: "warn", low: "danger" }[tier] || "warn";
}

function confidenceLabel(tier) {
  return { high: "High", medium: "Medium", low: "Low" }[tier] || "Medium";
}

function metricConfidenceModel(team, metric) {
  if (!metric) return { tier: "medium", reasons: [] };
  if (metric.kind === "source" && ["epa", "opr", "pridge"].includes(metric.sourceId)) {
    return { tier: "high", reasons: ["external_source"] };
  }
  if (metric.kind === "source" && metric.sourceId === "scouter") {
    return team.scouting?.confidence || { tier: "medium", reasons: ["no_scouting_data"] };
  }
  if (metric.kind === "derived") {
    return team.scouting?.confidence || { tier: "medium", reasons: ["seeded_scouting"] };
  }
  return { tier: "medium", reasons: [] };
}

function equationConfidenceModel(team, equation) {
  const terms = normalizeCriteriaTerms(equation?.terms || []);
  if (!terms.length) return { tier: "medium", reasons: [] };
  const weightedTerms = terms.map((term) => ({ term, weight: Math.abs(Number(term.weight) || 0) })).filter((entry) => entry.weight > 0);
  const totalWeight = weightedTerms.reduce((sum, entry) => sum + entry.weight, 0) || 1;
  const contributors = weightedTerms
    .map((entry) => ({ ...entry, effectiveWeight: entry.weight / totalWeight }))
    .filter((entry) => entry.effectiveWeight >= 0.1);
  const inputs = (contributors.length ? contributors : weightedTerms).map((entry) => metricConfidenceModel(team, metricFromTerm(entry.term)));
  const tier = inputs.reduce((worst, current) => (confidenceRank(current.tier) > confidenceRank(worst) ? current.tier : worst), "high");
  const reasons = uniqueValues(inputs.flatMap((input) => input.reasons || []));
  return { tier, reasons };
}

function renderConfidenceBadge(confidence) {
  if (!confidence) return "";
  const reasons = (confidence.reasons || []).map(confidenceReasonLabel).join(", ");
  const title = reasons ? `Confidence: ${confidenceLabel(confidence.tier)}. ${reasons}.` : `Confidence: ${confidenceLabel(confidence.tier)}.`;
  return `<span class="flag ${confidenceSeverity(confidence.tier)} confidence-flag" title="${escapeAttribute(title)}">Confidence: ${confidenceLabel(confidence.tier)}</span>`;
}

function renderSchemaDiffSummary(schemaDiff) {
  if (!schemaDiff) return `<p class="muted">No schema diagnostics available.</p>`;
  const added = schemaDiff.added || [];
  const removed = schemaDiff.removed || [];
  const typeChanged = schemaDiff.typeChanged || [];
  if (!added.length && !removed.length && !typeChanged.length) {
    return `<p class="muted">No schema drift detected.</p>`;
  }
  return `
    <div class="issue-list">
      ${added.map((fieldDefinition) => `<div class="issue-row good"><strong>Added</strong><span>${escapeHtml(fieldDefinition.label || fieldDefinition.id)} (${escapeHtml(fieldDefinition.id)})</span></div>`).join("")}
      ${removed.map((fieldDefinition) => `<div class="issue-row warn"><strong>Removed</strong><span>${escapeHtml(fieldDefinition.label || fieldDefinition.id)} (${escapeHtml(fieldDefinition.id)})</span></div>`).join("")}
      ${typeChanged.map((fieldDefinition) => `<div class="issue-row danger"><strong>Type Changed</strong><span>${escapeHtml(fieldDefinition.id)}: ${escapeHtml(fieldDefinition.previousType)} -> ${escapeHtml(fieldDefinition.currentType)}</span></div>`).join("")}
    </div>
  `;
}

function renderDependencyDiagnosticsList(entries, emptyLabel) {
  if (!entries?.length) return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
  return `
    <div class="issue-list">
      ${entries.map((entry) => `
        <div class="issue-row danger">
          <strong>${escapeHtml(entry.label || entry.id)}</strong>
          <span>${escapeHtml(uniqueValues((entry.failures || []).map((failure) => failure.message || failure.reason || failure.id)).join(" | "))}</span>
        </div>
      `).join("")}
    </div>
  `;
}

function runImportPreview() {
  state.importResult = previewScoutingImport({
    csvText: state.importCsvText,
    eventModel: currentEvent(),
    activeEventKey: state.activeEventKey,
    existingSubmissions: state.scoutingSubmissions,
    templateProfileId: state.importSelectedProfileId,
  });
  render();
}

function commitImportPreview(options = {}) {
  if (!state.importResult?.ok || !state.importResult.summary) return;
  const preview = state.importResult;
  const importedCsvText = state.importCsvText;
  const replaceExisting = currentScoutingImportShouldReplace();
  const committed = commitScoutingImport({
    preview,
    existingSubmissions: state.scoutingSubmissions,
    existingActivity: state.activityLog,
    replaceExisting,
  });
  state.scoutingSubmissions = normalizeScoutingSubmissions(
    stampScoutingSubmissionMetadata(committed.submissions, currentEvent(), {
      scoutingImportSource: options.scoutingImportSource || (replaceExisting ? "event-sheet-source" : "manual"),
    }),
    currentEvent(),
  );
  state.activityLog = normalizeActivityLog(committed.activity);
  registerSeasonScoutingProfile(currentEvent().season, {
    id: preview.summary.profileId,
    label: preview.summary.profileLabel,
  });
  if (state.importDraftSource === "attached") {
    markCurrentScoutingAttachmentSuccess(preview, importedCsvText);
  }
  state.importResult = null;
  state.importCsvText = "";
  state.importSelectedProfileId = "";
  state.importDraftSource = "";
  saveState();
  render();
}

function switchImportContext(eventKey) {
  if (!eventKey) return;
  switchActiveEvent(eventKey, {
    activeView: "admin",
    preserveImportDraft: true,
    rerunImportPreview: true,
  });
}

function setImportError(message) {
  state.importResult = {
    ok: false,
    errors: [message],
    warnings: [],
    summary: null,
  };
  render();
}

function loadPreparedScoutingCsv(csvText, profileId = "", options = {}) {
  if (shouldSkipUnchangedAttachedSource(csvText, options)) {
    markCurrentScoutingAttachmentSuccess(
      {
        summary: {
          metadata: {
            schemaId: currentScoutingAttachment()?.schemaSignature || "",
          },
        },
      },
      csvText,
      { freshness: "fresh" },
    );
    saveState();
    render();
    return;
  }
  state.importCsvText = csvText;
  state.importSelectedProfileId = profileId;
  state.importDraftSource = options.importDraftSource || "";
  state.importResult = null;
  saveState();
  runImportPreview();
  if (options.autoCommit && state.importResult?.ok) {
    commitImportPreview({
      scoutingImportSource: options.scoutingImportSource,
    });
  }
}

function loadPreparedScoutingJson(jsonText, options = {}) {
  if (shouldSkipUnchangedAttachedSource(jsonText, options)) {
    markCurrentScoutingAttachmentSuccess(
      {
        summary: {
          metadata: {
            schemaId: currentScoutingAttachment()?.schemaSignature || "",
          },
        },
      },
      jsonText,
      { freshness: "fresh" },
    );
    saveState();
    render();
    return;
  }
  state.importCsvText = jsonText;
  state.importSelectedProfileId = "canonical-json-v1";
  state.importDraftSource = options.importDraftSource || "";
  state.importResult = previewScoutingJsonImport({
    jsonText,
    eventModel: currentEvent(),
    activeEventKey: state.activeEventKey,
    existingSubmissions: state.scoutingSubmissions,
    profileId: options.profileId,
    profileLabel: options.profileLabel,
    translationVersion: options.translationVersion,
  });
  saveState();
  render();
  if (options.autoCommit && state.importResult?.ok) {
    commitImportPreview({
      scoutingImportSource: options.scoutingImportSource,
    });
  }
}

function loadPreparedScoutingSheet(csvText, profileId = "", options = {}) {
  if (typeof sharedTranslateEventSheetToCanonical === "function") {
    const translated = sharedTranslateEventSheetToCanonical(currentEvent(), csvText, { templateProfileId: profileId });
    loadPreparedScoutingJson(buildCanonicalSheetJsonText(translated), {
      ...options,
      profileId: translated.templateProfileId || profileId,
      profileLabel: translated.profileLabel,
      translationVersion: translated.translatorVersion,
    });
    return;
  }
  loadPreparedScoutingCsv(sharedAdaptEventSheetCsv(currentEvent(), csvText, { templateProfileId: profileId }), profileId, options);
}

function loadEventSheetSample(options = {}) {
  const event = currentEvent();
  const sampleCsvText = event.sheet?.sampleCsvText || "";
  if (!sampleCsvText) return;
  const profileId = eventWorkspaceProfileId(currentEventWorkspace()) || "";
  loadPreparedScoutingSheet(sampleCsvText, profileId, {
    ...options,
    importDraftSource: "attached",
  });
}

async function loadScoutingData(options = {}) {
  const event = currentEvent();
  const attachmentLoad = describeEventWorkspaceScoutingAttachmentLoad(currentEventWorkspace(), event);
  const sourceUrl = currentScoutingSourceUrl();
  if (attachmentLoad.kind === "embedded-sample" && !sourceUrl) {
    markCurrentScoutingAttachmentAttempt();
    loadEventSheetSample(options);
    return;
  }

  if (!attachmentLoad.canLoad) {
    markCurrentScoutingAttachmentFailure("Missing scouting source URL.");
    setImportError("Enter a scouting spreadsheet URL before loading scouting data.");
    return;
  }

  if (attachmentLoad.kind === "remote-json" || attachmentLoad.kind === "local-json") {
    try {
      markCurrentScoutingAttachmentAttempt();
      const jsonText =
        attachmentLoad.kind === "local-json"
          ? await readLocalAttachmentText(currentScoutingAttachment()?.attachmentId)
          : await (async () => {
            const response = await fetch(sourceUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response.text();
          })();
      loadPreparedScoutingJson(jsonText, {
        ...options,
        importDraftSource: "attached",
      });
    } catch (error) {
      markCurrentScoutingAttachmentFailure(error?.message || "Unable to load canonical scouting JSON.");
      setImportError(`Unable to load scouting JSON right now. ${error?.message || "Check the attachment source and try again."}`);
    }
    return;
  }

  if (attachmentLoad.kind === "local-csv") {
    try {
      markCurrentScoutingAttachmentAttempt();
      const csvText = await readLocalAttachmentText(currentScoutingAttachment()?.attachmentId);
      const profileId = eventWorkspaceProfileId(currentEventWorkspace()) || "";
      loadPreparedScoutingSheet(csvText, profileId, {
        ...options,
        importDraftSource: "attached",
      });
    } catch (error) {
      markCurrentScoutingAttachmentFailure(error?.message || "Unable to load local scouting data.");
      setImportError(`Unable to load the saved local scouting file. ${error?.message || "Re-select the file and try again."}`);
    }
    return;
  }

  try {
    markCurrentScoutingAttachmentAttempt();
    const requestUrl =
      attachmentLoad.kind === "google-sheet-url"
        ? describeGoogleSheetInfo(sourceUrl)?.csvUrl
        : sourceUrl;
    if (!requestUrl) {
      throw new Error("Unsupported scouting source URL.");
    }
    const response = await fetch(requestUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const csvText = await response.text();
    const profileId = eventWorkspaceProfileId(currentEventWorkspace()) || "";
    loadPreparedScoutingSheet(csvText, profileId, {
      ...options,
      importDraftSource: "attached",
    });
  } catch (error) {
    if (attachmentLoad.kind === "embedded-sample" || shouldFallbackToCachedEventSheetSample(sourceUrl, event)) {
      loadEventSheetSample(options);
      return;
    }
    markCurrentScoutingAttachmentFailure(error?.message || "Unable to load scouting data.");
    setImportError(`Unable to load scouting data from that sheet right now. ${error?.message || "Try the event's cached sheet or paste CSV manually."}`);
  }
}

function normalizeImportToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}
function adaptEventSheetCsv(eventModel, csvText, options = {}) {
  return sharedAdaptEventSheetCsv(eventModel, csvText, options);
}

function teamDetailMetric() {
  return metricById(state.teamDetailMetric);
}

function picklistCompareMetric() {
  return metricById(state.picklistCompareMetric);
}

function analysisSortEquations() {
  return state.sortEquations.filter((equation) => !isProtectedSortEquation(equation));
}

function analysisSelectionModel() {
  const metric = metricById(state.metric);
  return { type: "metric", id: metric.id, label: metric.label, unit: metric.unit, metric };
}

function filterResultEntries(filterResult) {
  return Array.isArray(filterResult?.entries) ? filterResult.entries : [];
}

function seriesResultLooksBoolean(result) {
  return filterResultEntries(result).every((entry) => Number.isNaN(Number(entry.value)) || [0, 1].includes(Number(entry.value)));
}

function evaluateSeasonFilterDefinitionForTeam(team, definition, options = {}) {
  const eventModel = options.eventModel || currentEvent();
  const formulaContext = options.formulaContext || buildTeamFormulaContext(team, eventModel);
  if (!definition || !formulaContext) {
    return { definition, result: { kind: "error", error: `Unknown filter "${definition?.id || ""}".` }, formulaContext };
  }
  const evaluationCache = options.evaluationCache || new Map();
  const evaluationStack = Array.isArray(options.evaluationStack) ? [...options.evaluationStack] : [];
  const equationEvaluationCache = options.equationEvaluationCache || new Map();
  const equationEvaluationStack = Array.isArray(options.equationEvaluationStack) ? [...options.equationEvaluationStack] : [];
  const groupEvaluationCache = options.groupEvaluationCache || new Map();
  const eventEvaluationCache = options.eventEvaluationCache || new Map();
  const recentEntryCount = currentRecentMatchCount();
  const cacheKey = `${formulaContext?.baseTeam?.number || team}:${definition.id}:${eventModel.key}:${recentEntryCount}`;
  if (evaluationCache.has(cacheKey)) return evaluationCache.get(cacheKey);
  if (evaluationStack.includes(definition.id)) {
    const circular = { definition, result: { kind: "error", error: `Circular filter reference: ${[...evaluationStack, definition.id].join(" -> ")}.` }, formulaContext };
    evaluationCache.set(cacheKey, circular);
    return circular;
  }
  const result = evaluateFormulaExpression(definition.formula, {
    recentEntryCount,
    resolveIdentifier: (identifier) =>
      resolveFormulaIdentifier(
        identifier,
        formulaContext,
        equationEvaluationCache,
        equationEvaluationStack,
        evaluationCache,
        [...evaluationStack, definition.id],
        groupEvaluationCache,
        eventEvaluationCache,
      ) || { kind: "error", error: `Unknown identifier "${identifier}".` },
    evaluateGroupFunction: ({ name, seriesAst, scopeId, filterAst, parentOptions }) =>
      evaluateGroupFormulaForContext(
        { name, seriesAst, scopeId, filterAst, parentOptions },
        formulaContext,
        equationEvaluationCache,
        equationEvaluationStack,
        evaluationCache,
        [...evaluationStack, definition.id],
        groupEvaluationCache,
      ),
    evaluateEventFunction: ({ name, valueAst, filterAst, parentOptions }) =>
      evaluateEventFormulaForContext(
        { name, valueAst, filterAst, parentOptions },
        formulaContext,
        equationEvaluationCache,
        equationEvaluationStack,
        evaluationCache,
        [...evaluationStack, definition.id],
        groupEvaluationCache,
        eventEvaluationCache,
      ),
    groupEvaluationCache,
    eventEvaluationCache,
  });
  const evaluation = { definition, result, formulaContext };
  evaluationCache.set(cacheKey, evaluation);
  return evaluation;
}

function evaluateSeasonFilterForTeam(team, filterId, options = {}) {
  const eventModel = options.eventModel || currentEvent();
  const definition = seasonFilterDefinitionById(filterId, eventModel);
  if (!definition) {
    return { definition, result: { kind: "error", error: `Unknown filter "${filterId}".` }, formulaContext: null };
  }
  return evaluateSeasonFilterDefinitionForTeam(team, definition, options);
}

function filterStatusForTeam(team, filterId, eventModel = currentEvent()) {
  const evaluation = evaluateSeasonFilterForTeam(team, filterId, { eventModel });
  if (isErrorFormulaResult(evaluation.result)) {
    return { label: "Invalid", severity: "danger", detail: evaluation.result.error };
  }
  if (!isSeriesFormulaResult(evaluation.result)) {
    return { label: "Event Only", severity: "warn", detail: "Filters must evaluate to a match-level result." };
  }
  if (!seriesResultLooksBoolean(evaluation.result)) {
    return { label: "Non-Boolean", severity: "warn", detail: "Filters must resolve to true/false style values such as `metric > 0`." };
  }
  return null;
}

function compareSlotIndexForTeam(teamNumber) {
  return state.picklistCompareTeams.indexOf(teamNumber);
}

function compareAccent(teamNumber) {
  const index = compareSlotIndexForTeam(teamNumber);
  return index < 0 ? null : compareTeamPalette[index];
}

function togglePicklistCompareTeam(teamNumber) {
  const existingIndex = compareSlotIndexForTeam(teamNumber);
  if (existingIndex >= 0) {
    state.picklistCompareTeams[existingIndex] = null;
    return true;
  }
  const emptyIndex = state.picklistCompareTeams.indexOf(null);
  if (emptyIndex < 0) return false;
  state.picklistCompareTeams[emptyIndex] = teamNumber;
  return true;
}

function teamByNumber(number) {
  return currentTeams().find((team) => team.number === Number(number));
}

function metricFromTerm(term) {
  return metricById(metricIdFromLegacyTerm(term));
}

function teamMetricValue(team, metric) {
  if (metric?.kind === "derived" && metric.definition?.expression) {
    const evaluation = evaluateEquationForTeam(team, metric.componentId);
    return evaluation.result.granularity === "event" ? Number(evaluation.result.value) : Number.NaN;
  }
  if (engineTeamMetricValue) return engineTeamMetricValue(team, metric, { window: currentScoutingWindow() });
  if (!team || !metric) return 0;
  if (metric.kind === "derived") return Number(team.derived?.[metric.componentId] || 0);
  if (metric.kind === "source" && metric.sourceId === "tba" && metric.granularity === "match") {
    const values = tbaMatchMetricsByTeam(team.number)
      .map((row) => Number(row?.[metric.componentId]))
      .filter((value) => Number.isFinite(value));
    return values.length ? average(values) : Number.NaN;
  }
  if (metric.componentId === "total") return Number(team.sources?.[metric.sourceId]?.total || 0);
  return Number(team.sources?.[metric.sourceId]?.components?.[metric.componentId] || 0);
}

function setTheme(theme) {
  state.theme = theme;
  document.documentElement.dataset.theme = theme;
  saveState();
  render();
}

function currentRouteSnapshot() {
  return {
    view: state.activeView,
    selectedTeam: state.selectedTeam,
    selectedMatch: state.selectedMatch,
  };
}

function pushViewHistory() {
  const snapshot = currentRouteSnapshot();
  const last = state.viewHistory[state.viewHistory.length - 1];
  if (last && last.view === snapshot.view && last.selectedTeam === snapshot.selectedTeam && last.selectedMatch === snapshot.selectedMatch) return;
  state.viewHistory = [...state.viewHistory.slice(-19), snapshot];
}

function goBack(fallbackView = "teams") {
  const previous = state.viewHistory.pop();
  if (previous) {
    state.activeView = canView(previous.view) ? previous.view : fallbackView;
    state.selectedTeam = teamByNumber(previous.selectedTeam)?.number || currentEvent().teams[0].number;
    state.selectedMatch = currentMatches().some((match) => match.number === previous.selectedMatch)
      ? previous.selectedMatch
      : currentEvent().matches[0].number;
  } else {
    state.activeView = fallbackView;
  }
  state.contextMenu = null;
  state.inlineRename = null;
  saveState();
  render();
}

function toggleTheme() {
  setTheme(state.theme === "light" ? "dark" : "light");
}

function setView(view, options = {}) {
  const { recordHistory = true } = options;
  if (!canView(view)) view = "teams";
  if (recordHistory && state.activeView !== view) pushViewHistory();
  state.activeView = view;
  state.contextMenu = null;
  state.inlineRename = null;
  saveState();
  render();
}

function render() {
  const event = currentEvent();
  if (!state.user) {
    renderLogin();
    return;
  }
  if (!canView(state.activeView)) {
    state.activeView = "teams";
    saveState();
  }
  let content = "";
  try {
    content = renderView();
  } catch (error) {
    console.error("Render failed for view", state.activeView, error);
    if (state.activeView !== "teams") {
      state.activeView = "teams";
      saveState();
      try {
        content = renderView();
      } catch (fallbackError) {
        console.error("Fallback render failed", fallbackError);
        renderRecoveryScreen(fallbackError);
        return;
      }
    } else {
      renderRecoveryScreen(error);
      return;
    }
  }

  app.innerHTML = `
    <div class="app-shell ${state.menuExpanded ? "menu-expanded" : "menu-collapsed"}">
      <aside class="sidebar">
        <div class="brand-row">
          <div>
            <p class="eyebrow">FRC</p>
            <h1>Scouting Analysis</h1>
          </div>
          <button class="icon-button" id="menuToggle" title="${state.menuExpanded ? "Collapse menu" : "Expand menu"}" aria-label="${state.menuExpanded ? "Collapse menu" : "Expand menu"}">
            ${icon("menu")}
          </button>
        </div>
        <div class="event-chip">
          <span class="muted">${event.season} ${event.seasonLabel}</span>
          <strong>${event.name}</strong>
          <span class="muted">${Math.max(event.matchesComplete, importedMatchCount())} matches imported</span>
        </div>
        <nav class="nav-list">
          ${visibleNavItems().map((item) => navButton(item)).join("")}
        </nav>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="page-title">
            <p class="eyebrow">${event.key}</p>
            <h1>${viewTitle(state.activeView)}</h1>
          </div>
          <div class="split-row">
            <div class="event-select" aria-label="Active event">
              <span class="muted">Active Event</span>
              <strong>${event.season} ${event.name}</strong>
            </div>
            ${renderGlobalRecentMatchControl()}
            ${renderThemeToggle()}
            <button class="action-button" id="logoutButton" title="Sign out ${state.user}" aria-label="Sign out ${state.user}">
              ${icon("user")}
              <span>${state.user}</span>
              ${isAdmin() ? `<span class="user-role">Admin</span>` : ""}
            </button>
          </div>
        </header>
        <section class="content">${content}</section>
      </main>
    </div>
  `;

  bindShellEvents();
}

function renderSafely() {
  try {
    render();
  } catch (error) {
    console.error("App bootstrap failed", error);
    renderRecoveryScreen(error);
  }
}

function renderLogin() {
  app.innerHTML = `
    <main class="login-shell">
      <section class="login-panel">
        <div class="brand-row">
          <div>
            <p class="eyebrow">FRC Event Strategy</p>
            <h1>Scouting Analysis</h1>
          </div>
          ${renderThemeToggle()}
        </div>
        <div class="login-actions">
          <label>
            Existing user
            <select id="existingUser">
              <option value="">Select user</option>
              ${state.users.map((user) => `<option value="${user}">${userLabel(user)}</option>`).join("")}
            </select>
          </label>
          <button class="primary" id="loginButton">Continue</button>
          <label>
            New user
            <input id="newUser" placeholder="Name" autocomplete="off" />
          </label>
          <button id="createUserButton">Create user</button>
        </div>
      </section>
    </main>
  `;

  document.querySelector("#themeToggle")?.addEventListener("click", toggleTheme);
  document.querySelector("#loginButton").addEventListener("click", () => {
    const selected = document.querySelector("#existingUser").value;
    if (!selected) return;
    state.user = selected;
    saveState();
    render();
  });
  document.querySelector("#createUserButton").addEventListener("click", () => {
    const input = document.querySelector("#newUser");
    const user = input.value.trim();
    if (!user) return;
    if (!state.users.includes(user)) state.users.push(user);
    state.user = user;
    saveState();
    render();
  });
}

function renderThemeToggle() {
  const nextTheme = state.theme === "light" ? "dark" : "light";
  const label = `Switch to ${nextTheme} mode`;
  return `
    <button class="icon-button theme-toggle" id="themeToggle" title="${label}" aria-label="${label}">
      ${icon(state.theme === "light" ? "sun" : "moon")}
    </button>
  `;
}

function renderGlobalRecentMatchControl() {
  return `
    <label class="range-control topbar-range-control">
      <span>Recent ${currentRecentMatchCount()}</span>
      <input id="globalRecentMatchCountInput" type="range" min="1" max="12" step="1" value="${currentRecentMatchCount()}" />
    </label>
  `;
}

function icon(name) {
  const paths = {
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 1 1 8 0v3"/>',
    user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
    moon: '<path d="M21 14.8A8.5 8.5 0 0 1 9.2 3 7 7 0 1 0 21 14.8Z"/>',
    teams: '<path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M2 21a6 6 0 0 1 12 0"/><path d="M17 11a3 3 0 1 0 0-6"/><path d="M22 21a5 5 0 0 0-6-5"/>',
    rankings: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    analysis: '<path d="M4 19h16"/><path d="M6 15h10"/><path d="M8 11h12"/><path d="M5 7h7"/><path d="M14 7h4"/>',
    derivedBuilder:
      '<path d="M10.75 6.5h-1.4a2.1 2.1 0 0 0-2.1 2.1v8.9"/><path d="M6.7 10.5h4.2"/><path d="M13.8 10.4l4 5"/><path d="M17.8 10.4l-4 5"/>',
    bullseye: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>',
    schedule: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
    matchup: '<path d="M7 7h10"/><path d="M7 17h10"/><path d="M9 7a3 3 0 1 1 0 6"/><path d="M15 17a3 3 0 1 1 0-6"/>',
    quality: '<path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17h.01"/>',
    picklists: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
    sortEquation:
      '<text x="12" y="17" text-anchor="middle" font-size="18" font-weight="700" fill="currentColor" stroke="none">Σ</text>',
    alliance: '<path d="M4 5h7v6H4z"/><path d="M13 5h7v6h-7z"/><path d="M4 13h7v6H4z"/><path d="M13 13h7v6h-7z"/>',
    admin: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2 3.4-.1-.1a1.7 1.7 0 0 0-2-.3 1.7 1.7 0 0 0-1 1.5V22h-4v-.5a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-2 .3l-.1.1-2-3.4.1-.1A1.7 1.7 0 0 0 4.6 15 1.7 1.7 0 0 0 3 14H2v-4h1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1 2-3.4.1.1a1.7 1.7 0 0 0 2 .3 1.7 1.7 0 0 0 1-1.5V2h4v.5a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 2-.3l.1-.1 2 3.4-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1H22v4h-1a1.7 1.7 0 0 0-1.6 1Z"/>',
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${paths[name] || paths.analysis}</svg>`;
}

function navButton(item) {
  const active = state.activeView === item.view ? "active" : "";
  return `
    <button class="nav-button ${active}" data-view="${item.view}" title="${item.label}" aria-label="${item.label}">
      <span class="nav-icon">${icon(item.icon)}</span>
      <span class="nav-label">${item.label}</span>
    </button>
  `;
}

function viewTitle(view) {
  return {
    teams: "Teams",
    teamDetail: "Team Detail",
    rankings: "Rankings",
    analysis: "Analysis",
    derivedBuilder: "Derived Equation Builder",
    schedule: "Match Schedule",
    matchup: "Matchup",
    quality: "Data Quality",
    picklistBuilder: "Picklist Builder",
    alliance: "Alliance Selection",
    admin: "Admin",
  }[view];
}

function bindShellEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => setView(button.dataset.view));
  });
  document.querySelectorAll("[data-history-back]").forEach((button) => {
    button.addEventListener("click", () => goBack(button.dataset.historyBack || "teams"));
  });
  document.querySelector("#themeToggle")?.addEventListener("click", toggleTheme);
  document.querySelector("#globalRecentMatchCountInput")?.addEventListener("input", (event) => {
    state.recentMatchCount = Math.max(1, Math.min(12, Number(event.target.value) || currentRecentMatchCount()));
    saveState();
    render();
  });
  document.querySelector("#menuToggle").addEventListener("click", () => {
    state.menuExpanded = !state.menuExpanded;
    saveState();
    render();
  });
  document.querySelector("#logoutButton").addEventListener("click", () => {
    state.user = "";
    saveState();
    render();
  });
  bindViewEvents();
  restoreBuilderGridScroll();
  restoreBuilderListScroll();
}

function installGlobalRecoveryGuards() {
  if (globalThis.__scoutingRecoveryGuardsInstalled) return;
  globalThis.__scoutingRecoveryGuardsInstalled = true;
  window.addEventListener("error", (event) => {
    if (!app) return;
    console.error("Unhandled error", event.error || event.message || event);
    renderRecoveryScreen(event.error || new Error(String(event.message || "Unexpected error")));
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (!app) return;
    const reason = event.reason instanceof Error ? event.reason : new Error(String(event.reason || "Unexpected rejection"));
    console.error("Unhandled rejection", reason);
    renderRecoveryScreen(reason);
  });
}

function renderView() {
  return {
    teams: renderTeams,
    teamDetail: () => renderTeamDetail(teamByNumber(state.selectedTeam)),
    rankings: renderRankings,
    analysis: renderAnalysis,
    derivedBuilder: renderDerivedBuilder,
    schedule: renderSchedule,
    matchup: renderMatchup,
    quality: renderQuality,
    picklistBuilder: renderPicklistBuilder,
    alliance: renderAlliance,
    admin: renderAdmin,
  }[state.activeView]();
}

function renderRecoveryScreen(error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error || "Unknown error");
  app.innerHTML = `
    <div class="app-shell menu-expanded">
      <main class="main">
        <header class="topbar">
          <div class="page-title">
            <p class="eyebrow">${currentEvent().key}</p>
            <h1>Recovery</h1>
          </div>
        </header>
        <section class="content">
          <article class="card">
            <div class="section-heading">
              <div>
                <h2>App State Recovery</h2>
                <p class="muted">The saved browser state triggered a rendering error. You can reset it here instead of staying on a blank screen.</p>
              </div>
            </div>
            <div class="issue-list">
              <div class="issue-row danger">${escapeHtml(message)}</div>
            </div>
            <div class="admin-actions" style="margin-top: 16px;">
              <button type="button" id="recoveryGoTeamsButton" class="primary">Reset To Teams</button>
              <button type="button" id="recoveryClearStorageButton">Clear Saved App State</button>
            </div>
          </article>
        </section>
      </main>
    </div>
  `;
  document.querySelector("#recoveryGoTeamsButton")?.addEventListener("click", () => {
    state.activeView = "teams";
    saveState();
    render();
  });
  document.querySelector("#recoveryClearStorageButton")?.addEventListener("click", () => {
    clearAppStorage();
    window.location.reload();
  });
}

function renderRankings() {
  const epaMetric = metricById("source:epa:total");
  const ranked = [...currentTeams()]
    .sort((a, b) => (a.eventRank || Infinity) - (b.eventRank || Infinity) || teamMetricValue(b, epaMetric) - teamMetricValue(a, epaMetric) || a.number - b.number)
    .map((team, index) => ({
      ...team,
      rank: team.eventRank || index + 1,
      rankingScore: rankingScoreForTeam(team),
      rp: rankingPoints(team),
      record: recordForTeam(team),
    }));
  return `
    <article class="card">
      <div class="section-heading">
        <div>
          <h2>Current Event Rankings</h2>
        </div>
        <span class="muted">Sorted by ranking score, then EPA</span>
      </div>
      <div class="ranking-table" role="table" aria-label="Current event rankings">
        <div class="ranking-row ranking-header" role="row">
          <span>Rank</span>
          <span>Team</span>
          <span>Ranking Score</span>
          <span>Record</span>
          <span>RP</span>
          <span>EPA</span>
          <span>Flags</span>
        </div>
        ${ranked
          .map(
            (team) => `
          <button class="ranking-row" data-team="${team.number}" role="row">
            <strong>${team.rank}</strong>
            <span>${team.number} ${team.name}</span>
            <span>${team.rankingScore.toFixed(2)}</span>
            <span>${team.record}</span>
            <span>${team.rp}</span>
            <span>${teamMetricValue(team, epaMetric).toFixed(1)}</span>
            <span>${renderDrivetrainBadge(team)}</span>
          </button>
        `,
          )
          .join("")}
      </div>
    </article>
  `;
}

function rankingScoreForTeam(team) {
  return Number(team.record?.qual?.rps || 0) || teamMetricValue(team, metricById("source:epa:total"));
}

function rankingPoints(team) {
  return team.record?.qual?.rps ?? Math.max(8, Math.round(teamMetricValue(team, metricById("source:epa:total")) / 4));
}

function recordForTeam(team) {
  if (team.record?.qual) {
    const qual = team.record.qual;
    return `${qual.wins}-${qual.losses}-${qual.ties}`;
  }
  const wins = Math.max(1, Math.min(8, Math.round(teamMetricValue(team, metricById("source:epa:total")) / 9)));
  const losses = Math.max(0, 8 - wins);
  return `${wins}-${losses}-0`;
}

function renderTeams() {
  const epaMetric = metricById("source:epa:total");
  const consistencyMetric = metricById("derived:consistency");
  return `
    <div class="team-title-row">
      <div>
        <h2>Event Teams</h2>
      </div>
      <span class="muted">${currentTeams().length} teams at ${currentEvent().name}</span>
    </div>
    <div class="team-grid" style="margin-top: 14px;">
      ${currentTeams()
        .sort((a, b) => a.number - b.number)
        .map(
          (team) => `
        <button class="team-card" data-team="${team.number}">
          <span class="avatar">${team.number}</span>
          <span class="team-meta">
            <strong>${team.name}</strong>
            <span class="muted">${teamMetricValue(team, epaMetric).toFixed(1)} EPA / ${teamMetricValue(team, consistencyMetric)}% consistency</span>
            ${renderDrivetrainBadge(team)}
          </span>
        </button>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderTeamDetail(team) {
  const availableTrendMetrics = currentMetrics().filter((metric) => metricUsesMatchDistribution(team, metric));
  const selectedMetric = availableTrendMetrics.find((metric) => metric.id === state.teamDetailMetric) || availableTrendMetrics[0] || teamDetailMetric();
  const scoutingConfidence = team.scouting?.confidence || { tier: "medium", reasons: ["no_scouting_data"] };
  const epaMetric = metricById("source:epa:total");
  const oprMetric = metricById("source:opr:total");
  const pridgeMetric = metricById("source:pridge:total");
  return `
    <article class="card">
        <div class="section-heading">
          <div>
            <h2>${team.name}</h2>
          </div>
          <div class="detail-actions">
          <button data-history-back="teams">Back</button>
          <select id="teamSelect" aria-label="Team">
            ${currentTeams().map((item) => `<option value="${item.number}" ${item.number === team.number ? "selected" : ""}>${item.number} ${item.name}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat"><span>${escapeHtml(selectedMetric.label)}</span><strong>${teamMetricValue(team, selectedMetric).toFixed(selectedMetric.unit === "%" ? 0 : 1)}${selectedMetric.unit === "%" ? "%" : ""}</strong></div>
        <div class="stat"><span>Scouting Confidence</span><strong>${escapeHtml(confidenceLabel(scoutingConfidence.tier))}</strong></div>
        <div class="stat"><span>EPA</span><strong>${teamMetricValue(team, epaMetric).toFixed(1)}</strong></div>
        <div class="stat"><span>OPR</span><strong>${teamMetricValue(team, oprMetric).toFixed(1)}</strong></div>
      </div>
      <div class="team-detail-grid">
        <div>
          <div class="section-heading">
            <div>
              <h3>Match Trend</h3>
              <p class="muted">Scouting window only applies to scouting-backed and derived metrics.</p>
            </div>
            <label class="team-trend-metric">
              <span class="muted">Metric</span>
              <select id="teamDetailMetricSelect" aria-label="Team detail metric">
                ${availableTrendMetrics.map((item) => `<option value="${item.id}" ${item.id === selectedMetric.id ? "selected" : ""}>${item.label}</option>`).join("")}
              </select>
            </label>
            <label class="team-trend-metric">
              <span class="muted">Window</span>
              <select id="scoutingWindowSelect" aria-label="Scouting window">
                <option value="all" ${currentScoutingWindow() === "all" ? "selected" : ""}>All Matches</option>
                <option value="recent" ${currentScoutingWindow() === "recent" ? "selected" : ""}>Recent ${currentRecentMatchCount()}</option>
              </select>
            </label>
          </div>
          ${renderSparkline(team, selectedMetric)}
        </div>
        <div class="compact-flags">
          <h3>Source Snapshot</h3>
          <p><strong>pRidge:</strong> ${teamMetricValue(team, pridgeMetric).toFixed(1)}</p>
          <p><strong>Rank:</strong> ${team.eventRank || "Unranked"}</p>
          <p><strong>Imported scouting matches:</strong> ${team.scouting?.importedMatches || 0}</p>
          <p><strong>Scouting confidence:</strong> ${escapeHtml(confidenceLabel(scoutingConfidence.tier))}</p>
          ${team.flags.length ? team.flags.map((flag) => `<p><span class="flag ${flag.severity}">${flag.label}</span> <span class="flag-evidence">${flag.evidence}</span></p>`).join("") : `<p class="muted">No active flags.</p>`}
        </div>
      </div>
    </article>
  `;
}

function metricTrendValues(team, metric) {
  if (metric?.kind === "derived" && metric.definition?.expression) {
    const evaluation = evaluateEquationForTeam(team, metric.componentId);
    return isSeriesFormulaResult(evaluation.result) ? evaluation.result.entries.map((entry) => Number(entry.value)) : [];
  }
  if (engineMetricTrendValues) return engineMetricTrendValues(team, metric, { window: currentScoutingWindow() });
  if (metric.kind === "source") {
    if (metric.sourceId === "tba" && metric.granularity === "match") {
      return tbaMatchMetricsByTeam(team.number)
        .map((row) => Number(row?.[metric.componentId]))
        .filter((value) => Number.isFinite(value));
    }
    if (metric.sourceId === "scouter" && metric.componentId === "total") {
      return Array.isArray(team.sources?.scouter?.trend) ? team.sources.scouter.trend : [];
    }
    if (metric.sourceId === "scouter" && metric.componentId !== "total" && Array.isArray(team.sources?.scouter?.componentTrend?.[metric.componentId])) {
      return team.sources.scouter.componentTrend[metric.componentId];
    }
    const sourceTrend = team.sources?.[metric.sourceId]?.trend || team.matches;
    if (metric.componentId === "total") return sourceTrend;
    const total = team.sources?.[metric.sourceId]?.total || 1;
    const component = team.sources?.[metric.sourceId]?.components?.[metric.componentId] || 0;
    return sourceTrend.map((value) => (value / total) * component);
  }
  if (Array.isArray(team.derivedTrend?.[metric.componentId])) {
    return team.derivedTrend[metric.componentId];
  }
  const baseline = average(team.matches) || 1;
  return team.matches.map((value) => (value / baseline) * teamMetricValue(team, metric));
}

function metricUsesMatchDistribution(team, metric) {
  if (!team || !metric) return false;
  if (metric?.kind === "derived" && metric.definition?.expression) {
    const evaluation = evaluateEquationForTeam(team, metric.componentId);
    return isSeriesFormulaResult(evaluation.result);
  }
  return metric.kind === "source" && (metric.sourceId === "scouter" || (metric.sourceId === "tba" && metric.granularity === "match"));
}

function applyCurrentScoutingWindowToEntries(entries) {
  const normalized = Array.isArray(entries) ? entries : [];
  if (currentScoutingWindow() !== "recent") return normalized;
  return normalized.slice(-currentRecentMatchCount());
}

function applyRecentMatchCountToEntries(entries, recentMatchCount = currentRecentMatchCount()) {
  const normalized = Array.isArray(entries) ? entries : [];
  return normalized.slice(-Math.max(1, Number(recentMatchCount) || currentRecentMatchCount()));
}

function analysisSeriesEntriesForMetric(team, metric, options = {}) {
  if (!team || !metric || !metricUsesMatchDistribution(team, metric)) return [];
  const useRecentWindow = options.window === "recent";
  if (metric?.kind === "derived" && metric.definition?.expression) {
    const evaluation = evaluateEquationForTeam(team, metric.componentId);
    const normalizedEntries = filterResultEntries(evaluation.result).filter((entry) => Number.isFinite(Number(entry.value)));
    return useRecentWindow ? applyRecentMatchCountToEntries(normalizedEntries, options.recentMatchCount) : normalizedEntries;
  }
  if (metric.kind === "source" && metric.sourceId === "tba" && metric.granularity === "match") {
    const entries = tbaMatchMetricsByTeam(team.number, currentEvent())
      .map((row) => ({
        key: row.matchNumber,
        value: Number(row?.[metric.componentId]),
      }))
      .filter((entry) => Number.isFinite(entry.value));
    return useRecentWindow ? applyRecentMatchCountToEntries(entries, options.recentMatchCount) : entries;
  }
  const aggregatedMatches = aggregateSubmissionMatches(
    currentScoutingSubmissions().filter((submission) => Number(submission.teamNumber) === Number(team.number)),
    {
      scoringComponentIds: (currentEvent().scoringComponents || []).map((component) => component.id),
      scouterMetricIds: currentScouterMetricDefinitions().map((metricDefinition) => metricDefinition.id),
      scouterMetricDefinitions: currentScouterMetricDefinitions(),
    },
  );
  const entries = aggregatedMatches.map((match) => ({
    key: match.matchNumber,
    value: metric.componentId === "total" ? match.total : Number(match.components?.[metric.componentId]),
  }));
  const normalizedEntries = entries.filter((entry) => Number.isFinite(Number(entry.value)));
  return useRecentWindow ? applyRecentMatchCountToEntries(normalizedEntries, options.recentMatchCount) : normalizedEntries;
}

function filteredSeriesEntriesForMetric(team, metric, options = {}) {
  return analysisSeriesEntriesForMetric(team, metric, options);
}

function analysisScoreForTeam(team, metric, options = {}) {
  if (!metricUsesMatchDistribution(team, metric)) return teamMetricValue(team, metric);
  const values = filteredSeriesEntriesForMetric(team, metric, options)
    .map((entry) => Number(entry.value))
    .filter((value) => Number.isFinite(value));
  return values.length ? average(values) : Number.NaN;
}

function truthy(value) {
  return Number.isFinite(Number(value)) && Number(value) !== 0;
}

function renderSparkline(team, metric) {
  const values = metricTrendValues(team, metric);
  if (!values.length || values.every((value) => Number(value || 0) === 0)) {
    return `<p class="muted">No ${escapeHtml(metric.label)} trend is available for this team yet.</p>`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = 16 + (index / Math.max(1, values.length - 1)) * 196;
      const y = 82 - ((value - min) / range) * 64;
      return `${x},${y}`;
    })
    .join(" ");
  return `
    <svg class="trend-chart" viewBox="0 0 220 100" role="img" aria-label="${escapeAttribute(`${metric.label} by match number`)}" width="100%" height="260">
      <line x1="16" y1="82" x2="212" y2="82" stroke="var(--line)" stroke-width="1"></line>
      <line x1="16" y1="18" x2="16" y2="82" stroke="var(--line)" stroke-width="1"></line>
      <text x="114" y="97" text-anchor="middle">Match Number</text>
      <text x="4" y="50" text-anchor="middle" transform="rotate(-90 4 50)">${metric.label} (${metric.unit})</text>
      <text x="14" y="20" text-anchor="end">${max.toFixed(metric.unit === "%" ? 0 : 1)}</text>
      <text x="14" y="84" text-anchor="end">${min.toFixed(metric.unit === "%" ? 0 : 1)}</text>
      <polyline points="${points}" fill="none" stroke="var(--accent)" stroke-width="3" vector-effect="non-scaling-stroke"></polyline>
      ${values
        .map((value, index) => {
          const x = 16 + (index / Math.max(1, values.length - 1)) * 196;
          const y = 82 - ((value - min) / range) * 64;
          return `<circle cx="${x}" cy="${y}" r="2.6" fill="var(--accent-strong)"><title>Match ${index + 1}: ${value.toFixed(metric.unit === "%" ? 0 : 1)} ${metric.unit}</title></circle>`;
        })
        .join("")}
    </svg>
  `;
}

function renderAnalysis() {
  const selection = analysisSelectionModel();
  const analysisWindowOptions = { window: "recent", recentMatchCount: currentRecentMatchCount() };
  const scoreForTeam = (team) => analysisScoreForTeam(team, selection.metric, analysisWindowOptions);
  const sortableScoreForTeam = (team) => {
    const value = scoreForTeam(team);
    return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
  };
  const ranked = [...currentTeams()].sort((a, b) => sortableScoreForTeam(b) - sortableScoreForTeam(a) || a.number - b.number);
  const allScores = ranked.map((team) => scoreForTeam(team));
  const distributions = ranked.map((team) => distributionForMetric(team, selection.metric.id, analysisWindowOptions));
  const finiteScores = allScores.filter((value) => Number.isFinite(value));
  const finiteDistributions = distributions.filter(
    (item) => Number.isFinite(item.min) && Number.isFinite(item.max) && Number.isFinite(item.mean) && Number.isFinite(item.median) && Number.isFinite(item.q1) && Number.isFinite(item.q3),
  );
  const globalMin = finiteDistributions.length ? Math.min(...finiteDistributions.map((item) => item.min)) : 0;
  const globalMax = finiteDistributions.length ? Math.max(...finiteDistributions.map((item) => item.max)) : globalMin;
  const eventAverage = finiteScores.length ? average(finiteScores) : 0;
  const axisTicks = Array.from({ length: 5 }, (_, index) => globalMin + ((globalMax - globalMin) * index) / 4);
  return `
    <div class="toolbar">
      <label>
        Metric
        <select id="metricSelect">
          ${analysisMetricOptions().map((item) => `<option value="${item.id}" ${item.id === state.metric ? "selected" : ""}>${metricTokenLabel(item)}</option>`).join("")}
        </select>
      </label>
      <div class="stat"><span>Event Average</span><strong>${eventAverage.toFixed(1)} ${selection.unit}</strong></div>
      ${renderBoxPlotLegend()}
    </div>
    <div class="analysis-chart" style="margin-top: 8px;">
      ${ranked.map((team, index) => renderChartRow(team, selection, distributions[index], globalMin, globalMax, eventAverage, scoreForTeam(team))).join("")}
    </div>
    <div class="analysis-axis-row" aria-hidden="true">
      <span></span>
      <div class="analysis-axis-meta">
        <div class="analysis-axis-ticks">
          ${axisTicks.map((value, index) => `<span style="left: ${(index / (axisTicks.length - 1)) * 100}%">${value.toFixed(1)}</span>`).join("")}
        </div>
        <span class="analysis-axis-label">${selection.label} (${selection.unit})</span>
      </div>
      <span></span>
    </div>
  `;
}

function renderDerivedBuilder() {
  const activeEquation = activeDerivedEquation();
  const activePreviewMetricId = String(state.activeDerivedPreviewMetricId || "");
  const equationListSelected = !activePreviewMetricId;
  const formulaTitle = activePreviewMetricId || activeEquation?.name || "New Equation";
  const formulaInputValue = activePreviewMetricId || activeEquation?.formula || "";
  const teams = currentEvent().teams.slice().sort((left, right) => left.number - right.number);
  const previewTeam = teams[0] || null;
  const previewStatus = !activePreviewMetricId && activeEquation && previewTeam ? equationStatusForTeam(previewTeam, activeEquation.id) : null;
  const previewEvaluation = !activePreviewMetricId && activeEquation && previewTeam ? evaluateEquationForTeam(previewTeam, activeEquation.id) : null;
  const identifiers = previewEvaluation?.result?.identifiers || [];
  const availableMetrics = currentDerivedAvailableMetrics(currentEvent(), activeEquation);
  const gridRows = teams.flatMap((team) => {
    const context = buildTeamFormulaContext(team);
    return (context?.matchRows || []).map((row, index, rows) => ({
      teamNumber: team.number,
      matchNumber: row.matchNumber,
      teamStart: index === 0,
      teamEnd: index === rows.length - 1,
      rowIndex: index,
      rowCount: rows.length,
      formulaContext: context,
    }));
  });
  const gridEquationCache = new Map();
  const gridFilterCache = new Map();
  const resultEvaluationCache = new Map();
  const identifierResultCache = new Map();
  const identifierSeriesMapCache = new Map();
  const equationSeriesMapCache = new Map();
  const teamEquationResultCache = new Map();
  const resolveGridCellValue = (identifier, rowModel) => {
    const cacheKey = `${rowModel.teamNumber}:${identifier}`;
    if (!identifierResultCache.has(cacheKey)) {
      identifierResultCache.set(
        cacheKey,
        resolveFormulaIdentifier(identifier, rowModel.formulaContext, gridEquationCache, [], gridFilterCache, []) || { kind: "error", error: `Unknown identifier "${identifier}".` },
      );
    }
    const result = identifierResultCache.get(cacheKey);
    if (isErrorFormulaResult(result)) return { text: "Invalid", className: "danger" };
    if (isSeriesFormulaResult(result)) {
      if (!identifierSeriesMapCache.has(cacheKey)) {
        identifierSeriesMapCache.set(cacheKey, new Map((result.entries || []).map((entry) => [entry.key, entry.value])));
      }
      const entryValue = identifierSeriesMapCache.get(cacheKey).get(rowModel.matchNumber);
      return { text: entryValue !== undefined ? formatMetricValue(entryValue) : "", className: "" };
    }
    return { text: rowModel.rowIndex === 0 ? formatMetricValue(result.value) : "", className: rowModel.rowIndex === 0 ? "" : "muted" };
  };
  const resolveResultCellValue = (rowModel) => {
    if (activePreviewMetricId) return resolveGridCellValue(activePreviewMetricId, rowModel);
    if (!activeEquation) return { text: "", className: "" };
    const teamKey = `${rowModel.teamNumber}:${activeEquation.id}`;
    if (!teamEquationResultCache.has(teamKey)) {
      const evaluation = evaluateEquationForTeam(rowModel.formulaContext.baseTeam, activeEquation.id, {
        formulaContext: rowModel.formulaContext,
        eventModel: currentEvent(),
        evaluationCache: resultEvaluationCache,
        filterEvaluationCache: gridFilterCache,
      });
      teamEquationResultCache.set(teamKey, evaluation.result);
    }
    const result = teamEquationResultCache.get(teamKey);
    if (isErrorFormulaResult(result)) return { text: rowModel.rowIndex === 0 ? "Invalid" : "", className: "danger" };
    if (isSeriesFormulaResult(result)) {
      if (!equationSeriesMapCache.has(teamKey)) {
        equationSeriesMapCache.set(teamKey, new Map((result.entries || []).map((entry) => [entry.key, entry.value])));
      }
      const matchValue = equationSeriesMapCache.get(teamKey).get(rowModel.matchNumber);
      return { text: matchValue !== undefined && !Number.isNaN(matchValue) ? formatMetricValue(matchValue) : "", className: "" };
    }
    return { text: rowModel.rowIndex === 0 && !Number.isNaN(result.value) ? formatMetricValue(result.value) : "", className: rowModel.rowIndex === 0 ? "" : "muted" };
  };
  const resultColumnLabel = activePreviewMetricId || activeEquation?.name || "Result";
  return `
    <div class="grid">
      <article class="card">
        <div class="derived-builder-layout">
          <aside class="derived-builder-sidebar">
            <div class="derived-formula-name derived-formula-name-sidebar">
              <strong>${escapeHtml(formulaTitle)} =</strong>
            </div>
            <section class="derived-pane">
              <div class="derived-pane-header">
                <h3>Derived Equations</h3>
                <button type="button" id="addDerivedEquationButton">New</button>
              </div>
              <div class="builder-list">
                ${currentSeasonEquationList()
                  .map((definition, index) => {
                    const status = previewTeam ? equationStatusForTeam(previewTeam, definition.id) : null;
                    const rename = state.inlineRename?.kind === "derivedEquation" && state.inlineRename?.id === definition.id;
                    return `
                      <div
                        class="builder-list-item ${equationListSelected && definition.id === ensureActiveDerivedEquation() ? "active" : ""}"
                        data-entity-row="derivedEquation:${definition.id}"
                        data-entity-kind="derivedEquation"
                        data-entity-id="${definition.id}"
                        data-entity-index="${index}"
                        draggable="false"
                      >
                        <span>
                          ${rename ? `<input class="inline-rename-input" data-inline-rename="derivedEquation:${definition.id}" value="${escapeAttribute(state.inlineRename.value)}" autocomplete="off" />` : escapeHtml(definition.name)}
                        </span>
                        ${status ? `<span class="confidence-badge ${status.severity}">${escapeHtml(status.label)}</span>` : ""}
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </section>
            <section class="derived-pane">
              <div class="derived-pane-header">
                <h3>Available Metrics</h3>
              </div>
              <div class="builder-list metric-catalog" data-builder-list-scroll="derived:metrics">
                ${availableMetrics.map((item) => `<div class="builder-list-item ${item.id === activePreviewMetricId ? "active" : ""}" data-derived-preview-metric="${escapeAttribute(item.id)}">${escapeHtml(item.id)}</div>`).join("")}
              </div>
            </section>
          </aside>
          <section class="derived-builder-main">
            <div class="derived-formula-header">
              <div class="derived-formula-bar">
                <textarea
                  id="derivedEquationFormulaInput"
                  class="admin-input derived-formula-input"
                  placeholder="average(opr.total)"
                  autocomplete="off"
                  rows="2"
                  spellcheck="false"
                  wrap="soft"
                >${escapeHtml(formulaInputValue)}</textarea>
                <div id="derivedFormulaAutocomplete" class="formula-autocomplete" hidden></div>
              </div>
              <div class="formula-function-menu" aria-label="Built-in functions">
                <button type="button" class="formula-function-button" id="formulaFunctionHelpButton" title="Open function help" aria-label="Open function help">f(x)</button>
                <div class="formula-function-popover">
                  ${renderHoverFormulaFunctionEntries()}
                </div>
              </div>
            </div>
            <div class="derived-grid-layout">
              <section class="derived-grid-column derived-grid-team">
                <header>Team</header>
                <div class="derived-grid-column-body" data-derived-scroll="team" data-builder-grid-column-scroll="derived:team">
                  ${gridRows.map((row) => `<div class="derived-grid-cell ${row.teamStart ? "team-start" : ""} ${row.teamEnd ? "team-end" : ""}">${row.teamNumber}</div>`).join("")}
                </div>
              </section>
              <section class="derived-grid-column derived-grid-match">
                <header>Match</header>
                <div class="derived-grid-column-body" data-derived-scroll="match" data-builder-grid-column-scroll="derived:match">
                  ${gridRows.map((row) => `<div class="derived-grid-cell ${row.teamStart ? "team-start" : ""} ${row.teamEnd ? "team-end" : ""}">${row.matchNumber}</div>`).join("")}
                </div>
              </section>
              <div class="derived-grid-content">
                <div class="derived-grid-shell" data-builder-grid-shell="derivedBuilder">
                  <div class="derived-grid-strip">
                    ${identifiers.map((identifier) => `
                      <section class="derived-grid-column">
                        <header>${escapeHtml(identifier)}</header>
                        <div class="derived-grid-column-body" data-derived-scroll="${escapeAttribute(identifier)}" data-builder-grid-column-scroll="${escapeAttribute(`derived:${identifier}`)}">
                          ${gridRows.map((row) => {
                            const value = resolveGridCellValue(identifier, row);
                            return `<div class="derived-grid-cell ${row.teamStart ? "team-start" : ""} ${row.teamEnd ? "team-end" : ""} ${value.className}">${escapeHtml(value.text)}</div>`;
                          }).join("")}
                        </div>
                      </section>
                    `).join("")}
                  </div>
                </div>
                <section class="derived-grid-column derived-grid-result">
                  <header>${escapeHtml(resultColumnLabel)}</header>
                  <div class="derived-grid-column-body" data-derived-scroll="result" data-builder-grid-column-scroll="derived:result">
                    ${gridRows.map((row) => {
                      const value = resolveResultCellValue(row);
                      return `<div class="derived-grid-cell ${row.teamStart ? "team-start" : ""} ${row.teamEnd ? "team-end" : ""} ${value.className}">${escapeHtml(value.text)}</div>`;
                    }).join("")}
                  </div>
                </section>
              </div>
            </div>
          </section>
        </div>
        ${renderContextMenu()}
      </article>
    </div>
  `;
}

function renderBoxPlotLegend() {
  return `
    <div class="boxplot-legend" aria-label="Box and whisker legend">
      <span><i class="legend-whisker"></i> Min/Max</span>
      <span><i class="legend-quartile"></i> Q1-Q3</span>
      <span><i class="legend-median"></i> Median</span>
      <span><i class="legend-mean"></i> Mean</span>
      <span><i class="legend-average"></i> Event Avg</span>
    </div>
  `;
}

function distributionForMetric(team, metricId, options = {}) {
  const metric = metricById(metricId);
  const values = metricUsesMatchDistribution(team, metric)
    ? filteredSeriesEntriesForMetric(team, metric, options).map((entry) => Number(entry.value)).filter((value) => Number.isFinite(Number(value)))
    : [];
  if (values.length > 1) {
    return {
      min: Math.min(...values),
      q1: quantile(values, 0.25),
      median: quantile(values, 0.5),
      q3: quantile(values, 0.75),
      max: Math.max(...values),
      mean: average(values),
      kind: "distribution",
    };
  }
  if (metricUsesMatchDistribution(team, metric) && state.activeAnalysisFilterId && values.length === 0) {
    return {
      min: 0,
      q1: 0,
      median: 0,
      q3: 0,
      max: 0,
      mean: 0,
      kind: "empty",
    };
  }
  const center = teamMetricValue(team, metric);
  const safeCenter = Number.isFinite(center) ? center : 0;
  return {
    min: safeCenter,
    q1: safeCenter,
    median: safeCenter,
    q3: safeCenter,
    max: safeCenter,
    mean: safeCenter,
    kind: Number.isFinite(center) ? "value" : "empty",
  };
}

function distributionForEquationScore(score, minScore, maxScore) {
  const spread = Math.max((maxScore - minScore) * 0.05, 1);
  return {
    min: score - spread,
    q1: score - spread * 0.45,
    median: score,
    q3: score + spread * 0.45,
    max: score + spread,
    mean: score,
  };
}

function renderChartRow(team, selection, dist, globalMin, globalMax, eventAverage, teamScore) {
  const scale = (value) => {
    const pct = ((value - globalMin) / (globalMax - globalMin || 1)) * 100;
    return Math.max(0, Math.min(100, pct));
  };
  const whiskerLeft = scale(dist.min);
  const whiskerWidth = scale(dist.max) - whiskerLeft;
  const qLeft = scale(dist.q1);
  const qWidth = scale(dist.q3) - qLeft;
  const median = scale(dist.median);
  const mean = scale(dist.mean);
  const avg = scale(eventAverage);
  const plotTitle = [
    `${team.number} ${team.name}`,
    `Min: ${dist.min.toFixed(1)} ${selection.unit}`,
    `Q1: ${dist.q1.toFixed(1)} ${selection.unit}`,
    `Median: ${dist.median.toFixed(1)} ${selection.unit}`,
    `Mean: ${dist.mean.toFixed(1)} ${selection.unit}`,
    `Q3: ${dist.q3.toFixed(1)} ${selection.unit}`,
    `Max: ${dist.max.toFixed(1)} ${selection.unit}`,
  ].join("\n");
  const teamScoreLabel = Number.isFinite(teamScore) ? teamScore.toFixed(1) : "Invalid";
  return `
    <div class="chart-row">
      <div class="chart-team">
        <span class="chart-badges">${renderDrivetrainBadge(team)}</span>
        <button class="chart-name" data-team-link="${team.number}">${team.number}</button>
      </div>
      <div class="plot" title="${escapeAttribute(plotTitle)}">
        <span class="event-average" style="left: ${avg}%"></span>
        <span class="whisker" style="left: ${whiskerLeft}%; width: ${whiskerWidth}%"></span>
        <span class="quartile" style="left: ${qLeft}%; width: ${qWidth}%"></span>
        <span class="median" style="left: ${median}%"></span>
        <span class="mean" style="left: ${mean}%"></span>
      </div>
      <div class="chart-value">${teamScoreLabel}</div>
    </div>
  `;
}

function renderSchedule() {
  return `
    <div class="section-heading">
      <div>
        <h2>Match Schedule</h2>
      </div>
    </div>
    <div class="grid">
      ${currentMatches()
        .map(
          (match) => `
        <article class="match-row" data-match-row="${match.number}" title="Open Q${match.number} matchup">
          <button class="match-link" data-match="${match.number}">Q${match.number}</button>
          <span class="alliance red">${match.red.map((team) => `<button class="pill team-pill" data-team="${team}">${team}</button>`).join("")}</span>
          <span class="alliance blue">${match.blue.map((team) => `<button class="pill team-pill" data-team="${team}">${team}</button>`).join("")}</span>
        </article>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderMatchup() {
  const match = currentMatches().find((item) => item.number === state.selectedMatch) || currentMatches()[0];
  return `
    <div class="section-heading">
      <div>
        <h2>Alliance Matchup</h2>
      </div>
      ${renderMatchNavigator(match, true)}
    </div>
    <div class="grid cols-2">
      ${renderAllianceCard("Red Alliance", match.red)}
      ${renderAllianceCard("Blue Alliance", match.blue)}
    </div>
  `;
}

function renderMatchNavigator(match, includeBack) {
  const matches = currentMatches();
  const matchIndex = matches.findIndex((item) => item.number === match.number);
  const prevMatch = matches[matchIndex - 1];
  const nextMatch = matches[matchIndex + 1];
  return `
    <div class="match-nav">
      ${includeBack ? `<button data-history-back="schedule">Back</button>` : ""}
      <button class="icon-button" data-match-nav="${prevMatch?.number || ""}" ${prevMatch ? "" : "disabled"} title="Previous match" aria-label="Previous match">&lt;</button>
      <strong>Q${match.number}</strong>
      <button class="icon-button" data-match-nav="${nextMatch?.number || ""}" ${nextMatch ? "" : "disabled"} title="Next match" aria-label="Next match">&gt;</button>
    </div>
  `;
}

function renderAllianceCard(title, teamNumbers) {
  const epaMetric = metricById("source:epa:total");
  const consistencyMetric = metricById("derived:consistency");
  return `
    <article class="card">
      <h2>${title}</h2>
      <div class="grid">
        ${teamNumbers
          .map((number) => {
            const team = teamByNumber(number);
            return `
              <button class="team-card" data-team="${team.number}">
                <span class="avatar">${team.number}</span>
                <span class="team-meta">
                  <strong>${team.name}</strong>
                  <span class="muted">${teamMetricValue(team, epaMetric).toFixed(1)} EPA / ${teamMetricValue(team, consistencyMetric)}% consistency</span>
                  ${renderDrivetrainBadge(team)}
                </span>
              </button>
            `;
          })
          .join("")}
      </div>
    </article>
  `;
}

function renderQuality() {
  const flagged = currentTeams().filter((team) => team.flags.some((flag) => ["data_suspect", "broken", "declining", "inconsistent"].includes(flag.type)));
  const groups = flaggedSubmissionGroups();
  return `
    <div class="grid">
      ${
        isAdmin()
          ? `
        <article class="card">
          <div class="section-heading">
            <div>
              <h2>Submission Review</h2>
              <p class="muted">Review duplicate and flagged scouting rows, then keep, exclude, or clear them manually.</p>
            </div>
          </div>
          <div class="review-group-list">
            ${
              groups.length
                ? groups.map(renderSubmissionGroup).join("")
                : `<div class="empty-state">No flagged or duplicate scouting submissions need review right now.</div>`
            }
          </div>
        </article>
      `
          : ""
      }
      <article class="card">
        <div class="section-heading">
          <div>
            <h2>Confidence Review</h2>
            <p class="muted">Confidence appears here only. Reasons are shown directly instead of on hover.</p>
          </div>
        </div>
        <div class="confidence-review-list">
          ${currentTeams()
            .filter((team) => (team.scouting?.confidence?.tier || "medium") !== "high")
            .sort((left, right) => confidenceRank(right.scouting?.confidence?.tier || "medium") - confidenceRank(left.scouting?.confidence?.tier || "medium") || left.number - right.number)
            .map((team) => renderConfidenceReviewRow(team))
            .join("") || `<div class="empty-state">All teams currently have high scouting confidence.</div>`}
        </div>
      </article>
      ${flagged
        .map(
          (team) => `
        <button class="data-row" data-team="${team.number}">
          <div class="split-row">
            <strong>${team.number} ${team.name}</strong>
            ${renderQualityBadges(team)}
          </div>
          ${team.flags.map((flag) => `<span class="flag-evidence">${flag.evidence}</span>`).join("")}
        </button>
      `,
        )
        .join("")}
    </div>
  `;
}

function renderSortBuilder() {
  const equation = activeSortEquation();
  const rankedTeams = rankTeamsByEquation(equation).map((number) => teamByNumber(number)).filter(Boolean);
  const rowScores = rankedTeams.map((team) => scoreTeamByEquation(team, equation));
  const minScore = Math.min(...rowScores);
  const maxScore = Math.max(...rowScores);
  return `
    <div class="grid sort-builder-layout">
      <article class="card builder-list-card">
        <div class="section-heading">
          <div>
            <h2>Sort Equations</h2>
          </div>
          <button class="icon-button" id="addSortEquationButton" title="Add sort equation" aria-label="Add sort equation">+</button>
        </div>
        <div class="builder-list" data-entity-list="sortEquation" tabindex="0">
          ${state.sortEquations.map((item, index) => renderEntityListItem("sortEquation", item, index, item.id === equation.id)).join("")}
        </div>
        ${renderContextMenu()}
      </article>
      <article class="card sort-preview-card">
        <div class="section-heading">
          <div>
            <h2>Ranked Teams</h2>
            <p class="muted">Scores update as the selected equation changes.</p>
          </div>
        </div>
        <div class="builder-team-list">
          ${rankedTeams
            .map((team, index) => {
              const score = scoreTeamByEquation(team, equation);
              return renderTeamTile(team, index, {
                score,
                minScore,
                maxScore,
                showScore: true,
                showName: true,
              });
            })
            .join("")}
        </div>
      </article>
      <article class="card sort-builder-editor-card">
        <div class="section-heading">
          <div>
            <h2>${equation.name}</h2>
            <p class="muted">${isProtectedSortEquation(equation) ? "Source: EPA" : "Choose weighted metrics and the ranked preview updates immediately."}</p>
          </div>
        </div>
        ${
          isProtectedSortEquation(equation)
            ? `
          <div class="card read-only-source-card">
            <strong>${icon("lock")} EPA</strong>
            <span class="muted">Source: EPA</span>
          </div>
        `
            : `
          <div class="criteria-builder">
            ${equation.terms.map((term, index) => renderCriteriaTerm(term, index, equation.terms.length)).join("")}
          </div>
        `
        }
      </article>
    </div>
  `;
}

function renderConfidenceReviewRow(team) {
  const confidence = team.scouting?.confidence || { tier: "medium", reasons: ["no_scouting_data"] };
  const reasons = uniqueValues((confidence.reasons || []).map(confidenceReasonLabel));
  return `
    <div class="review-submission-row confidence-review-row">
      <div class="review-submission-meta">
        <strong>${team.number} ${team.name}</strong>
        <span class="muted">Confidence: ${confidenceLabel(confidence.tier)}</span>
        <span class="muted">${reasons.length ? reasons.join(", ") : "No concerns recorded."}</span>
      </div>
      <div class="flag-list">
        <span class="flag ${confidenceSeverity(confidence.tier)}">Confidence: ${confidenceLabel(confidence.tier)}</span>
      </div>
    </div>
  `;
}

function renderSubmissionGroup(group) {
  const sample = group.submissions[0];
  const reasons = uniqueValues(group.submissions.flatMap((submission) => submission.confidenceReasons || [])).map(confidenceReasonLabel);
  return `
    <section class="review-group">
      <div class="section-heading">
        <div>
          <h3>Q${sample.matchNumber} | Team ${sample.teamNumber}</h3>
          <p class="muted">${group.submissions.length} submission${group.submissions.length === 1 ? "" : "s"} | ${reasons.join(", ") || "Manual review"}</p>
        </div>
        ${
          group.submissions.length > 1
            ? `<button type="button" data-clear-duplicate-group="${group.key}">Clear Duplicate Flag</button>`
            : ""
        }
      </div>
      <div class="review-submission-list">
        ${group.submissions
          .map((submission) => {
            const reasonText = (submission.confidenceReasons || []).map(confidenceReasonLabel).join(", ");
            return `
              <div class="review-submission-row">
                <div class="review-submission-meta">
                  <strong>${submission.scoutUser || "Unknown scout"} | ${submission.alliance || "?"}${submission.station || ""}</strong>
                  <span class="muted">Status: ${submission.validity} | Confidence: ${submission.confidenceTier}${reasonText ? ` | ${escapeHtml(reasonText)}` : ""}</span>
                  <span class="muted">${escapeHtml(submission.notes || "No notes provided.")}</span>
                </div>
                <div class="admin-actions">
                  <button type="button" data-review-keep="${submission.id}">Keep</button>
                  <button type="button" data-review-exclude="${submission.id}">Exclude</button>
                  <button type="button" data-review-reset="${submission.id}">Reset</button>
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderPicklistBuilder() {
  const picklist = activePicklist();
  const currentTeams = picklist.teams.map((number) => teamByNumber(number)).filter(Boolean);
  const compareTeams = state.picklistCompareTeams.map((number) => teamByNumber(number)).filter(Boolean);
  const comparisonMetric = picklistCompareMetric();
  return `
    <div class="grid picklist-builder-layout">
      <article class="card builder-list-card">
        <div class="section-heading">
          <div>
            <h2>Picklists</h2>
          </div>
          <button class="icon-button" id="addPicklistButton" title="Add picklist" aria-label="Add picklist">+</button>
        </div>
        <div class="builder-list" data-entity-list="picklist" tabindex="0">
          ${state.picklists.map((item, index) => renderEntityListItem("picklist", item, index, item.id === picklist.id)).join("")}
        </div>
        ${renderContextMenu()}
      </article>
      <article class="card current-picklist-card">
        <div class="section-heading">
          <div>
            <h2>${picklist.name}</h2>
            <p class="muted">Drag to reorder, or use arrow keys with Shift for one-slot moves.</p>
          </div>
        </div>
        <div class="picklist-list-offset" aria-hidden="true"></div>
        <div class="builder-team-list current-picklist-list" data-current-picklist tabindex="0">
          ${currentTeams.map((team, index) => renderBuilderTeamTile(team, index, { draggable: true })).join("")}
        </div>
      </article>
      <article class="card">
        <div class="section-heading">
          <div>
            <h2>Comparison Grid</h2>
            <p class="muted">Pick ranked metrics or saved picklists to compare side by side.</p>
          </div>
        </div>
        <div class="builder-grid-columns">
          ${state.picklistColumns.map((entry, index) => renderPicklistGridColumn(entry, index)).join("")}
        </div>
      </article>
      <article class="card picklist-compare-chart-card">
        <div class="section-heading">
          <div>
            <h2>Team Trend Comparison</h2>
            <p class="muted">Overlay up to 4 selected teams using the same comparison colors as the picklist.</p>
          </div>
          <label class="team-trend-metric">
            <span class="muted">Metric</span>
            <select id="picklistCompareMetricSelect" aria-label="Picklist comparison metric">
              ${currentMetrics().map((item) => `<option value="${item.id}" ${item.id === comparisonMetric.id ? "selected" : ""}>${metricTokenLabel(item)}</option>`).join("")}
            </select>
          </label>
          <label class="team-trend-metric">
            <span class="muted">Window</span>
            <select id="picklistScoutingWindowSelect" aria-label="Picklist scouting window">
              <option value="all" ${currentScoutingWindow() === "all" ? "selected" : ""}>All Matches</option>
              <option value="recent" ${currentScoutingWindow() === "recent" ? "selected" : ""}>Recent ${currentRecentMatchCount()}</option>
            </select>
          </label>
        </div>
        ${renderPicklistCompareChart(compareTeams, comparisonMetric)}
      </article>
    </div>
  `;
}

function renderPicklistCompareChart(selectedTeams, metric) {
  if (!selectedTeams.length) {
    return `<div class="empty-state picklist-compare-empty">Select up to 4 teams in the current picklist to compare their trends here.</div>`;
  }
  const series = selectedTeams.map((team) => ({
    team,
    values: metricTrendValues(team, metric),
    color: compareAccent(team.number) || "var(--accent)",
  }));
  const allValues = series.flatMap((entry) => entry.values);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const range = max - min || 1;
  const scaleX = (index, count) => 16 + (index / Math.max(1, count - 1)) * 196;
  const scaleY = (value) => 82 - ((value - min) / range) * 64;
  return `
    <div class="picklist-compare-chart-shell">
      <svg class="trend-chart compare-trend-chart" viewBox="0 0 220 100" role="img" aria-label="${escapeAttribute(`${metric.label} comparison by match number`)}" width="100%" height="280">
        <line x1="16" y1="82" x2="212" y2="82" stroke="var(--line)" stroke-width="1"></line>
        <line x1="16" y1="18" x2="16" y2="82" stroke="var(--line)" stroke-width="1"></line>
        <g class="compare-trend-grid">
          ${Array.from({ length: 5 }, (_, index) => {
            const x = 16 + (index / 4) * 196;
            return `<line x1="${x}" y1="18" x2="${x}" y2="82"></line>`;
          }).join("")}
        </g>
        <text x="114" y="97" text-anchor="middle">Match Number</text>
        <text x="4" y="50" text-anchor="middle" transform="rotate(-90 4 50)">${metric.label} (${metric.unit})</text>
        <text x="14" y="20" text-anchor="end">${max.toFixed(metric.unit === "%" ? 0 : 1)}</text>
        <text x="14" y="84" text-anchor="end">${min.toFixed(metric.unit === "%" ? 0 : 1)}</text>
        ${series
          .map((entry) => {
            const points = entry.values.map((value, index) => `${scaleX(index, entry.values.length)},${scaleY(value)}`).join(" ");
            return `<polyline points="${points}" fill="none" stroke="${entry.color}" stroke-width="2.6" vector-effect="non-scaling-stroke"></polyline>`;
          })
          .join("")}
        ${series
          .map((entry) =>
            entry.values
              .map((value, index) => {
                const x = scaleX(index, entry.values.length);
                const y = scaleY(value);
                return `<circle cx="${x}" cy="${y}" r="2.5" fill="${entry.color}"><title>Team ${entry.team.number}, Match ${index + 1}: ${value.toFixed(metric.unit === "%" ? 0 : 1)} ${metric.unit}</title></circle>`;
              })
              .join(""),
          )
          .join("")}
      </svg>
      <div class="picklist-compare-legend">
        ${selectedTeams
          .map((team) => {
            const slot = compareSlotIndexForTeam(team.number);
            const accent = compareAccent(team.number) || "var(--accent)";
            return `
              <button class="compare-team-chip" data-remove-compare-team="${team.number}" style="--compare-accent: ${accent}">
                <span class="compare-team-swatch">${slot + 1}</span>
                <span>${team.number} ${team.name}</span>
              </button>
            `;
          })
          .join("")}
      </div>
    </div>
  `;
}

function renderCriteriaTerm(term, index, count) {
  const metric = metricById(metricIdFromLegacyTerm(term));
  return `
    <div class="criteria-term">
      ${index === 0 ? `<span class="operator-spacer"></span>` : `
        <select class="term-operator" data-term-index="${index}" aria-label="Operator for component ${index + 1}">
          <option value="+" ${term.operator === "+" ? "selected" : ""}>+</option>
          <option value="-" ${term.operator === "-" ? "selected" : ""}>-</option>
          <option value="remove">Remove</option>
        </select>
      `}
      <label>
        Weight
        <input class="term-weight" data-term-index="${index}" type="number" min="-99" max="99" step="0.1" value="${Number(term.weight).toFixed(1)}" />
      </label>
      <label>
        Metric
        <select class="term-metric" data-term-index="${index}">
          ${currentMetrics().map((item) => `<option value="${item.id}" ${item.id === metric.id ? "selected" : ""}>${metricTokenLabel(item)}</option>`).join("")}
        </select>
      </label>
      ${index === count - 1 && count < 5 ? `<button class="icon-button add-term-button" id="addCriteriaTerm" title="Add component" aria-label="Add component">+</button>` : `<span class="operator-spacer"></span>`}
    </div>
  `;
}

function renderEntityListItem(kind, item, index, selected) {
  const rename = state.inlineRename?.kind === kind && state.inlineRename?.id === item.id;
  const protectedItem = kind === "sortEquation" && isProtectedSortEquation(item);
  return `
    <div
      class="builder-list-item ${selected ? "active" : ""} ${protectedItem ? "locked" : ""}"
      data-entity-row="${kind}:${item.id}"
      data-entity-kind="${kind}"
      data-entity-id="${item.id}"
      data-entity-index="${index}"
      draggable="${protectedItem ? "false" : "true"}"
      tabindex="-1"
    >
      ${
        rename
          ? `<input class="inline-rename-input" data-inline-rename="${kind}:${item.id}" value="${escapeAttribute(state.inlineRename.value)}" autocomplete="off" />`
          : `<span>${protectedItem ? `${icon("lock")} ${item.name}` : item.name}</span>`
      }
    </div>
  `;
}

function renderTeamTile(team, index, options = {}) {
  const classes = ["picklist-tile"];
  if (options.compact) classes.push("compact");
  if (options.focused) classes.push("team-focused");
  if (options.compareIndex >= 0) classes.push("compare-selected");
  if (options.extraClass) classes.push(options.extraClass);
  const scoreMarkup = options.showScore ? `<span class="tile-score">${Number(options.score || 0).toFixed(1)}</span>` : `<span class="tile-spacer"></span>`;
  const background = options.showScore ? colorForScore(Number(options.score || 0), Number(options.minScore || 0), Number(options.maxScore || 0)) : "transparent";
  const compareColor = options.compareIndex >= 0 ? compareTeamPalette[options.compareIndex] : "";
  const style = [`background: ${background}`];
  if (compareColor) style.push(`--compare-accent: ${compareColor}`);
  return `
    <button
      class="${classes.join(" ")}"
      ${options.dataAttribute || ""}
      ${options.dragData ? `data-drag-team="${options.dragData}"` : ""}
      ${options.builderTeam ? `data-builder-team="${team.number}"` : ""}
      ${options.reorderTeam ? `data-reorder-team="${team.number}"` : ""}
      draggable="${options.draggable ? "true" : "false"}"
      style="${style.join("; ")}"
    >
      <strong class="tile-rank">${index + 1}</strong>
      <span class="tile-label">${options.showName === false ? team.number : `${team.number} ${team.name}`}</span>
      ${scoreMarkup}
    </button>
  `;
}

function renderBuilderTeamTile(team, index, options = {}) {
  const focused = state.picklistSelectedTeam === team.number;
  return renderTeamTile(team, index, {
    compact: true,
    showName: false,
    showScore: false,
    focused,
    compareIndex: compareSlotIndexForTeam(team.number),
    builderTeam: true,
    reorderTeam: options.draggable,
    draggable: Boolean(options.draggable),
    dragData: options.draggable ? String(team.number) : "",
  });
}

function gridColumnModel(entry) {
  if (!entry) return { type: "", label: "---", teams: [], minScore: 0, maxScore: 0 };
  if (entry.startsWith("metric:")) {
    const metricId = entry.slice(7);
    const metric = metricById(metricId);
    if (!metric) return { type: "", label: "---", teams: [], minScore: 0, maxScore: 0 };
    const rankedTeams = [...currentTeams()].sort((a, b) => teamMetricValue(b, metric) - teamMetricValue(a, metric) || a.number - b.number);
    const scores = rankedTeams.map((team) => teamMetricValue(team, metric));
    return {
      type: "metric",
      id: metric.id,
      label: metric.label,
      teams: rankedTeams,
      scores,
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
    };
  }
  const [type, id] = entry.split(":");
  if (type === "sort") {
    return entry === "sort:sort-epa" ? gridColumnModel("metric:source:epa:total") : { type: "", label: "---", teams: [], minScore: 0, maxScore: 0 };
  }
  if (type === "picklist") {
    const picklist = state.picklists.find((item) => item.id === id);
    if (!picklist) return { type: "", label: "---", teams: [], minScore: 0, maxScore: 0 };
    return {
      type,
      id,
      label: picklist.name,
      teams: picklist.teams.map((number) => teamByNumber(number)).filter(Boolean),
      minScore: 0,
      maxScore: 0,
    };
  }
  return { type: "", label: "---", teams: [], minScore: 0, maxScore: 0 };
}

function renderPicklistGridColumn(entry, index) {
  const column = gridColumnModel(entry);
  const minHeight = `calc(${currentTeams().length} * var(--picklist-tile-row-size))`;
  return `
    <section class="grid-column ${column.type ? "" : "empty"}" ${column.type ? `data-grid-column="${index}"` : ""}>
      <label class="grid-column-select">
        <span>Column ${index + 1}</span>
        <select data-picklist-column="${index}">
          <option value="" ${entry ? "" : "selected"}>---</option>
          <optgroup label="Metrics">
            ${currentRankableMetrics().map((item) => `<option value="metric:${item.id}" ${entry === `metric:${item.id}` ? "selected" : ""}>${metricTokenLabel(item)}</option>`).join("")}
          </optgroup>
          <optgroup label="Picklists">
            ${state.picklists.map((item) => `<option value="picklist:${item.id}" ${entry === `picklist:${item.id}` ? "selected" : ""}>${item.name}</option>`).join("")}
          </optgroup>
        </select>
      </label>
      <div class="grid-column-list" style="min-height: ${minHeight}">
        ${
          column.teams.length
            ? column.teams
                .map((team, teamIndex) => {
                  const compareIndex = compareSlotIndexForTeam(team.number);
                  return column.type === "metric"
                    ? renderTeamTile(team, teamIndex, {
                        compact: true,
                        showName: false,
                        showScore: true,
                        score: column.scores[teamIndex],
                        minScore: column.minScore,
                        maxScore: column.maxScore,
                        compareIndex,
                        builderTeam: true,
                      })
                    : renderTeamTile(team, teamIndex, {
                        compact: true,
                        showName: false,
                        showScore: false,
                        compareIndex,
                      });
                })
                .join("")
            : `<div class="empty-state compact-empty">Column is empty.</div>`
        }
      </div>
    </section>
  `;
}

function renderContextMenu() {
  if (!state.contextMenu || state.contextMenu.type === "board") return "";
  if (state.contextMenu.type === "grid-column") {
    return `
      <div class="context-menu" style="left: ${state.contextMenu.x}px; top: ${state.contextMenu.y}px;">
        <button data-copy-grid-column="${state.contextMenu.columnIndex}">Copy to current picklist</button>
      </div>
    `;
  }
  if (state.contextMenu.type !== "entity") return "";
  const collection = state.contextMenu.entityKind === "sortEquation"
    ? state.sortEquations
    : state.contextMenu.entityKind === "derivedEquation"
      ? currentSeasonEquationList()
      : state.contextMenu.entityKind === "seasonFilter"
        ? currentSeasonFilterList()
        : state.picklists;
  const item = collection.find((entry) => entry.id === state.contextMenu.id);
  const locked = state.contextMenu.entityKind === "sortEquation" && isProtectedSortEquation(item);
  const canDelete = !locked && isAdmin() && collection.length > 1;
  return `
    <div class="context-menu" style="left: ${state.contextMenu.x}px; top: ${state.contextMenu.y}px;">
      ${state.contextMenu.entityKind === "sortEquation" ? `<button data-context-duplicate="${state.contextMenu.id}">Duplicate</button>` : ""}
      <button data-context-rename="${state.contextMenu.entityKind}:${state.contextMenu.id}" ${locked ? "disabled" : ""}>Rename</button>
      <button data-context-delete="${state.contextMenu.entityKind}:${state.contextMenu.id}" ${canDelete ? "" : "disabled"}>Delete</button>
    </div>
  `;
}

function renderPicklistTile(number, index, picklist, options = {}) {
  const team = teamByNumber(number);
  if (!team) return "";
  const picked = pickedTeams().includes(number) ? "picked" : "";
  const content = options.static && !options.showScore
    ? renderTeamTile(team, index, {
        compact: true,
        showName: false,
        showScore: false,
        extraClass: picked,
        draggable: !picked,
        dragData: picked ? "" : String(team.number),
        dataAttribute: options.navigation ? `data-team="${team.number}"` : "",
      })
    : renderTeamTile(team, index, {
        compact: true,
        showName: false,
        showScore: Boolean(options.showScore),
        score: options.score,
        minScore: options.minScore,
        maxScore: options.maxScore,
        extraClass: picked,
        draggable: !picked,
        dragData: picked ? "" : String(team.number),
        dataAttribute: options.navigation ? `data-team="${team.number}"` : "",
      });
  return content;
}

function renderAlliance() {
  const loaded = state.loadedSources.map((entry) => gridColumnModel(entry)).filter((column) => column.teams.length);
  const headerLines = Math.max(1, ...loaded.map((column) => Math.ceil(column.label.length / 14)));
  return `
    <div class="grid alliance-layout">
      <article class="card">
        <div class="section-heading">
          <div>
            <h2>Selection Board</h2>
          </div>
          <div class="admin-actions">
            <button type="button" id="clearAllianceBoardButton">Clear Board</button>
          </div>
        </div>
        <div class="board">
          ${state.allianceBoard.map((teamNumber, index) => renderBoardCell(teamNumber, index)).join("")}
        </div>
        ${renderBoardContextMenu()}
        <div class="section-heading">
          <div>
            <h2>Picklist Selector</h2>
          </div>
        </div>
        <div class="picklist-loader">
          <div class="picklist-loader-group">
            <h3>Metrics</h3>
            ${currentRankableMetrics()
              .map(
                (metric) => `
            <label class="check-row">
              <input type="checkbox" class="picklist-check" value="metric:${metric.id}" ${state.loadedSources.includes(`metric:${metric.id}`) ? "checked" : ""} />
              <span>${metric.label}</span>
              <span class="muted">${metric.kind === "derived" ? "Derived equation" : "Metric source"}</span>
            </label>
          `,
              )
              .join("")}
          </div>
          <div class="picklist-loader-group">
            <h3>Picklists</h3>
            ${state.picklists
              .map(
                (picklist) => `
              <label class="check-row">
                <input type="checkbox" class="picklist-check" value="picklist:${picklist.id}" ${state.loadedSources.includes(`picklist:${picklist.id}`) ? "checked" : ""} />
                <span>${picklist.name}</span>
                <span class="muted">Manual order</span>
              </label>
            `,
              )
              .join("")}
          </div>
        </div>
      </article>
      <article class="card alliance-sources-card">
        <div class="section-heading">
          <div>
            <h2>Displayed Sources</h2>
          </div>
        </div>
        <div class="picklist-columns alliance-picklists" style="--alliance-header-lines: ${headerLines}">
          ${
            loaded.length
              ? loaded
                  .map(
                    (column) => `
              <section
                data-loaded-source="${column.type}:${column.id}"
              >
                <h3 data-loaded-source-handle="${column.type}:${column.id}" draggable="true">${column.label}</h3>
                <div class="alliance-source-list">
                  ${column.teams
                    .map((team, teamIndex) =>
                      renderPicklistTile(team.number, teamIndex, null, {
                        static: true,
                        navigation: false,
                        showScore: column.type === "metric",
                        score: column.scores?.[teamIndex],
                        minScore: column.minScore,
                        maxScore: column.maxScore,
                      }),
                    )
                    .join("")}
                </div>
              </section>
            `,
                  )
                  .join("")
              : `<div class="empty-state">Select one or more sources to load them here.</div>`
          }
        </div>
      </article>
    </div>
  `;
}

function renderBoardCell(teamNumber, index) {
  if (teamNumber) {
    const team = teamByNumber(teamNumber);
    return `
      <div class="board-cell occupied" data-board-cell="${index}" data-board-team="${teamNumber}" title="Right-click to remove ${teamNumber}">
        <strong>${teamNumber}</strong>
        <span>${team?.name || ""}</span>
      </div>
    `;
  }
  return `
    <div class="board-cell empty" data-board-cell="${index}">
      <input class="board-input" data-board-input="${index}" inputmode="numeric" placeholder="Team #" aria-label="Alliance slot ${index + 1}" />
    </div>
  `;
}

function renderBoardContextMenu() {
  if (!state.contextMenu || state.contextMenu.type !== "board") return "";
  const teamNumber = state.allianceBoard[state.contextMenu.cell];
  if (!teamNumber) return "";
  return `
    <div class="context-menu" style="left: ${state.contextMenu.x}px; top: ${state.contextMenu.y}px;">
      <button class="context-remove" data-remove-cell="${state.contextMenu.cell}">Remove ${teamNumber}</button>
    </div>
  `;
}

function renderAdmin() {
  const event = currentEvent();
  const workspace = currentEventWorkspace();
  const scoutingAttachments = workspace.sources?.scouting || [];
  const activeAttachment = currentScoutingAttachment();
  const activeAttachmentFormat = activeEventWorkspaceScoutingAttachmentFormat(workspace, event);
  const result = state.importResult;
  const summary = result?.summary;
  const issues = [...(result?.errors || []), ...(result?.warnings || [])];
  const reviewGroups = flaggedSubmissionGroups();
  return `
    <div class="grid">
      <div class="grid cols-2">
        <article class="card">
          <div class="section-heading">
            <div>
              <h2>Event Workspace</h2>
              <p class="muted">Choose the active event here. The rest of the app switches immediately.</p>
            </div>
          </div>
          <div class="admin-form-grid">
            <label>
              Active event
              <select id="adminEventSelect" aria-label="Admin event selection">
                ${globalEventCatalog.map((item) => `<option value="${item.key}" ${item.key === event.key ? "selected" : ""}>${item.season} ${item.name}</option>`).join("")}
              </select>
            </label>
            <label>
              Event code lookup
              <div class="admin-actions">
                <input id="adminEventCodeInput" type="text" value="${escapeAttribute(event.key)}" placeholder="2026miket" aria-label="Event code lookup" />
                <button type="button" id="lookupEventCodeButton" ${state.eventLookupPending ? "disabled" : ""}>${state.eventLookupPending ? "Loading..." : "Load Event Code"}</button>
              </div>
            </label>
            <label>
              TBA auth key
              <input id="adminTbaAuthKeyInput" class="admin-input" type="password" value="${escapeAttribute(state.tbaAuthKey)}" placeholder="Paste The Blue Alliance auth key" aria-label="TBA auth key" autocomplete="off" spellcheck="false" />
            </label>
            <div class="issue-list">
              <div class="issue-row">
                <strong>Scouting sheet</strong>
                <span class="muted">${event.sheet?.tab || "Unknown tab"} | ${event.sheet?.access === "public_csv" ? "Public CSV sample cached" : "Sign-in required for direct export"} | Window: ${scoutingWindowLabel()}</span>
              </div>
              <div class="issue-row">
                <strong>TBA key</strong>
                <span class="muted">${state.tbaAuthKey ? "Stored locally in this browser for event lookup." : "Required for loading arbitrary event codes from The Blue Alliance."}</span>
              </div>
              ${state.eventLookupResult ? `<div class="issue-row ${state.eventLookupResult.kind === "error" ? "danger" : state.eventLookupResult.kind === "warn" ? "warn" : ""}">${escapeHtml(state.eventLookupResult.message)}</div>` : ""}
            </div>
          </div>
        </article>
        <article class="card">
          <div class="section-heading">
            <div>
              <h2>How To Use</h2>
              <p class="muted">This is the shortest path for changing events and loading scouting data.</p>
            </div>
          </div>
          <div class="howto-list">
            <div class="howto-row"><strong>1.</strong><span>Pick the event in Event Workspace.</span></div>
            <div class="howto-row"><strong>2.</strong><span>Paste or confirm the scouting sheet URL.</span></div>
            <div class="howto-row"><strong>3.</strong><span>Click <strong>Load Scouting Data</strong>.</span></div>
            <div class="howto-row"><strong>4.</strong><span>Confirm the preview says <strong>Preview Ready</strong>.</span></div>
            <div class="howto-row"><strong>5.</strong><span>Click <strong>Commit Import</strong>.</span></div>
            <div class="howto-row"><strong>6.</strong><span>Open Teams or Analysis to use the imported scouting data.</span></div>
          </div>
        </article>
      </div>
      <div class="stat-grid">
        <div class="stat"><span>Imported Rows</span><strong>${state.scoutingSubmissions.length}</strong></div>
        <div class="stat"><span>Imported Matches</span><strong>${importedMatchCount()}</strong></div>
        <div class="stat"><span>Teams Covered</span><strong>${importedTeamCount()}</strong></div>
        <div class="stat"><span>Activity Entries</span><strong>${state.activityLog.length}</strong></div>
      </div>
      <div class="grid cols-2">
        <article class="card">
          <div class="section-heading">
            <div>
              <h2>Scouting Import</h2>
              <p class="muted">Manage event-scoped scouting attachments, choose the active source, then load and commit the preview into this event.</p>
            </div>
          </div>
          <div class="admin-form-grid">
            <label>
              Active attachment
              <select id="activeScoutingAttachmentSelect" aria-label="Active scouting attachment">
                ${scoutingAttachments.map((attachment) => `<option value="${attachment.attachmentId}" ${attachment.attachmentId === activeAttachment?.attachmentId ? "selected" : ""}>${escapeHtml(attachment.label || attachment.attachmentId)}</option>`).join("")}
              </select>
            </label>
            <div class="admin-actions">
              <button type="button" id="addScoutingAttachmentButton">Add Attachment</button>
              <button type="button" id="removeScoutingAttachmentButton" ${scoutingAttachments.length > 1 && activeAttachment ? "" : "disabled"}>Remove Attachment</button>
            </div>
            <label>
              Attachment label
              <input id="scoutingAttachmentLabel" class="admin-input" type="text" value="${escapeAttribute(activeAttachment?.label || "")}" placeholder="2026 CHCMP Main Scouting" />
            </label>
            <label>
              Attachment format
              <select id="scoutingAttachmentFormatSelect" aria-label="Scouting attachment format">
                <option value="legacy-sheet-url" ${activeAttachmentFormat === "legacy-sheet-url" ? "selected" : ""}>Google Sheet</option>
                <option value="legacy-sheet-csv" ${activeAttachmentFormat === "legacy-sheet-csv" ? "selected" : ""}>CSV</option>
                <option value="scouting-json" ${activeAttachmentFormat === "scouting-json" ? "selected" : ""}>JSON</option>
              </select>
            </label>
            <label>
              Translator / profile
              <input id="scoutingAttachmentTranslatorId" class="admin-input" type="text" value="${escapeAttribute(activeAttachment?.translatorId || "")}" placeholder="canonical-json-v1" />
            </label>
            <label>
              Attachment source
              <input id="importSourceUrl" class="admin-input" type="text" value="${escapeAttribute(currentScoutingSourceInputValue(currentEventWorkspace(), event, state.importSourceUrl))}" placeholder="https://docs.google.com/spreadsheets/d/... or a bound local file name" />
            </label>
            <label class="checkbox-row">
              <input id="scoutingAttachmentAutoLoad" type="checkbox" ${activeAttachment?.autoLoad ? "checked" : ""} />
              <span>Auto-load this attachment when the event opens</span>
            </label>
            <div class="admin-actions">
              <button type="button" id="chooseLocalScoutingFileButton" ${localAttachmentFilesSupported() ? "" : "disabled"}>Choose Local File</button>
              <button type="button" id="saveScoutingAttachmentButton">Save Attachment</button>
              <button type="button" id="reloadScoutingAttachmentButton">Reload Active Attachment</button>
              <button type="button" id="loadScoutingDataButton" class="primary">Load Scouting Data</button>
            </div>
            ${
              activeAttachment
                ? `<div class="attachment-status-card">
              <div class="flag-list">
                <span class="flag">${escapeHtml(activeAttachmentFormat)}</span>
                <span class="flag">${escapeHtml(activeAttachment.status || "manual")}</span>
                <span class="flag">${escapeHtml(activeAttachment.freshness || "unknown")}</span>
                ${activeAttachment.autoLoad ? `<span class="flag good">Auto-load</span>` : ""}
              </div>
              <div class="attachment-metadata-grid">
                <div class="issue-row">
                  <strong>Last Attempt</strong>
                  <span class="muted">${escapeHtml(formatTimestamp(activeAttachment.lastAttemptedAt))}</span>
                </div>
                <div class="issue-row">
                  <strong>Last Success</strong>
                  <span class="muted">${escapeHtml(formatTimestamp(activeAttachment.lastSuccessfulAt))}</span>
                </div>
                <div class="issue-row">
                  <strong>Schema Signature</strong>
                  <span class="muted">${escapeHtml(activeAttachment.schemaSignature || "Pending")}</span>
                </div>
                <div class="issue-row">
                  <strong>Translator Version</strong>
                  <span class="muted">${escapeHtml(activeAttachment.translatorVersion || "Pending")}</span>
                </div>
                <div class="issue-row">
                  <strong>Source Fingerprint</strong>
                  <span class="muted">${escapeHtml(activeAttachment.sourceFingerprint || "Pending")}</span>
                </div>
              </div>
              ${
                activeAttachment.error
                  ? `<div class="issue-row danger">
                <strong>Last Error</strong>
                <span>${escapeHtml(activeAttachment.error)}</span>
              </div>`
                  : ""
              }
            </div>`
                : ""
            }
            <label>
              CSV payload
              <textarea id="importCsvInput" class="admin-textarea" spellcheck="false" placeholder="Paste CSV with metadata block here.">${escapeHtml(state.importCsvText)}</textarea>
            </label>
            <div class="admin-actions">
              <button type="button" id="dryRunImportButton" class="primary">Dry Run Import</button>
              <button type="button" id="commitImportButton" ${summary ? "" : "disabled"}>Commit Import</button>
              <button type="button" id="clearImportButton">Clear</button>
            </div>
          </div>
        </article>
        <article class="card">
          <h2>Import Preview</h2>
          ${
            !result
              ? `<p class="muted">Run a dry-run to validate metadata, detect a template profile, flag duplicates, and preview confidence impacts before anything is committed.</p>`
              : `
            <div class="preview-shell">
              <div class="flag-list">
                <span class="flag ${result.ok ? "good" : "danger"}">${result.ok ? "Preview Ready" : "Preview Blocked"}</span>
                ${summary ? `<span class="flag">${summary.profileLabel}</span>` : ""}
                ${summary ? `<span class="flag">Schema ${summary.schemaVersion}</span>` : ""}
              </div>
              ${
                summary
                  ? `
                <div class="preview-stat-grid">
                  <div class="stat"><span>Rows</span><strong>${summary.rowCount}</strong></div>
                  <div class="stat"><span>Flagged</span><strong>${summary.flaggedRows}</strong></div>
                  <div class="stat"><span>Excluded</span><strong>${summary.excludedRows}</strong></div>
                  <div class="stat"><span>Duplicates</span><strong>${summary.duplicateGroups}</strong></div>
                </div>
                <p class="muted">Target: ${summary.metadata.eventKey} | Confidence impacted teams: ${summary.confidenceImpactTeams}</p>
              `
                  : ""
              }
              ${
                issues.length
                  ? `
                <div class="issue-list">
                  ${issues
                    .map((issue, index) => `<div class="issue-row ${index < (result.errors || []).length ? "danger" : "warn"}">${escapeHtml(issue)}</div>`)
                    .join("")}
                </div>
              `
                  : `<p class="muted">No validation issues found.</p>`
              }
              ${
                result.canSwitchContext && result.suggestedEventKey
                  ? `<button type="button" id="switchImportContextButton">Switch to ${result.suggestedEventKey} and re-run</button>`
                  : ""
              }
              ${
                summary?.submissions?.length
                  ? `
                <div class="issue-list">
                  ${summary.submissions
                    .slice(0, 6)
                    .map((submission) => {
                      const reasons = submission.confidenceReasons.map(confidenceReasonLabel).join(", ");
                      return `<div class="issue-row">
                        <strong>Q${submission.matchNumber} / Team ${submission.teamNumber}</strong>
                        <span class="muted">${submission.validity} | ${submission.confidenceTier}${reasons ? ` | ${escapeHtml(reasons)}` : ""}</span>
                      </div>`;
                    })
                    .join("")}
                </div>
              `
                  : ""
              }
            </div>
          `
          }
        </article>
        <article class="card">
          <h2>Schema Diagnostics</h2>
          ${(() => {
            const diagnosticsState = currentScoutingDiagnosticsState();
            const activeDiagnostics = diagnosticsState.pendingDiagnostics || diagnosticsState.currentDiagnostics;
            const modeLabel = diagnosticsState.pendingDiagnostics ? "Pending import diagnostics" : "Current event diagnostics";
            return `
              <p class="muted">${modeLabel}. Added, removed, and type-changed scouting fields are summarized here along with downstream broken dependencies.</p>
              ${renderSchemaDiffSummary(activeDiagnostics?.schemaDiff)}
              <h3>Broken Derived Equations</h3>
              ${renderDependencyDiagnosticsList(activeDiagnostics?.diagnostics?.equations, "No derived equations are currently blocked by scouting schema drift.")}
              <h3>Broken Filters</h3>
              ${renderDependencyDiagnosticsList(activeDiagnostics?.diagnostics?.filters, "No season filters are currently blocked by scouting schema drift.")}
              <h3>Broken Sort Equations</h3>
              ${renderDependencyDiagnosticsList(activeDiagnostics?.diagnostics?.sortEquations, "No sort equations are currently blocked by scouting schema drift.")}
            `;
          })()}
        </article>
      </div>
      <article class="card">
        <div class="section-heading">
          <div>
            <h2>Data Sources</h2>
            <p class="muted">These source statuses follow the selected event and update with the current event context.</p>
          </div>
          <div class="admin-actions">
            <button type="button" id="refreshAllSourcesButton">Refresh All Sources</button>
          </div>
        </div>
        <div class="data-source-list">
          ${currentDataSources()
            .map(
              (source) => `
            <div class="data-source-row">
              <div>
                <strong>${source.name}</strong>
                <span class="muted">${source.notes}</span>
              </div>
              <div class="source-status-stack">
                <span class="source-status">${source.status}</span>
                <span class="muted">${source.freshness} | Next poll: ${source.nextPollAt}</span>
              </div>
              <div class="source-actions-stack">
                <span class="muted">${source.updated}</span>
                <div class="admin-actions">
                  <button type="button" data-refresh-source="${source.sourceId}">Refresh</button>
                  <button type="button" data-toggle-source-polling="${source.sourceId}" data-polling-enabled="${source.pollingEnabled ? "true" : "false"}">
                    ${source.pollingEnabled ? "Pause Polling" : "Resume Polling"}
                  </button>
                </div>
              </div>
            </div>
          `,
            )
            .join("")}
        </div>
      </article>
      <article class="card">
        <div class="section-heading">
          <div>
            <h2>Activity Log</h2>
            <p class="muted">System-generated event activity stays scoped to the active event and lets admins clear issues manually later.</p>
          </div>
        </div>
        <div class="activity-log">
          ${
            state.activityLog.length
              ? state.activityLog
                  .map(
                    (entry) => `
                <div class="activity-row">
                  <strong>${formatTimestamp(entry.timestamp)}</strong>
                  <span>${escapeHtml(entry.message)}</span>
                </div>
              `,
                  )
                  .join("")
              : `<div class="empty-state">No activity has been recorded for ${event.name} yet.</div>`
          }
        </div>
      </article>
      <article class="card">
        <div class="section-heading">
          <div>
            <h2>Duplicate Review</h2>
            <p class="muted">Flagged scouting rows stay in the system until an admin keeps, excludes, resets, or clears them.</p>
          </div>
          <div class="flag-list">
            <span class="flag ${reviewGroups.length ? "warn" : "good"}">${reviewGroups.length} group${reviewGroups.length === 1 ? "" : "s"} pending</span>
          </div>
        </div>
        <div class="review-group-list">
          ${
            reviewGroups.length
              ? reviewGroups.map(renderSubmissionGroup).join("")
              : `<div class="empty-state">No duplicate or flagged submissions are waiting for admin action.</div>`
          }
        </div>
      </article>
    </div>
  `;
}

function renderFlags(flags) {
  const items = flags.map((flag) => `<span class="flag ${flag.severity}" title="${escapeAttribute(flag.evidence || flag.label)}">${flag.label}</span>`);
  if (!items.length) return "";
  return `<span class="flag-list">${items.join("")}</span>`;
}

function renderDrivetrainBadge(team) {
  const drivetrainFlags = team.drivetrain && team.drivetrain !== "unknown" && team.drivetrain !== "swerve" ? [{ label: "Non-Swerve", severity: "danger" }] : [];
  return renderFlags(drivetrainFlags);
}

function renderQualityBadges(team) {
  return renderFlags(team.flags || []);
}

function placeTeamOnBoard(teamNumber, cellIndex) {
  const number = Number(teamNumber);
  if (!teamByNumber(number) || state.allianceBoard[cellIndex] || pickedTeams().includes(number)) return false;
  state.allianceBoard[cellIndex] = number;
  state.contextMenu = null;
  saveState();
  render();
  return true;
}

function removeTeamFromBoard(cellIndex) {
  state.allianceBoard[cellIndex] = null;
  state.contextMenu = null;
  saveState();
  render();
}

function clearAllianceBoard() {
  state.allianceBoard = normalizeBoard(defaultAllianceBoard, currentEvent());
  state.contextMenu = null;
  saveState();
  render();
}

function uniqueEntityName(baseName, items, fallback) {
  const base = (baseName || "").trim() || fallback;
  const names = new Set(items.map((item) => item.name));
  if (!names.has(base)) return base;
  let suffix = 2;
  while (names.has(`${base} ${suffix}`)) suffix += 1;
  return `${base} ${suffix}`;
}

function moveItemBefore(values, draggedValue, targetValue) {
  const next = values.filter((value) => value !== draggedValue);
  const targetIndex = next.indexOf(targetValue);
  next.splice(targetIndex < 0 ? next.length : targetIndex, 0, draggedValue);
  return next;
}

function moveItemByStep(values, value, step) {
  const index = values.indexOf(value);
  if (index < 0) return values;
  const targetIndex = Math.max(0, Math.min(values.length - 1, index + step));
  if (targetIndex === index) return values;
  const next = [...values];
  next.splice(index, 1);
  next.splice(targetIndex, 0, value);
  return next;
}

function firstVisibleGridColumn() {
  return state.picklistColumns.map((entry, index) => ({ entry, index })).find((item) => item.entry);
}

function defaultTeamsForNewPicklist() {
  const firstColumn = firstVisibleGridColumn();
  if (!firstColumn) {
    const defaultMetric = metricById(currentEvent().defaultMetricId);
    return [...currentTeams()]
      .sort((a, b) => teamMetricValue(b, defaultMetric) - teamMetricValue(a, defaultMetric) || a.number - b.number)
      .map((team) => team.number);
  }
  return gridColumnModel(firstColumn.entry).teams.map((team) => team.number);
}

function updateSeasonEquationList(nextDefinitions, eventModel = currentEvent()) {
  const seasonKey = String(eventModel.season);
  state.seasonDerivedEquationCatalog = normalizeSeasonDerivedEquationCatalog({
    ...state.seasonDerivedEquationCatalog,
    seasons: {
      ...(state.seasonDerivedEquationCatalog?.seasons || {}),
      [seasonKey]: nextDefinitions,
    },
  });
  ensureActiveDerivedEquation(eventModel);
  saveState();
}

function addSeasonEquation() {
  const existing = currentSeasonEquationList();
  const name = uniqueEntityName("New Equation", existing, "New Equation");
  const definition = {
    id: createId("derived"),
    name,
    formula: "0",
    unit: "pts",
    description: "",
    sourceOrder: existing.length,
  };
  updateSeasonEquationList([...existing, definition]);
  state.activeDerivedEquationId = definition.id;
  state.inlineRename = { kind: "derivedEquation", id: definition.id, value: definition.name };
  saveState();
  render();
}

function removeSeasonEquation(id) {
  const existing = currentSeasonEquationList();
  const definition = existing.find((item) => item.id === id);
  if (!definition || existing.length <= 1) return;
  updateSeasonEquationList(existing.filter((item) => item.id !== id));
  if (state.contextMenu?.id === id) state.contextMenu = null;
  if (state.inlineRename?.id === id) state.inlineRename = null;
  saveState();
  render();
}

function renameSeasonEquation(id, requestedName) {
  const definition = currentSeasonEquationList().find((item) => item.id === id);
  if (!definition) return;
  const trimmed = requestedName.trim();
  if (!trimmed || trimmed === definition.name) return;
  const name = uniqueEntityName(trimmed, currentSeasonEquationList().filter((item) => item.id !== id), trimmed);
  updateSeasonEquationList(currentSeasonEquationList().map((item) => (item.id === id ? { ...item, name } : item)));
  saveState();
  render();
}

function updateSeasonEquationFormula(id, formula) {
  updateSeasonEquationList(currentSeasonEquationList().map((item) => (
    item.id === id ? { ...item, formula: normalizeStoredFormula(formula, "0") } : item
  )));
}

function seasonDerivedEquationsSourceText() {
  const canonicalCatalog = normalizeSeasonDerivedEquationCatalog(state.seasonDerivedEquationCatalog);
  return `(function () {\nglobalThis.SeasonDerivedEquations = ${JSON.stringify(canonicalCatalog, null, 2)};\n})();\n`;
}

function updateSeasonFilterList(definitions, eventModel = currentEvent()) {
  const seasonKey = String(eventModel.season);
  const nextDefinitions = (definitions || []).map((definition, index) => ({
    id: String(definition?.id || "").trim() || createId("filter"),
    name: String(definition?.name || "").trim() || `Filter ${index + 1}`,
    formula: String(definition?.formula || "").trim() || "0 > 1",
    description: String(definition?.description || "").trim(),
    sourceOrder: Number.isFinite(Number(definition?.sourceOrder)) ? Number(definition.sourceOrder) : index,
  }));
  state.seasonFilterCatalog = normalizeSeasonFilterCatalog({
    seasons: {
      ...(state.seasonFilterCatalog?.seasons || {}),
      [seasonKey]: nextDefinitions,
    },
  });
  ensureActiveSeasonFilter(eventModel);
  state.activeAnalysisFilterId = normalizeAnalysisFilterSelection(state.activeAnalysisFilterId, eventModel);
  saveState();
}

function addSeasonFilter() {
  const existing = currentSeasonFilterList();
  const name = uniqueEntityName("New Filter", existing, "New Filter");
  const definition = {
    id: createId("filter"),
    name,
    formula: "scouting.total > 0",
    description: "",
    sourceOrder: existing.length,
  };
  updateSeasonFilterList([...existing, definition]);
  state.activeSeasonFilterId = definition.id;
  state.inlineRename = { kind: "seasonFilter", id: definition.id, value: definition.name };
  saveState();
  render();
}

function removeSeasonFilter(id) {
  const existing = currentSeasonFilterList();
  const definition = existing.find((item) => item.id === id);
  if (!definition || existing.length <= 1) return;
  updateSeasonFilterList(existing.filter((item) => item.id !== id));
  if (state.activeAnalysisFilterId === id) state.activeAnalysisFilterId = "";
  if (state.contextMenu?.id === id) state.contextMenu = null;
  if (state.inlineRename?.id === id) state.inlineRename = null;
  saveState();
  render();
}

function renameSeasonFilter(id, requestedName) {
  const definition = currentSeasonFilterList().find((item) => item.id === id);
  if (!definition) return;
  const trimmed = requestedName.trim();
  if (!trimmed || trimmed === definition.name) return;
  const name = uniqueEntityName(trimmed, currentSeasonFilterList().filter((item) => item.id !== id), trimmed);
  updateSeasonFilterList(currentSeasonFilterList().map((item) => (item.id === id ? { ...item, name } : item)));
  saveState();
  render();
}

function updateSeasonFilterFormula(id, formula) {
  updateSeasonFilterList(currentSeasonFilterList().map((item) => (
    item.id === id ? { ...item, formula: normalizeStoredFormula(formula, "0 > 1") } : item
  )));
}

function seasonFiltersSourceText() {
  return `(function () {\nglobalThis.SeasonFilters = ${JSON.stringify(state.seasonFilterCatalog, null, 2)};\n})();\n`;
}

function formulaAutocompleteCandidates(token) {
  const normalizedToken = String(token || "").toLowerCase();
  return [
    "scouting.total",
    ...currentAvailableScoutingFieldDefinitions().map((metricDefinition) => `scouting.${metricDefinition.id}`),
    ...currentAvailableTbaFormulaIdentifiers(),
    ...currentEvent().scoringComponents.flatMap((component) => [`statbotics.${component.id}`, `pridge.${component.id}`]),
    "statbotics.total",
    "opr.total",
    "pridge.total",
    ...currentSeasonEquationList().map((definition) => definition.id),
    "allianceMatch",
    "match",
    "if",
    "valueOr",
    "contains",
    "startsWith",
    "average",
    "sum",
    "count",
    "matchAverage",
    "matchSum",
    "matchCount",
    "allianceAverage",
    "allianceSum",
    "allianceCount",
    "eventAverage",
    "eventSum",
    "eventCount",
  ].filter((candidate) => candidate.toLowerCase().startsWith(normalizedToken));
}

function filterAutocompleteCandidates(token) {
  const normalizedToken = String(token || "").toLowerCase();
  return [
    "scouting.total",
    ...currentAvailableScoutingFieldDefinitions().map((metricDefinition) => `scouting.${metricDefinition.id}`),
    ...currentAvailableTbaFormulaIdentifiers(),
    "contains",
    "startsWith",
    "and",
    "or",
    "not",
    "true",
    "false",
    "xor",
  ].filter((candidate) => candidate.toLowerCase().startsWith(normalizedToken));
}

function builtInFunctionGroups() {
  const sortEntries = (entries) => entries.slice().sort((left, right) => left.name.localeCompare(right.name));
  return [
    {
      id: "common",
      label: "Common",
      expandedByDefault: true,
      entries: sortEntries([
        { name: "average(series, filter?)", description: "Average a match-level series over this team's recent matches, optionally filtered." },
        { name: "count(series, filter?)", description: "Count present nonblank nonzero entries in a match-level series, optionally filtered." },
        { name: "sum(series, filter?)", description: "Sum a match-level series over this team's recent matches, optionally filtered." },
      ]),
    },
    {
      id: "conditional",
      label: "Conditional And Fallback",
      expandedByDefault: true,
      entries: sortEntries([
        { name: "if(condition, whenTrue, whenFalse)", description: "Choose between two expressions using a scalar or match-level condition." },
        { name: "valueOr(value, fallback)", description: "Use a fallback when the first value is blank, null, or invalid." },
      ]),
    },
    {
      id: "text",
      label: "Text",
      expandedByDefault: true,
      entries: sortEntries([
        { name: "contains(text, fragment)", description: "Case-insensitive string containment check." },
        { name: "startsWith(text, prefix)", description: "Case-insensitive string prefix check." },
      ]),
    },
    {
      id: "alliance",
      label: "Alliance Scoped",
      expandedByDefault: true,
      entries: sortEntries([
        { name: "allianceAverage(series, filter?)", description: "Average peer values across the current alliance in each match row." },
        { name: "allianceCount(series, filter?)", description: "Count present peer values across the current alliance in each match row." },
        { name: "allianceSum(series, filter?)", description: "Sum peer values across the current alliance in each match row." },
      ]),
    },
    {
      id: "match",
      label: "Match Scoped",
      expandedByDefault: true,
      entries: sortEntries([
        { name: "matchAverage(series, filter?)", description: "Average peer values across all six robots in each match row." },
        { name: "matchCount(series, filter?)", description: "Count present peer values across all six robots in each match row." },
        { name: "matchSum(series, filter?)", description: "Sum peer values across all six robots in each match row." },
      ]),
    },
    {
      id: "event",
      label: "Event Scoped",
      expandedByDefault: true,
      entries: sortEntries([
        { name: "eventAverage(value, filter?)", description: "Average a per-team event value such as statbotics.total or average(scouting.autoSpeakerMade) across teams at the event." },
        { name: "eventCount(value, filter?)", description: "Count teams whose per-team event value is present and nonzero. Do not pass raw match-level series like scouting.autoSpeakerMade." },
        { name: "eventSum(value, filter?)", description: "Sum a per-team event value such as pridge.total or average(scouting.autoSpeakerMade) across teams at the event." },
      ]),
    },
  ];
}

function builtInFilterFunctionList() {
  return [
    { name: "and(left, right, ...)", description: "Keep matches where every condition is true." },
    { name: "not(condition)", description: "Invert a match-level condition." },
    { name: "or(left, right, ...)", description: "Keep matches where any condition is true." },
    { name: "true / false", description: "Boolean literals you can use directly in filters." },
    { name: "xor(left, right, ...)", description: "Keep matches where an odd number of conditions are true." },
    { name: "<, >, ==, !=, <=, >=", description: "Comparison operators for numeric and boolean-style checks." },
  ].sort((left, right) => left.name.localeCompare(right.name));
}

function renderHoverFormulaFunctionEntries() {
  return builtInFunctionGroups()
    .map((group) => `
      <details class="formula-function-group" ${group.expandedByDefault ? "open" : ""}>
        <summary class="formula-function-group-summary">${escapeHtml(group.label)}</summary>
        <div class="formula-function-group-list">
          ${group.entries
            .map((entry) => `<div class="formula-function-item formula-function-item-compact"><strong>${escapeHtml(entry.name)}</strong></div>`)
            .join("")}
        </div>
      </details>
    `)
    .join("");
}

function renderFormulaHelpStandaloneEntries() {
  const groupsById = Object.fromEntries(builtInFunctionGroups().map((group) => [group.id, group]));
  const orderedGroups = ["common", "match", "conditional", "alliance", "text", "event"]
    .map((id) => groupsById[id])
    .filter(Boolean);
  return orderedGroups
    .map((group) => `
      <section class="formula-help-section">
        <h2>${escapeHtml(group.label)}</h2>
        <div class="formula-help-section-list">
          ${group.entries
            .map((entry) => `<div class="formula-function-item"><strong>${escapeHtml(entry.name)}</strong><span>${escapeHtml(entry.description)}</span></div>`)
            .join("")}
        </div>
      </section>
    `)
    .join("");
}

function renderFormulaHelpStandaloneDocument() {
  const currentTheme = state.theme === "dark" ? "dark" : "light";
  return `<!doctype html>
<html lang="en" data-theme="${currentTheme}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Function Help</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f7f8fa;
        --panel: #ffffff;
        --panel-soft: #eef2f6;
        --text: #17202a;
        --muted: #657181;
        --line: #d8dee7;
        --accent: #0f766e;
        --accent-strong: #115e59;
        --accent-soft: #d9f3ef;
        --warn: #b45309;
        --danger: #b42318;
        --info: #2563eb;
        --good: #15803d;
        --shadow: 0 8px 24px rgba(23, 32, 42, 0.08);
      }
      [data-theme="dark"] {
        color-scheme: dark;
        --bg: #111418;
        --panel: #191f27;
        --panel-soft: #222a34;
        --text: #eef3f8;
        --muted: #a8b2bf;
        --line: #303a46;
        --accent: #2dd4bf;
        --accent-strong: #5eead4;
        --accent-soft: #173c39;
        --warn: #f59e0b;
        --danger: #f87171;
        --info: #60a5fa;
        --good: #4ade80;
        --shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 24px;
        background: var(--bg);
        color: var(--text);
        font: 14px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .formula-help-page {
        max-width: 960px;
        margin: 0 auto;
        padding: 20px;
        border: 1px solid var(--line);
        border-radius: 12px;
        background: var(--panel);
        box-shadow: var(--shadow);
      }
      .formula-help-page h1 {
        margin: 0 0 6px;
        font-size: 1.4rem;
      }
      .formula-help-page p {
        margin: 0;
        color: var(--muted);
      }
      .formula-help-list {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px 22px;
        margin-top: 18px;
      }
      .formula-help-section {
        display: grid;
        align-content: start;
        gap: 10px;
      }
      .formula-help-section h2 {
        margin: 0;
        font-size: 0.98rem;
        border-bottom: 1px solid var(--line);
        padding-bottom: 6px;
      }
      .formula-help-section-list {
        display: grid;
        gap: 10px;
      }
      .formula-function-item {
        display: grid;
        gap: 2px;
      }
      .formula-function-item strong {
        font-family: ui-monospace, SFMono-Regular, "Cascadia Code", Consolas, monospace;
        font-size: 0.92rem;
      }
      .formula-function-item span {
        color: var(--muted);
      }
    </style>
  </head>
  <body>
    <article class="formula-help-page">
      <h1>Formula Functions</h1>
      <p>Built-in helpers for derived equations. Keep this tab open as a reference while editing formulas.</p>
      <div class="formula-help-list">
        ${renderFormulaHelpStandaloneEntries()}
      </div>
    </article>
  </body>
</html>`;
}

function openFormulaHelpTab() {
  const helpWindow = window.open("", "scouting-formula-help");
  if (!helpWindow) return;
  helpWindow.document.open();
  helpWindow.document.write(renderFormulaHelpStandaloneDocument());
  helpWindow.document.close();
  helpWindow.focus();
}

function analysisMetricOptions() {
  const metrics = currentMetrics();
  const derived = metrics.filter((metric) => metric.kind === "derived");
  const nonDerived = metrics.filter((metric) => metric.kind !== "derived");
  return [...derived, ...nonDerived];
}

function longestSharedPrefix(values) {
  if (!values.length) return "";
  let prefix = values[0];
  for (let index = 1; index < values.length; index += 1) {
    const value = values[index];
    let prefixIndex = 0;
    while (
      prefixIndex < prefix.length &&
      prefixIndex < value.length &&
      prefix[prefixIndex].toLowerCase() === value[prefixIndex].toLowerCase()
    ) {
      prefixIndex += 1;
    }
    prefix = prefix.slice(0, prefixIndex);
    if (!prefix) break;
  }
  return prefix;
}

function stringsEqualIgnoreCase(left, right) {
  return String(left || "").toLowerCase() === String(right || "").toLowerCase();
}

function replaceFormulaToken(input, token, replacement) {
  const cursor = input.selectionStart ?? input.value.length;
  const nextValue = `${input.value.slice(0, cursor - token.length)}${replacement}${input.value.slice(cursor)}`;
  input.value = nextValue;
  const nextCursor = cursor - token.length + replacement.length;
  input.setSelectionRange(nextCursor, nextCursor);
  const definition = activeDerivedEquation();
  if (definition) updateSeasonEquationFormula(definition.id, nextValue);
  saveState();
  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(nextCursor, nextCursor);
  });
}

function formulaAutocompleteState(input) {
  if (!input) return { token: "", candidates: [], cursor: 0 };
  const cursor = input.selectionStart ?? input.value.length;
  const match = input.value.slice(0, cursor).match(/[A-Za-z_.][A-Za-z0-9_.]*$/);
  const token = match?.[0] || "";
  return {
    token,
    candidates: token ? formulaAutocompleteCandidates(token) : [],
    cursor,
  };
}

function renderFormulaAutocomplete(input, requestedIndex = 0) {
  const popup = document.querySelector("#derivedFormulaAutocomplete");
  if (!popup || !input) return { token: "", candidates: [], selectedIndex: -1 };
  const autocomplete = formulaAutocompleteState(input);
  if (!autocomplete.token || !autocomplete.candidates.length) {
    popup.hidden = true;
    popup.innerHTML = "";
    popup.dataset.selectedIndex = "-1";
    return { ...autocomplete, selectedIndex: -1 };
  }
  const selectedIndex = Math.max(0, Math.min(autocomplete.candidates.length - 1, requestedIndex));
  popup.hidden = false;
  popup.dataset.selectedIndex = String(selectedIndex);
  popup.innerHTML = autocomplete.candidates
    .slice(0, 100)
    .map(
      (candidate, index) => `
        <button
          type="button"
          class="formula-autocomplete-item ${index === selectedIndex ? "active" : ""}"
          data-formula-suggestion="${escapeAttribute(candidate)}"
        >
          ${escapeHtml(candidate)}
        </button>
      `,
    )
    .join("");
  return { ...autocomplete, selectedIndex };
}

function hideFormulaAutocomplete() {
  const popup = document.querySelector("#derivedFormulaAutocomplete");
  if (!popup) return;
  popup.hidden = true;
  popup.innerHTML = "";
  popup.dataset.selectedIndex = "-1";
}

function selectedFormulaAutocompleteCandidate() {
  const popup = document.querySelector("#derivedFormulaAutocomplete");
  if (!popup || popup.hidden) return "";
  const selectedIndex = Number(popup.dataset.selectedIndex || "-1");
  const button = popup.querySelectorAll("[data-formula-suggestion]")[selectedIndex];
  return button?.dataset.formulaSuggestion || "";
}

function updateFormulaSuggestionList(input) {
  renderFormulaAutocomplete(input);
}

function filterAutocompleteState(input) {
  if (!input) return { token: "", candidates: [], cursor: 0 };
  const cursor = input.selectionStart ?? input.value.length;
  const match = input.value.slice(0, cursor).match(/[A-Za-z_.][A-Za-z0-9_.]*$/);
  const token = match?.[0] || "";
  return {
    token,
    candidates: token ? filterAutocompleteCandidates(token) : [],
    cursor,
  };
}

function renderFilterAutocomplete(input, requestedIndex = 0) {
  const popup = document.querySelector("#seasonFilterAutocomplete");
  if (!popup || !input) return { token: "", candidates: [], selectedIndex: -1 };
  const autocomplete = filterAutocompleteState(input);
  if (!autocomplete.token || !autocomplete.candidates.length) {
    popup.hidden = true;
    popup.innerHTML = "";
    popup.dataset.selectedIndex = "-1";
    return { ...autocomplete, selectedIndex: -1 };
  }
  const selectedIndex = Math.max(0, Math.min(autocomplete.candidates.length - 1, requestedIndex));
  popup.hidden = false;
  popup.dataset.selectedIndex = String(selectedIndex);
  popup.innerHTML = autocomplete.candidates
    .slice(0, 100)
    .map(
      (candidate, index) => `
        <button
          type="button"
          class="formula-autocomplete-item ${index === selectedIndex ? "active" : ""}"
          data-filter-formula-suggestion="${escapeAttribute(candidate)}"
        >
          ${escapeHtml(candidate)}
        </button>
      `,
    )
    .join("");
  return { ...autocomplete, selectedIndex };
}

function hideFilterAutocomplete() {
  const popup = document.querySelector("#seasonFilterAutocomplete");
  if (!popup) return;
  popup.hidden = true;
  popup.innerHTML = "";
  popup.dataset.selectedIndex = "-1";
}

function selectedFilterAutocompleteCandidate() {
  const popup = document.querySelector("#seasonFilterAutocomplete");
  if (!popup || popup.hidden) return "";
  const selectedIndex = Number(popup.dataset.selectedIndex || "-1");
  const button = popup.querySelectorAll("[data-filter-formula-suggestion]")[selectedIndex];
  return button?.dataset.filterFormulaSuggestion || "";
}

function replaceFilterToken(input, token, replacement) {
  const cursor = input.selectionStart ?? input.value.length;
  const nextValue = `${input.value.slice(0, cursor - token.length)}${replacement}${input.value.slice(cursor)}`;
  input.value = nextValue;
  const nextCursor = cursor - token.length + replacement.length;
  input.setSelectionRange(nextCursor, nextCursor);
  const definition = activeSeasonFilter();
  if (definition) updateSeasonFilterFormula(definition.id, nextValue);
  saveState();
  requestAnimationFrame(() => {
    input.focus();
    input.setSelectionRange(nextCursor, nextCursor);
  });
}

function updateFilterSuggestionList(input) {
  renderFilterAutocomplete(input);
}

function removePicklist(id) {
  if (state.picklists.length <= 1) return;
  const nextPicklists = state.picklists.filter((picklist) => picklist.id !== id);
  state.picklists = nextPicklists;
  state.activePicklist = nextPicklists[Math.min(nextPicklists.length - 1, nextPicklists.findIndex((picklist) => picklist.id === state.activePicklist))]?.id || nextPicklists[0].id;
  state.loadedSources = state.loadedSources.filter((entry) => entry !== `picklist:${id}`);
  if (!state.loadedSources.length) state.loadedSources = [`picklist:${nextPicklists[0].id}`];
  state.picklistColumns = state.picklistColumns.map((entry) => (entry === `picklist:${id}` ? "" : entry));
  if (state.contextMenu?.id === id) state.contextMenu = null;
  saveState();
  render();
}

function removeSortEquation(id) {
  if (id === protectedEpaSortId || state.sortEquations.length <= 1) return;
  const nextEquations = state.sortEquations.filter((equation) => equation.id !== id);
  state.sortEquations = nextEquations;
  state.activeSortEquation = nextEquations[Math.min(nextEquations.length - 1, nextEquations.findIndex((equation) => equation.id === state.activeSortEquation))]?.id || nextEquations[0].id;
  state.metric = state.metric === `sort:${id}` ? "epa" : state.metric;
  state.loadedSources = state.loadedSources.filter((entry) => entry !== `sort:${id}`);
  state.picklistColumns = state.picklistColumns.map((entry) => (entry === `sort:${id}` ? "" : entry));
  if (state.contextMenu?.id === id) state.contextMenu = null;
  saveState();
  render();
}

function renamePicklist(id, requestedName) {
  const picklist = state.picklists.find((item) => item.id === id);
  if (!picklist) return;
  const trimmed = requestedName.trim();
  if (!trimmed || trimmed === picklist.name) return;
  const name = uniqueEntityName(trimmed, state.picklists.filter((item) => item.id !== id), trimmed);
  state.picklists = state.picklists.map((item) => (item.id === id ? { ...item, name } : item));
  saveState();
  render();
}

function renameSortEquation(id, requestedName) {
  const equation = state.sortEquations.find((item) => item.id === id);
  if (!equation || isProtectedSortEquation(equation)) return;
  const trimmed = requestedName.trim();
  if (!trimmed || trimmed === equation.name) return;
  const name = uniqueEntityName(trimmed, state.sortEquations.filter((item) => item.id !== id), trimmed);
  state.sortEquations = state.sortEquations.map((item) => (item.id === id ? { ...item, name } : item));
  saveState();
  render();
}

function duplicateSortEquation(id) {
  const equation = state.sortEquations.find((item) => item.id === id);
  if (!equation) return;
  const baseName = isProtectedSortEquation(equation) ? "EPA Copy" : `${equation.name} Copy`;
  const name = uniqueEntityName(baseName, state.sortEquations, baseName);
  const duplicate = {
    id: createId("sort"),
    name,
    terms: normalizeCriteriaTerms(equation.metricId ? defaultCriteriaTerms : equation.terms),
    locked: false,
  };
  state.sortEquations = [...state.sortEquations, duplicate];
  state.activeSortEquation = duplicate.id;
  state.builderFocus.sortBuilder = "list";
  saveState();
  render();
}

function startInlineRename(kind, id) {
  const collection = kind === "sortEquation"
    ? state.sortEquations
    : kind === "derivedEquation"
      ? currentSeasonEquationList()
      : kind === "seasonFilter"
        ? currentSeasonFilterList()
        : state.picklists;
  const item = collection.find((entry) => entry.id === id);
  if (!item || (kind === "sortEquation" && isProtectedSortEquation(item))) return;
  state.inlineRename = { kind, id, value: item.name };
  render();
}

function commitInlineRename() {
  if (!state.inlineRename) return;
  const { kind, id, value } = state.inlineRename;
  state.inlineRename = null;
  if (kind === "sortEquation") renameSortEquation(id, value);
  else if (kind === "derivedEquation") renameSeasonEquation(id, value);
  else if (kind === "seasonFilter") renameSeasonFilter(id, value);
  else renamePicklist(id, value);
}

function cancelInlineRename() {
  if (!state.inlineRename) return;
  state.inlineRename = null;
  render();
}

function handleBuilderKeyboard(event) {
  if (state.inlineRename) return;
  const target = event.target;
  if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;

  if (event.key === "F2") {
    if (state.activeView === "derivedBuilder" && state.builderFocus.derivedBuilder === "equations" && !state.activeDerivedPreviewMetricId && state.activeDerivedEquationId) {
      event.preventDefault();
      startInlineRename("derivedEquation", state.activeDerivedEquationId);
    }
    if (state.activeView === "sortBuilder" && state.activeSortEquation && !isProtectedSortEquation(activeSortEquation())) {
      event.preventDefault();
      startInlineRename("sortEquation", state.activeSortEquation);
    }
    if (state.activeView === "picklistBuilder" && state.activePicklist) {
      event.preventDefault();
      startInlineRename("picklist", state.activePicklist);
    }
    return;
  }

  if (state.activeView === "sortBuilder") {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      const index = state.sortEquations.findIndex((item) => item.id === state.activeSortEquation);
      const next = state.sortEquations[Math.max(0, Math.min(state.sortEquations.length - 1, index + direction))];
      if (!next) return;
      state.activeSortEquation = next.id;
      saveState();
      render();
    }
    return;
  }

  if (state.activeView === "derivedBuilder") {
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const direction = event.key === "ArrowUp" ? -1 : 1;
      if (state.builderFocus.derivedBuilder === "metrics") {
        const availableMetrics = currentDerivedAvailableMetrics();
        const activeMetricId = String(state.activeDerivedPreviewMetricId || "");
        const index = activeMetricId ? availableMetrics.findIndex((item) => item.id === activeMetricId) : -1;
        const next = availableMetrics[Math.max(0, Math.min(availableMetrics.length - 1, index + direction))];
        if (!next) return;
        captureBuilderListScroll();
        state.activeDerivedPreviewMetricId = next.id;
        saveState();
        render();
        return;
      }
      const equations = currentSeasonEquationList();
      const activeEquationId = ensureActiveDerivedEquation();
      const index = equations.findIndex((item) => item.id === activeEquationId);
      const next = equations[Math.max(0, Math.min(equations.length - 1, index + direction))];
      if (!next) return;
      state.activeDerivedEquationId = next.id;
      state.activeDerivedPreviewMetricId = "";
      state.builderFocus.derivedBuilder = "equations";
      saveState();
      render();
    }
    return;
  }

  if (state.activeView !== "picklistBuilder") return;

  const currentPicklist = activePicklist();
  if (event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown") && state.picklistSelectedTeam) {
    event.preventDefault();
    const nextTeams = moveItemByStep(currentPicklist.teams, state.picklistSelectedTeam, event.key === "ArrowUp" ? -1 : 1);
    updatePicklist(currentPicklist.id, (picklist) => ({ ...picklist, teams: nextTeams }));
    return;
  }

  if (event.key === "ArrowUp" || event.key === "ArrowDown") {
    event.preventDefault();
    if (state.builderFocus.picklistBuilder === "teams" && state.picklistSelectedTeam) {
      const index = currentPicklist.teams.indexOf(state.picklistSelectedTeam);
      const nextIndex = Math.max(0, Math.min(currentPicklist.teams.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)));
      state.picklistSelectedTeam = currentPicklist.teams[nextIndex] || null;
      render();
      return;
    }
    const index = state.picklists.findIndex((item) => item.id === state.activePicklist);
    const next = state.picklists[Math.max(0, Math.min(state.picklists.length - 1, index + (event.key === "ArrowUp" ? -1 : 1)))];
    if (!next) return;
    state.activePicklist = next.id;
    state.builderFocus.picklistBuilder = "list";
    saveState();
    render();
  }
}

function bindViewEvents() {
  document.querySelector("#metricSelect")?.addEventListener("change", (event) => {
    state.metric = event.target.value;
    saveState();
    render();
  });
  document.querySelector("#teamDetailMetricSelect")?.addEventListener("change", (event) => {
    state.teamDetailMetric = normalizeTeamDetailMetric(event.target.value);
    saveState();
    render();
  });
  document.querySelector("#picklistCompareMetricSelect")?.addEventListener("change", (event) => {
    state.picklistCompareMetric = normalizeTeamDetailMetric(event.target.value);
    saveState();
    render();
  });
  document.querySelector("#scoutingWindowSelect")?.addEventListener("change", (event) => {
    state.scoutingWindow = event.target.value === "recent" ? "recent" : "all";
    saveState();
    render();
  });
  document.querySelector("#picklistScoutingWindowSelect")?.addEventListener("change", (event) => {
    state.scoutingWindow = event.target.value === "recent" ? "recent" : "all";
    saveState();
    render();
  });
  document.querySelector("#teamSelect")?.addEventListener("change", (event) => {
    state.selectedTeam = Number(event.target.value);
    state.activeView = "teamDetail";
    saveState();
    render();
  });
  document.querySelector("#adminEventSelect")?.addEventListener("change", (event) => {
    const nextEventKey = event.target.value;
    if (!nextEventKey) return;
    switchActiveEvent(nextEventKey, { activeView: "admin" });
  });
  document.querySelector("#lookupEventCodeButton")?.addEventListener("click", async () => {
    const nextEventCode = document.querySelector("#adminEventCodeInput")?.value;
    await loadArbitraryEventCode(nextEventCode, { activeView: "admin" });
  });
  document.querySelector("#adminEventCodeInput")?.addEventListener("keydown", async (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    await loadArbitraryEventCode(event.target.value, { activeView: "admin" });
  });
  document.querySelector("#adminTbaAuthKeyInput")?.addEventListener("change", (event) => {
    setTbaAuthKey(event.target.value, { save: true });
    render();
  });
  document.querySelector("#activeScoutingAttachmentSelect")?.addEventListener("change", (event) => {
    const nextAttachmentId = event.target.value;
    if (!nextAttachmentId) return;
    setCurrentScoutingAttachment(nextAttachmentId);
  });
  document.querySelector("#addScoutingAttachmentButton")?.addEventListener("click", () => {
    addScoutingAttachmentDraft();
  });
  document.querySelector("#removeScoutingAttachmentButton")?.addEventListener("click", () => {
    const attachmentId = currentScoutingAttachment()?.attachmentId;
    if (!attachmentId) return;
    void deleteScoutingAttachment(attachmentId);
  });
  document.querySelector("#chooseLocalScoutingFileButton")?.addEventListener("click", async () => {
    await chooseLocalScoutingAttachmentFile();
  });
  document.querySelector("#saveScoutingAttachmentButton")?.addEventListener("click", () => {
    saveCurrentScoutingAttachmentDraftFromDom();
  });
  document.querySelector("#reloadScoutingAttachmentButton")?.addEventListener("click", async () => {
    saveCurrentScoutingAttachmentDraftFromDom({ render: false });
    await loadScoutingData();
  });
  document.querySelectorAll("[data-refresh-source]").forEach((button) => {
    button.addEventListener("click", async () => {
      await refreshDataSource(button.dataset.refreshSource);
    });
  });
  document.querySelector("#refreshAllSourcesButton")?.addEventListener("click", async () => {
    await refreshAllDataSources();
  });
  document.querySelectorAll("[data-toggle-source-polling]").forEach((button) => {
    button.addEventListener("click", () => {
      const sourceId = button.dataset.toggleSourcePolling;
      const pollingEnabled = button.dataset.pollingEnabled === "true";
      setDataSourcePollingEnabled(sourceId, !pollingEnabled);
    });
  });
  document.querySelector("#switchAdminEventButton")?.addEventListener("click", () => {
    const nextEventKey = document.querySelector("#adminEventSelect")?.value;
    if (!nextEventKey) return;
    switchActiveEvent(nextEventKey, { activeView: "admin" });
  });
  document.querySelector("#clearAllianceBoardButton")?.addEventListener("click", clearAllianceBoard);
  document.querySelectorAll("[data-team], [data-team-link]").forEach((element) => {
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      pushViewHistory();
      state.selectedTeam = Number(element.dataset.team || element.dataset.teamLink);
      state.activeView = "teamDetail";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-match]").forEach((element) => {
    element.addEventListener("click", () => {
      pushViewHistory();
      state.selectedMatch = Number(element.dataset.match);
      state.activeView = "matchup";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-match-nav]").forEach((element) => {
    element.addEventListener("click", () => {
      if (!element.dataset.matchNav) return;
      pushViewHistory();
      state.selectedMatch = Number(element.dataset.matchNav);
      state.activeView = "matchup";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-match-row]").forEach((element) => {
    element.addEventListener("click", () => {
      pushViewHistory();
      state.selectedMatch = Number(element.dataset.matchRow);
      state.activeView = "matchup";
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-drag-team]").forEach((element) => {
    element.addEventListener("dragstart", (event) => {
      const teamNumber = element.dataset.dragTeam;
      if (pickedTeams().includes(Number(teamNumber))) {
        event.preventDefault();
        return;
      }
      event.dataTransfer.setData("text/plain", teamNumber);
      event.dataTransfer.effectAllowed = "copy";
    });
  });
  document.querySelectorAll("[data-board-cell]").forEach((cell) => {
    const cellIndex = Number(cell.dataset.boardCell);
    cell.addEventListener("dragover", (event) => {
      if (!state.allianceBoard[cellIndex]) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }
    });
    cell.addEventListener("drop", (event) => {
      event.preventDefault();
      placeTeamOnBoard(event.dataTransfer.getData("text/plain"), cellIndex);
    });
    cell.addEventListener("contextmenu", (event) => {
      if (!state.allianceBoard[cellIndex]) return;
      event.preventDefault();
      state.contextMenu = { type: "board", cell: cellIndex, x: event.clientX, y: event.clientY };
      render();
    });
  });
  document.querySelectorAll("[data-board-input]").forEach((input) => {
    const cellIndex = Number(input.dataset.boardInput);
    const submit = () => {
      const value = input.value.trim();
      if (value) placeTeamOnBoard(value, cellIndex);
    };
    input.addEventListener("change", submit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") submit();
    });
  });
  document.querySelectorAll("[data-remove-cell]").forEach((button) => {
    button.addEventListener("click", () => removeTeamFromBoard(Number(button.dataset.removeCell)));
  });
  document.addEventListener(
    "click",
    (event) => {
      if (event.target.closest(".context-menu")) return;
      if (!state.contextMenu) return;
      state.contextMenu = null;
      render();
    },
    { once: true },
  );
  document.querySelectorAll(".picklist-check").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      state.loadedSources = Array.from(document.querySelectorAll(".picklist-check:checked"))
        .map((input) => normalizeSourceEntry(input.value))
        .filter(Boolean);
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-loaded-source-handle]").forEach((handle) => {
    handle.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/x-loaded-source", handle.dataset.loadedSourceHandle);
      event.dataTransfer.effectAllowed = "move";
    });
  });
  document.querySelectorAll("[data-loaded-source]").forEach((section) => {
    section.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    section.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedSource = event.dataTransfer.getData("application/x-loaded-source");
      const targetSource = section.dataset.loadedSource;
      if (!draggedSource || !targetSource || draggedSource === targetSource) return;
      state.loadedSources = moveItemBefore(state.loadedSources, draggedSource, targetSource);
      saveState();
      render();
    });
  });
  document.querySelector("#addPicklistButton")?.addEventListener("click", () => {
    const name = uniqueEntityName("Picklist", state.picklists, "Picklist");
    const picklist = { id: createId("pick"), name, teams: defaultTeamsForNewPicklist() };
    state.picklists = [...state.picklists, picklist];
    state.activePicklist = picklist.id;
    state.builderFocus.picklistBuilder = "list";
    saveState();
    render();
  });
  document.querySelector("#addSortEquationButton")?.addEventListener("click", () => {
    const name = uniqueEntityName("Sort Equation", state.sortEquations, "Sort Equation");
    const equation = { id: createId("sort"), name, terms: normalizeCriteriaTerms(defaultCriteriaTerms) };
    state.sortEquations = [...state.sortEquations, equation];
    state.activeSortEquation = equation.id;
    state.builderFocus.sortBuilder = "list";
    saveState();
    render();
  });
  document.querySelector("#addDerivedEquationButton")?.addEventListener("click", () => {
    if (!isAdmin()) return;
    addSeasonEquation();
  });
  document.querySelector("#derivedEquationFormulaInput")?.addEventListener("input", (event) => {
    const definition = activeDerivedEquation();
    if (!definition) return;
    updateSeasonEquationFormula(definition.id, event.target.value);
    updateFormulaSuggestionList(event.target);
    saveState();
  });
  document.querySelector("#derivedEquationFormulaInput")?.addEventListener("change", () => {
    saveState();
    render();
  });
  document.querySelector("#derivedEquationFormulaInput")?.addEventListener("focus", (event) => {
    updateFormulaSuggestionList(event.target);
  });
  document.querySelector("#derivedEquationFormulaInput")?.addEventListener("blur", () => {
    setTimeout(() => hideFormulaAutocomplete(), 0);
  });
  document.querySelector("#derivedEquationFormulaInput")?.addEventListener("keydown", (event) => {
    const input = event.target;
    const autocomplete = formulaAutocompleteState(input);
    const selectedIndex = Number(document.querySelector("#derivedFormulaAutocomplete")?.dataset.selectedIndex || "0");
    if (event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      if (!autocomplete.token) {
        requestAnimationFrame(() => input.focus());
        return;
      }
      const token = autocomplete.token;
      const selectedCandidate = selectedFormulaAutocompleteCandidate();
      const candidates = autocomplete.candidates.filter((candidate) => !stringsEqualIgnoreCase(candidate, token));
      const replacement = selectedCandidate || longestSharedPrefix(candidates);
      if (replacement && !stringsEqualIgnoreCase(replacement, token)) replaceFormulaToken(input, token, replacement);
      else if (autocomplete.candidates.length === 1 && autocomplete.candidates[0] !== token) replaceFormulaToken(input, token, autocomplete.candidates[0]);
      else requestAnimationFrame(() => input.focus());
      requestAnimationFrame(() => updateFormulaSuggestionList(input));
      return;
    }
    if ((event.key === "ArrowDown" || event.key === "ArrowUp") && autocomplete.candidates.length) {
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      renderFormulaAutocomplete(input, selectedIndex + direction);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      let nextValue = input.value;
      if (autocomplete.candidates.length) {
        const replacement = selectedFormulaAutocompleteCandidate() || autocomplete.candidates[0];
        if (replacement && !stringsEqualIgnoreCase(replacement, autocomplete.token)) {
          nextValue = `${input.value.slice(0, autocomplete.cursor - autocomplete.token.length)}${replacement}${input.value.slice(autocomplete.cursor)}`;
          input.value = nextValue;
          const nextCursor = autocomplete.cursor - autocomplete.token.length + replacement.length;
          input.setSelectionRange(nextCursor, nextCursor);
        }
      }
      const definition = activeDerivedEquation();
      if (definition) updateSeasonEquationFormula(definition.id, nextValue);
      saveState();
      hideFormulaAutocomplete();
      render();
      requestAnimationFrame(() => {
        const nextInput = document.querySelector("#derivedEquationFormulaInput");
        if (!nextInput) return;
        const nextCursor = nextInput.value.length;
        nextInput.focus();
        nextInput.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }
    requestAnimationFrame(() => updateFormulaSuggestionList(input));
  });
  document.querySelectorAll("[data-formula-suggestion]").forEach((button) => {
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
    });
    button.addEventListener("click", () => {
      const input = document.querySelector("#derivedEquationFormulaInput");
      if (!input) return;
      const autocomplete = formulaAutocompleteState(input);
      const replacement = button.dataset.formulaSuggestion || "";
      if (!autocomplete.token || !replacement) return;
      replaceFormulaToken(input, autocomplete.token, replacement);
      requestAnimationFrame(() => updateFormulaSuggestionList(input));
    });
  });
  document.querySelectorAll("[data-derived-preview-metric]").forEach((item) => {
    item.addEventListener("click", () => {
      captureBuilderListScroll();
      state.activeDerivedPreviewMetricId = item.dataset.derivedPreviewMetric || "";
      state.builderFocus.derivedBuilder = "metrics";
      saveState();
      render();
    });
  });
  document.querySelector("#formulaFunctionHelpButton")?.addEventListener("click", () => {
    openFormulaHelpTab();
  });
  document.querySelector("[data-builder-grid-shell]")?.addEventListener("scroll", () => {
    captureBuilderGridScroll();
  });
  document.querySelectorAll("[data-builder-grid-column-scroll]").forEach((column) => {
    column.addEventListener("scroll", () => {
      captureBuilderGridScroll();
      const scrollTop = column.scrollTop;
      document.querySelectorAll("[data-builder-grid-column-scroll]").forEach((other) => {
        if (other !== column && Math.abs(other.scrollTop - scrollTop) > 1) other.scrollTop = scrollTop;
      });
    });
  });
  document.querySelectorAll("[data-builder-list-scroll]").forEach((list) => {
    list.addEventListener("scroll", () => {
      captureBuilderListScroll();
    });
  });
  document.querySelectorAll("[data-entity-row]").forEach((row) => {
    row.addEventListener("click", () => {
      captureBuilderGridScroll();
      const kind = row.dataset.entityKind;
      const id = row.dataset.entityId;
      if (kind === "sortEquation") {
        state.activeSortEquation = id;
        state.builderFocus.sortBuilder = "list";
      } else if (kind === "derivedEquation") {
        state.activeDerivedEquationId = id;
        state.activeDerivedPreviewMetricId = "";
        state.builderFocus.derivedBuilder = "equations";
      } else if (kind === "seasonFilter") {
        state.activeSeasonFilterId = id;
      } else {
        state.activePicklist = id;
        state.builderFocus.picklistBuilder = "list";
      }
      saveState();
      render();
    });
    row.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      state.contextMenu = {
        type: "entity",
        entityKind: row.dataset.entityKind,
        id: row.dataset.entityId,
        x: event.clientX,
        y: event.clientY,
      };
      render();
    });
    row.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/x-entity-row", row.dataset.entityRow);
      event.dataTransfer.effectAllowed = "move";
    });
    row.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    row.addEventListener("drop", (event) => {
      event.preventDefault();
      const payload = event.dataTransfer.getData("application/x-entity-row");
      const [kind, draggedId] = payload.split(":");
      if (!draggedId || kind !== row.dataset.entityKind || draggedId === row.dataset.entityId) return;
      if (kind === "sortEquation") {
        if (draggedId === protectedEpaSortId || row.dataset.entityId === protectedEpaSortId) return;
        state.sortEquations = moveItemBefore(state.sortEquations, state.sortEquations.find((item) => item.id === draggedId), state.sortEquations.find((item) => item.id === row.dataset.entityId));
      } else if (kind === "derivedEquation") {
        const moved = moveItemBefore(currentSeasonEquationList(), currentSeasonEquationList().find((item) => item.id === draggedId), currentSeasonEquationList().find((item) => item.id === row.dataset.entityId));
        updateSeasonEquationList(moved.map((item, index) => ({ ...item, sourceOrder: index })));
      } else if (kind === "seasonFilter") {
        const moved = moveItemBefore(currentSeasonFilterList(), currentSeasonFilterList().find((item) => item.id === draggedId), currentSeasonFilterList().find((item) => item.id === row.dataset.entityId));
        updateSeasonFilterList(moved.map((item, index) => ({ ...item, sourceOrder: index })));
      } else {
        state.picklists = moveItemBefore(state.picklists, state.picklists.find((item) => item.id === draggedId), state.picklists.find((item) => item.id === row.dataset.entityId));
      }
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-context-rename]").forEach((button) => {
    button.addEventListener("click", () => {
      const [kind, id] = button.dataset.contextRename.split(":");
      state.contextMenu = null;
      startInlineRename(kind, id);
    });
  });
  document.querySelectorAll("[data-context-duplicate]").forEach((button) => {
    button.addEventListener("click", () => duplicateSortEquation(button.dataset.contextDuplicate));
  });
  document.querySelectorAll("[data-context-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!isAdmin()) return;
      const [kind, id] = button.dataset.contextDelete.split(":");
      state.contextMenu = null;
      render();
      const collection = kind === "sortEquation" ? state.sortEquations : kind === "derivedEquation" ? currentSeasonEquationList() : kind === "seasonFilter" ? currentSeasonFilterList() : state.picklists;
      const item = collection.find((entry) => entry.id === id);
      if (!item) return;
      const label = kind === "sortEquation" ? "sort equation" : kind === "derivedEquation" ? "derived equation" : kind === "seasonFilter" ? "season filter" : "picklist";
      if (!confirm(`Remove ${label} "${item.name}"? This cannot be undone.`)) return;
      if (kind === "sortEquation") removeSortEquation(id);
      else if (kind === "derivedEquation") removeSeasonEquation(id);
      else if (kind === "seasonFilter") removeSeasonFilter(id);
      else removePicklist(id);
    });
  });
  document.querySelector("#addCriteriaTerm")?.addEventListener("click", () => {
    const equation = activeSortEquation();
    if (isProtectedSortEquation(equation)) return;
    if (equation.terms.length >= 5) return;
    const terms = normalizeCriteriaTerms([...equation.terms, { operator: "+", weight: 1, metricId: currentEvent().defaultMetricId }]);
    updateSortEquation(equation.id, (current) => ({ ...current, terms }));
  });
  document.querySelectorAll(".term-weight, .term-operator, .term-metric").forEach((control) => {
    const updateTerm = () => {
      const equation = activeSortEquation();
      if (isProtectedSortEquation(equation)) return;
      const termIndex = Number(control.dataset.termIndex);
      if (control.classList.contains("term-operator") && control.value === "remove") {
        const terms = normalizeCriteriaTerms(equation.terms).filter((_, index) => index !== termIndex);
        updateSortEquation(equation.id, (current) => ({ ...current, terms }));
        return;
      }
      const terms = normalizeCriteriaTerms(equation.terms).map((term, index) => {
        if (index !== termIndex) return term;
        if (control.classList.contains("term-weight")) return { ...term, weight: Number(control.value) || 0 };
        if (control.classList.contains("term-operator")) return { ...term, operator: control.value };
        return { ...term, metricId: control.value };
      });
      updateSortEquation(equation.id, (current) => ({ ...current, terms }));
    };
    control.addEventListener("change", updateTerm);
    if (control.classList.contains("term-weight")) control.addEventListener("input", updateTerm);
  });
  document.querySelectorAll("[data-inline-rename]").forEach((input) => {
    input.focus();
    input.select();
    input.addEventListener("input", () => {
      if (!state.inlineRename) return;
      state.inlineRename.value = input.value;
    });
    input.addEventListener("blur", commitInlineRename);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") commitInlineRename();
      if (event.key === "Escape") cancelInlineRename();
      event.stopPropagation();
    });
  });
  document.querySelectorAll("[data-picklist-column]").forEach((select) => {
    select.addEventListener("change", () => {
      state.picklistColumns[Number(select.dataset.picklistColumn)] = select.value;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-grid-column]").forEach((column) => {
    column.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      state.contextMenu = { type: "grid-column", columnIndex: Number(column.dataset.gridColumn), x: event.clientX, y: event.clientY };
      render();
    });
  });
  document.querySelectorAll(".derived-grid-column-body").forEach((column) => {
    column.addEventListener("scroll", () => {
      const scrollTop = column.scrollTop;
      document.querySelectorAll(".derived-grid-column-body").forEach((other) => {
        if (other !== column && Math.abs(other.scrollTop - scrollTop) > 1) other.scrollTop = scrollTop;
      });
    });
  });
  document.querySelectorAll("[data-copy-grid-column]").forEach((button) => {
    button.addEventListener("click", () => {
      const column = gridColumnModel(state.picklistColumns[Number(button.dataset.copyGridColumn)]);
      const picklist = activePicklist();
      if (!column.teams.length) return;
      if (!confirm(`Replace "${picklist.name}" with "${column.label}"?`)) return;
      updatePicklist(picklist.id, (current) => ({ ...current, teams: column.teams.map((team) => team.number) }));
    });
  });
  document.querySelectorAll("[data-builder-team]").forEach((tile) => {
    tile.addEventListener("click", () => {
      const teamNumber = Number(tile.dataset.builderTeam);
      const wasCompared = compareSlotIndexForTeam(teamNumber) >= 0;
      const changed = togglePicklistCompareTeam(teamNumber);
      if (!changed) return;
      state.builderFocus.picklistBuilder = "teams";
      state.picklistSelectedTeam = wasCompared && state.picklistSelectedTeam === teamNumber ? null : teamNumber;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-remove-compare-team]").forEach((button) => {
    button.addEventListener("click", () => {
      const teamNumber = Number(button.dataset.removeCompareTeam);
      const changed = togglePicklistCompareTeam(teamNumber);
      if (!changed) return;
      if (state.picklistSelectedTeam === teamNumber) state.picklistSelectedTeam = null;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-reorder-team]").forEach((tile) => {
    tile.addEventListener("dragstart", (event) => {
      event.dataTransfer.setData("application/x-picklist-team", tile.dataset.reorderTeam);
      event.dataTransfer.effectAllowed = "move";
    });
    tile.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });
    tile.addEventListener("drop", (event) => {
      event.preventDefault();
      const draggedTeam = Number(event.dataTransfer.getData("application/x-picklist-team"));
      const targetTeam = Number(tile.dataset.reorderTeam);
      if (!draggedTeam || draggedTeam === targetTeam) return;
      const picklist = activePicklist();
      updatePicklist(picklist.id, (current) => ({ ...current, teams: moveItemBefore(current.teams, draggedTeam, targetTeam) }));
    });
  });
  document.querySelector("#importSourceUrl")?.addEventListener("input", (event) => {
    setCurrentScoutingSourceUrl(event.target.value);
    syncScoutingAttachmentInferenceFromDom();
  });
  document.querySelector("#scoutingAttachmentFormatSelect")?.addEventListener("change", () => {
    syncScoutingAttachmentInferenceFromDom();
  });
  document.querySelector("#importCsvInput")?.addEventListener("input", (event) => {
    state.importCsvText = event.target.value;
    state.importDraftSource = "";
  });
  document.querySelector("#loadScoutingDataButton")?.addEventListener("click", async () => {
    saveCurrentScoutingAttachmentDraftFromDom({ render: false });
    await loadScoutingData();
  });
  document.querySelector("#dryRunImportButton")?.addEventListener("click", () => {
    runImportPreview();
  });
  document.querySelector("#commitImportButton")?.addEventListener("click", () => {
    commitImportPreview();
  });
  document.querySelector("#clearImportButton")?.addEventListener("click", () => {
    state.importCsvText = "";
    state.importSelectedProfileId = "";
    state.importDraftSource = "";
    state.importResult = null;
    render();
  });
  document.querySelector("#switchImportContextButton")?.addEventListener("click", () => {
    switchImportContext(state.importResult?.suggestedEventKey);
  });
  document.querySelectorAll("[data-review-keep]").forEach((button) => {
    button.addEventListener("click", () => {
      keepSubmission(button.dataset.reviewKeep);
    });
  });
  document.querySelectorAll("[data-review-exclude]").forEach((button) => {
    button.addEventListener("click", () => {
      excludeSubmission(button.dataset.reviewExclude);
    });
  });
  document.querySelectorAll("[data-review-reset]").forEach((button) => {
    button.addEventListener("click", () => {
      resetSubmissionReview(button.dataset.reviewReset);
    });
  });
  document.querySelectorAll("[data-clear-duplicate-group]").forEach((button) => {
    button.addEventListener("click", () => {
      clearDuplicateGroup(button.dataset.clearDuplicateGroup);
    });
  });
  document.onkeydown = handleBuilderKeyboard;
}

bootstrapApp();

