import fs from "node:fs";
import path from "node:path";

const clone = (value) => JSON.parse(JSON.stringify(value));
const sourceNames = ["tba", "statbotics", "scouting"];

export function rewriteEventKeys(value, fromKey, toKey) {
  if (typeof value === "string") return value.split(fromKey).join(toKey);
  if (Array.isArray(value)) return value.map((item) => rewriteEventKeys(item, fromKey, toKey));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteEventKeys(item, fromKey, toKey)]));
  return value;
}

function loadFixture(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(root, "eventSimulator", relativePath), "utf8"));
}

function isCompleted(match) {
  return match && match.alliances?.red?.score != null && match.alliances?.blue?.score != null && match.alliances.red.score >= 0 && match.alliances.blue.score >= 0;
}

function unplayed(match) {
  const copy = clone(match);
  for (const alliance of ["red", "blue"]) {
    if (copy.alliances?.[alliance]) copy.alliances[alliance].score = -1;
    if (copy.score_breakdown) copy.score_breakdown[alliance] = null;
  }
  copy.winning_alliance = "";
  copy.actual_time = null;
  copy.post_result_time = null;
  return copy;
}

function matchOrder(matches) {
  return matches.filter(isCompleted).sort((a, b) => {
    const phase = (m) => m.comp_level === "qm" ? 0 : 1;
    return phase(a) - phase(b) || (a.comp_level === "qm" ? a.match_number - b.match_number : String(a.key).localeCompare(String(b.key)));
  });
}

function effectiveCursor(state, source) { return Math.max(-1, state.cursor + (state.offsets[source] || 0)); }

function buildTbaProjections(matches) {
  const stats = new Map();
  const ensure = (team) => { if (!stats.has(team)) stats.set(team, { team_key: team, played: 0, wins: 0, losses: 0, ties: 0, points: 0, opponents: 0 }); return stats.get(team); };
  for (const match of matches) {
    const red = match.alliances.red; const blue = match.alliances.blue;
    const winner = match.winning_alliance;
    for (const team of red.team_keys || []) { const s = ensure(team); s.played++; s.points += red.score; s.opponents += blue.score; if (winner === "red") s.wins++; else if (winner === "blue") s.losses++; else s.ties++; }
    for (const team of blue.team_keys || []) { const s = ensure(team); s.played++; s.points += blue.score; s.opponents += red.score; if (winner === "blue") s.wins++; else if (winner === "red") s.losses++; else s.ties++; }
  }
  const rows = [...stats.values()].map((s) => ({ team_key: s.team_key, rank: 0, record: { wins: s.wins, losses: s.losses, ties: s.ties }, qual_average: s.points / s.played, sort_orders: [s.wins + s.ties / 2, s.points / s.played], opr: s.points / s.played / 3, dpr: s.opponents / s.played / 3, ccwm: (s.points - s.opponents) / s.played / 3 }));
  rows.sort((a, b) => b.sort_orders[0] - a.sort_orders[0] || b.sort_orders[1] - a.sort_orders[1] || a.team_key.localeCompare(b.team_key));
  rows.forEach((row, index) => { row.rank = index + 1; });
  const statsPayload = { oprs: {}, dprs: {}, ccwms: {} };
  for (const row of rows) { statsPayload.oprs[row.team_key] = row.opr; statsPayload.dprs[row.team_key] = row.dpr; statsPayload.ccwms[row.team_key] = row.ccwm; }
  return { rankings: rows.map(({ opr, dpr, ccwm, ...ranking }) => ranking), stats: statsPayload };
}

function buildStatboticsRows(matches, eventKey) {
  const statMatches = matches.map((match) => ({ ...clone(match), key: rewriteEventKeys(match.key, "2026chcmp", eventKey), match_key: rewriteEventKeys(match.key, "2026chcmp", eventKey), event: eventKey }));
  const teamMatches = [];
  for (const match of statMatches) for (const alliance of ["red", "blue"]) for (const teamKey of match.alliances?.[alliance]?.team_keys || []) teamMatches.push({ match_key: match.match_key, event: eventKey, team: Number(String(teamKey).replace("frc", "")), alliance, result: match.winning_alliance === alliance ? "W" : match.winning_alliance ? "L" : "T", score: match.alliances[alliance].score });
  return { matches: statMatches, teamMatches };
}

