import fs from "node:fs";
import path from "node:path";

const TBA_ENDPOINTS = {
  event: (base, event) => `${base}/event/${event}`,
  teams: (base, event) => `${base}/event/${event}/teams`,
  matches: (base, event) => `${base}/event/${event}/matches`,
  alliances: (base, event) => `${base}/event/${event}/alliances`,
  rankings: (base, event) => `${base}/event/${event}/rankings`,
  oprs: (base, event) => `${base}/event/${event}/oprs`,
};

const STATBOTICS_ENDPOINTS = {
  event: (base, event) => `${base}/event/${event}`,
  teamEvents: (base, event) => `${base}/team_events/event/${event}`,
  matches: (base, event) => `${base}/matches?event=${encodeURIComponent(event)}`,
  teamMatches: (base, event) => `${base}/team_matches?event=${encodeURIComponent(event)}&limit=10000`,
};

const clone = (value) => JSON.parse(JSON.stringify(value));
const normalizeEventCode = (value) => String(value || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

export function fingerprint(value) {
  const input = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16)}:${input.length}`;
}

function completed(match) {
  return Number(match?.alliances?.red?.score) >= 0 && Number(match?.alliances?.blue?.score) >= 0;
}

function eventTag(tba = {}, statbotics = {}) {
  const matches = Array.isArray(tba.matches) ? tba.matches : [];
  const complete = matches.filter(completed).sort((left, right) => {
    const order = { qm: 0, ef: 1, qf: 2, sf: 3, f: 4 };
    return (order[left.comp_level] ?? 9) - (order[right.comp_level] ?? 9)
      || Number(left.match_number || 0) - Number(right.match_number || 0)
      || Number(left.set_number || 0) - Number(right.set_number || 0);
  });
  if (!matches.length) return "pre-event";
  if (!complete.length) return "schedule-released";
  const match = complete.at(-1);
  const level = match.comp_level;
  const number = Number(match.match_number || 0);
  if (level === "qm") return `qual-${number}`;
  const name = { ef: "eighths", qf: "quarters", sf: "semis", f: "finals" }[level] || "match";
  const set = Number(match.set_number || 0);
  return set > 0 ? `${name}-${set}-${number}` : `${name}-${number}`;
}

async function fetchJson(url, headers, etag, fetchImpl = fetch) {
  const requestHeaders = { ...headers };
  if (etag) requestHeaders["If-None-Match"] = etag;
  const response = await fetchImpl(url, { headers: requestHeaders });
  if (response.status === 304) return { notModified: true, etag };
  if (!response.ok) throw Object.assign(new Error(`HTTP ${response.status}`), { status: response.status, url });
  return { payload: await response.json(), etag: response.headers.get("etag") || "" };
}

async function pollProvider(previous, endpointFactories, baseUrl, headers, eventCode, fallbackBaseUrl = "", fetchImpl = fetch) {
  const endpointState = { ...(previous?.endpoints || {}) };
  for (const [name, factory] of Object.entries(endpointFactories)) {
    const old = endpointState[name] || {};
    const attempt = async (url, usedFallback) => {
      try {
        const result = await fetchJson(url, headers, old.etag, fetchImpl);
        return {
          ...(result.notModified ? old : { payload: result.payload, etag: result.etag }),
          status: "ready",
          sourceUrl: url,
          usedFallback,
          fetchedAt: new Date().toISOString(),
          error: "",
        };
      } catch (error) {
        return { error };
      }
    };
    let next = await attempt(factory(baseUrl, eventCode), false);
    if (next.error && fallbackBaseUrl) next = await attempt(factory(fallbackBaseUrl, eventCode), true);
    endpointState[name] = next.error
      ? { ...old, status: "error", sourceUrl: old.sourceUrl || baseUrl, usedFallback: old.usedFallback || false, fetchedAt: new Date().toISOString(), error: next.error.message }
      : next;
  }
  const endpointValues = Object.values(endpointState);
  const ready = endpointValues.filter((value) => value.status === "ready").length;
  return {
    status: ready === endpointValues.length ? "ready" : ready ? "partial" : "error",
    sourceUrl: endpointValues.find((value) => value.sourceUrl)?.sourceUrl || baseUrl,
    usedFallback: endpointValues.some((value) => value.usedFallback),
    endpoints: endpointState,
    error: endpointValues.find((value) => value.error)?.error || "",
  };
}

function providerPayload(state) {
  return Object.fromEntries(Object.entries(state?.endpoints || {}).filter(([, value]) => Object.prototype.hasOwnProperty.call(value, "payload")).map(([name, value]) => [name, clone(value.payload)]));
}

export function loadRecorderConfig(configPath = process.env.EVENT_RECORDER_CONFIG || "") {
  if (!configPath) return {};
  const config = JSON.parse(fs.readFileSync(path.resolve(configPath), "utf8"));
  return {
    events: Array.isArray(config.events) ? config.events : typeof config.events === "string" ? config.events.split(",") : [],
    outputRoot: config.outputRoot,
    tbaBaseUrl: config.tbaBaseUrl,
    statboticsBaseUrl: config.statboticsBaseUrl,
    statboticsFallbackBaseUrl: config.statboticsFallbackBaseUrl,
    pollIntervalsMs: config.pollIntervalsMs,
    statusPort: config.statusPort,
  };
}

function writeJson(filePath, value) {
  const temporary = `${filePath}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, filePath);
}