export function createEngine({ root = path.resolve("."), scenarioPath = path.resolve("eventSimulator/scenario.json"), statePath = path.resolve("eventSimulator/.state.json") } = {}) {
  const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));
  const fixtures = Object.fromEntries(Object.entries(scenario.fixtures).map(([key, file]) => [key, loadFixture(root, file)]));
  const qualification = fixtures.tbaMatches.filter((match) => match.comp_level === "qm");
  const ordered = matchOrder(fixtures.tbaMatches);
  const defaults = clone(scenario.defaults);
  const loadState = () => {
    try { return { ...clone(defaults), ...JSON.parse(fs.readFileSync(statePath, "utf8")), offsets: { ...defaults.offsets, ...JSON.parse(fs.readFileSync(statePath, "utf8")).offsets }, latencyMs: { ...defaults.latencyMs, ...JSON.parse(fs.readFileSync(statePath, "utf8")).latencyMs }, failures: { ...defaults.failures, ...JSON.parse(fs.readFileSync(statePath, "utf8")).failures } }; } catch { return clone(defaults); }
  };
  let state = loadState();
  const requests = [];
  let requestGeneration = 0;
  const persist = () => { fs.mkdirSync(path.dirname(statePath), { recursive: true }); fs.writeFileSync(statePath, JSON.stringify(state, null, 2)); };
  const resetTimeline = () => { state.cursor = defaults.cursor; persist(); return getState(); };
  const resetConfig = () => { state = { ...clone(defaults), cursor: state.cursor }; persist(); return getState(); };
  const resetAll = () => { state = clone(defaults); requests.length = 0; requestGeneration++; persist(); return getState(); };
  const setState = (updates = {}) => {
    if (updates.cursor != null) state.cursor = Math.max(-1, Number(updates.cursor));
    if (updates.increment != null) state.increment = Math.max(1, Number(updates.increment));
    for (const source of sourceNames) {
      if (updates.offsets?.[source] != null) state.offsets[source] = Number(updates.offsets[source]);
      if (updates.latencyMs?.[source] != null) state.latencyMs[source] = Math.max(0, Number(updates.latencyMs[source]));
      if (updates.failures && source in updates.failures) state.failures[source] = updates.failures[source];
    }
    if (updates.delayScale != null) state.delayScale = Math.max(0, Number(updates.delayScale));
    if (updates.corrections) state.corrections = clone(updates.corrections);
    persist(); return getState();
  };
  const advance = (amount = state.increment) => { state.cursor += Math.max(1, Number(amount)); persist(); return getState(); };

  function payload(source) {
    const cursor = effectiveCursor(state, source);
    if (state.failures[source] === "failed" || state.failures[source] === "503") throw Object.assign(new Error("simulated source failure"), { statusCode: 503 });
    if (state.failures[source] === "empty") return source === "tba" ? [] : source === "scouting" ? { entries: [] } : [];
    if (source === "tba") {
      const event = rewriteEventKeys(fixtures.tbaEvent, scenario.sourceEventKey, scenario.id);
      const teams = rewriteEventKeys(fixtures.tbaTeams, scenario.sourceEventKey, scenario.id);
      if (cursor < 0) return { event, teams, matches: [], rankings: [], stats: { oprs: {}, dprs: {}, ccwms: {} } };
      const visible = new Set(ordered.slice(0, Math.max(0, cursor)));
      const matches = fixtures.tbaMatches.map((match) => visible.has(match) ? match : unplayed(match));
      const result = { event, teams, matches: rewriteEventKeys(matches, scenario.sourceEventKey, scenario.id) };
      const projections = buildTbaProjections(ordered.slice(0, Math.max(0, cursor)));
      result.rankings = rewriteEventKeys(projections.rankings, scenario.sourceEventKey, scenario.id);
      result.stats = rewriteEventKeys(projections.stats, scenario.sourceEventKey, scenario.id);
      return applyCorrections(source, result, cursor);
    }
    if (source === "statbotics") {
      const visible = ordered.slice(0, Math.max(0, cursor));
      const statboticsRows = buildStatboticsRows(visible, scenario.id);
      const event = { ...rewriteEventKeys(fixtures.statboticsEvent, scenario.sourceEventKey, scenario.id), current_match: visible.length, status: visible.length >= ordered.length ? "Completed" : visible.length ? "In Progress" : "Scheduled" };
      const teamEvents = rewriteEventKeys(fixtures.statboticsTeamEvents, scenario.sourceEventKey, scenario.id);
      return applyCorrections(source, { event, teamEvents, matches: statboticsRows.matches, teamMatches: statboticsRows.teamMatches }, cursor);
    }
    const entries = fixtures.scouting.entries || fixtures.scouting.rows || [];
    const visible = entries.filter((entry) => {
      const match = Number(entry.matchNumber ?? entry.match_number);
      const ordinal = qualification.findIndex((item) => item.match_number === match) + 1;
      return ordinal > 0 && ordinal <= cursor;
    });
    return applyCorrections(source, rewriteEventKeys({ ...fixtures.scouting, meta: { ...fixtures.scouting.meta, eventKey: scenario.id }, entries: visible }, scenario.sourceEventKey, scenario.id), cursor);
  }
  function applyCorrections(source, value, cursor) {
    for (const correction of state.corrections || []) {
      if (correction.source && correction.source !== source) continue;
      if (Number(correction.cursor ?? 0) > cursor || !correction.path) continue;
      const target = correction.path.split("."); let node = value;
      for (const key of target.slice(0, -1)) { if (node == null) break; node = node[key]; }
      if (node != null) node[target.at(-1)] = clone(correction.value);
    }
    if (state.failures[source] === "malformed") return { malformed: true };
    return value;
  }
  function get(source, kind) {
    const data = payload(source);
    if (source === "tba") return kind === "event" ? data.event : kind === "teams" ? data.teams : kind === "matches" ? data.matches : kind === "rankings" ? { rankings: data.rankings } : data.stats;
    if (source === "statbotics") return kind === "event" ? data.event : kind === "team-events" ? data.teamEvents : kind === "team-matches" ? data.teamMatches : data.matches;
    return data;
  }
  const recordRequest = (request, generation = requestGeneration) => {
    if (generation !== requestGeneration) return;
    const signature = request.dataSignature || `${request.source}/${request.kind}/${request.cursor}`;
    const existingIndex = requests.findIndex((item) => item.signature === signature);
    if (existingIndex >= 0) {
      const existing = requests.splice(existingIndex, 1)[0];
      requests.unshift({ ...existing, at: request.at, repeatCount: (existing.repeatCount || 1) + 1 });
    } else {
      requests.unshift({ ...request, signature, repeatCount: 1 });
      requests.splice(50);
    }
  };
  const getState = () => ({ scenario: scenario.id, cursor: state.cursor, phase: state.cursor < 0 ? "team-only" : state.cursor === 0 ? "scheduled" : "results", increment: state.increment, offsets: clone(state.offsets), latencyMs: clone(state.latencyMs), delayScale: state.delayScale, failures: clone(state.failures), corrections: clone(state.corrections), totalSequence: ordered.length, requests: requests.map(({ signature, dataSignature, ...request }) => request) });
  return { scenario, fixtures, defaults, getState, setState, advance, resetTimeline, resetConfig, resetAll, get, effectiveCursor: (source) => effectiveCursor(state, source), requestGeneration: () => requestGeneration, recordRequest, responseDelay: (source) => (state.latencyMs[source] || 0) * state.delayScale };
}