export function createRecordingStore({ root = path.resolve("recordings"), eventCode }) {
  const normalizedEventCode = normalizeEventCode(eventCode);
  if (!normalizedEventCode) throw new Error("An event code is required.");
  const directory = path.join(root, normalizedEventCode);
  const cursorDirectory = path.join(directory, "cursors");
  const statePath = path.join(directory, "recorder-state.json");
  const manifestPath = path.join(directory, "manifest.json");
  fs.mkdirSync(cursorDirectory, { recursive: true });
  let state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { nextCursor: 0, latest: null, providers: {} };
  function saveCursor(snapshot, metadata = {}) {
    const cursor = state.nextCursor;
    const record = { formatVersion: 1, cursor, recordedAt: new Date().toISOString(), eventTag: snapshot.eventTag, providers: snapshot.providers };
    writeJson(path.join(cursorDirectory, `${String(cursor).padStart(6, "0")}.json`), record);
    state = { ...state, nextCursor: cursor + 1, latest: record, providers: snapshot.providers, ...clone(metadata) };
    writeJson(statePath, state);
    writeJson(manifestPath, { formatVersion: 1, eventCode: normalizedEventCode, cursorCount: state.nextCursor, updatedAt: record.recordedAt });
    return record;
  }
  function saveState(updates = {}) {
    state = { ...state, ...clone(updates) };
    writeJson(statePath, state);
  }
  return { directory, normalizedEventCode, loadState: () => clone(state), saveCursor, saveState };
}

export function createRecorder({ eventCode, outputRoot = path.resolve("recordings"), tbaBaseUrl = "https://www.thebluealliance.com/api/v3", statboticsBaseUrl = "https://api.statbotics.io/v3", statboticsFallbackBaseUrl = "https://api-statbotics.iterativerefinement.com/v3", tbaAuthKey = "", pollIntervalsMs = { tba: 60000, statbotics: 120000 }, fetchNow = Date.now, fetchImpl = fetch } = {}) {
  const store = createRecordingStore({ root: outputRoot, eventCode });
  const previousState = store.loadState();
  let providers = previousState.providers || {};
  let latestFingerprint = previousState.latestFingerprint || "";
  let lastPollAt = { ...(previousState.lastPollAt || {}) };
  async function pollProviderNow(source) {
    const isTba = source === "tba";
    const previous = providers[source];
    try {
      const next = await pollProvider(previous, isTba ? TBA_ENDPOINTS : STATBOTICS_ENDPOINTS, isTba ? tbaBaseUrl : statboticsBaseUrl, isTba ? { "X-TBA-Auth-Key": tbaAuthKey } : {}, store.normalizedEventCode, isTba ? "" : statboticsFallbackBaseUrl, fetchImpl);
      providers[source] = { ...next, fetchedAt: new Date().toISOString() };
      return providers[source];
    } catch (error) {
      providers[source] = { ...(previous || {}), status: "error", error: error.message, fetchedAt: new Date().toISOString() };
      return providers[source];
    }
  }
  async function poll({ force = false } = {}) {
    const now = fetchNow();
    for (const source of ["tba", "statbotics"]) {
      if (!force && now - (lastPollAt[source] || 0) < pollIntervalsMs[source]) continue;
      lastPollAt[source] = now;
      await pollProviderNow(source);
    }
    const comparable = Object.fromEntries(Object.entries(providers).map(([source, value]) => [source, { status: value.status, sourceUrl: value.sourceUrl, usedFallback: value.usedFallback, error: value.error, endpoints: Object.fromEntries(Object.entries(value.endpoints || {}).map(([name, endpoint]) => [name, { status: endpoint.status, sourceUrl: endpoint.sourceUrl, usedFallback: endpoint.usedFallback, error: endpoint.error, payload: endpoint.payload }])) }]));
    const nextFingerprint = fingerprint(comparable);
    if (nextFingerprint === latestFingerprint) return null;
    const record = store.saveCursor({ eventTag: eventTag(providerPayload(providers.tba), providerPayload(providers.statbotics)), providers: clone(providers) }, { latestFingerprint: nextFingerprint, lastPollAt });
    providers = record.providers;
    latestFingerprint = nextFingerprint;
    return record;
  }
  return { poll, pollProviderNow, status: () => ({ eventCode: store.normalizedEventCode, directory: store.directory, nextCursor: store.loadState().nextCursor, providers: clone(providers), lastPollAt: { ...lastPollAt } }) };
}

export function loadRecording(recordingPath) {
  const manifest = JSON.parse(fs.readFileSync(path.join(recordingPath, "manifest.json"), "utf8"));
  if (manifest.formatVersion !== 1 || !manifest.eventCode || !Number.isInteger(manifest.cursorCount) || manifest.cursorCount < 1) throw new Error("Recording manifest is invalid or empty.");
  const cursors = Array.from({ length: manifest.cursorCount }, (_, cursor) => JSON.parse(fs.readFileSync(path.join(recordingPath, "cursors", `${String(cursor).padStart(6, "0")}.json`), "utf8")));
  if (cursors.some((cursor, index) => cursor.cursor !== index)) throw new Error("Recording cursors are incomplete or out of order.");
  return { manifest, cursors };
}

export function createRecorderService({ events = [], recorderOptions = {}, intervalMs = 1000 } = {}) {
  const recorders = events.map((eventCode) => createRecorder({ ...recorderOptions, eventCode }));
  let timer = null;
  let running = false;
  async function poll() { for (const recorder of recorders) await recorder.poll(); return status(); }
  function start() {
    if (running) return status();
    running = true;
    timer = setInterval(() => poll().catch((error) => console.error(error)), intervalMs);
    return status();
  }
  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    running = false;
    return status();
  }
  function status() { return { running, events: recorders.map((recorder) => recorder.status()) }; }
  return { poll, start, stop, status };
}

export { eventTag, normalizeEventCode, providerPayload };
