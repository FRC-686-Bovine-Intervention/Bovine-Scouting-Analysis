import fs from "node:fs";
import path from "node:path";
import { realEventSourceConfig } from "./real-event-snapshot-config.mjs";
import { writeRealEventSnapshots } from "./real-event-snapshot-builder.mjs";

const cacheDir = path.resolve("src/real-source-cache");
const defaultStatboticsBaseUrl = "https://api.statbotics.io/v3";

function requireEnv(name) {
  const value = String(process.env[name] || "").trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optionalEnv(name) {
  return String(process.env[name] || "").trim();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const error = new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.url = url;
    throw error;
  }
  return response.json();
}

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function writeCacheFile(eventKey, suffix, content) {
  const filePath = path.join(cacheDir, `${eventKey}-${suffix}`);
  fs.writeFileSync(filePath, content, "utf8");
  return filePath;
}

function readCachedJson(eventKey, suffix, fallback) {
  const filePath = path.join(cacheDir, `${eventKey}-${suffix}`);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function fetchJsonWithCacheFallback(url, eventKey, suffix, fallback) {
  try {
    return await fetchJson(url);
  } catch (error) {
    if (error?.status !== 404) throw error;
    console.warn(`  ${url} returned 404; keeping cached ${suffix}.`);
    return readCachedJson(eventKey, suffix, fallback);
  }
}

async function fetchStatboticsTeamEventsWithCacheFallback(statboticsBaseUrl, eventKey) {
  const legacyUrl = `${statboticsBaseUrl}/team_events/event/${eventKey}`;
  try {
    return await fetchJson(legacyUrl);
  } catch (error) {
    if (error?.status !== 404) throw error;
    const queryUrl = `${statboticsBaseUrl}/team_events?event=${encodeURIComponent(eventKey)}`;
    try {
      return await fetchJson(queryUrl);
    } catch (queryError) {
      if (queryError?.status !== 404) throw queryError;
      console.warn(`  ${legacyUrl} and ${queryUrl} returned 404; keeping cached statbotics-team-events.json.`);
      return readCachedJson(eventKey, "statbotics-team-events.json", []);
    }
  }
}

async function syncEvent(eventConfig, headers, statboticsBaseUrl) {
  const key = eventConfig.key;
  console.log(`Syncing ${key}...`);

  const [tbaEvent, tbaTeams, tbaMatches, statboticsEvent, statboticsTeamEvents, sheetText] = await Promise.all([
    fetchJson(`https://www.thebluealliance.com/api/v3/event/${key}`, { headers }),
    fetchJson(`https://www.thebluealliance.com/api/v3/event/${key}/teams`, { headers }),
    fetchJson(`https://www.thebluealliance.com/api/v3/event/${key}/matches`, { headers }),
    fetchJsonWithCacheFallback(`${statboticsBaseUrl}/event/${key}`, key, "statbotics-event.json", {}),
    fetchStatboticsTeamEventsWithCacheFallback(statboticsBaseUrl, key),
    eventConfig.sheet?.csvUrl ? fetchText(eventConfig.sheet.csvUrl) : Promise.resolve(""),
  ]);

  writeCacheFile(key, "tba-event.json", `${JSON.stringify(tbaEvent, null, 2)}\n`);
  writeCacheFile(key, "tba-teams.json", `${JSON.stringify(tbaTeams, null, 2)}\n`);
  writeCacheFile(key, "tba-matches.json", `${JSON.stringify(tbaMatches, null, 2)}\n`);
  writeCacheFile(key, "statbotics-event.json", `${JSON.stringify(statboticsEvent, null, 2)}\n`);
  writeCacheFile(key, "statbotics-team-events.json", `${JSON.stringify(statboticsTeamEvents, null, 2)}\n`);
  if (eventConfig.sheet) writeCacheFile(key, "sheet.csv", sheetText);

  const qualificationMatches = Array.isArray(tbaMatches) ? tbaMatches.filter((match) => match?.comp_level === "qm") : [];
  const qualificationBreakdowns = qualificationMatches.filter((match) => match?.score_breakdown).length;
  console.log(`  Cached ${qualificationMatches.length} qualification match(es); ${qualificationBreakdowns} include score_breakdown.`);
}

async function main() {
  fs.mkdirSync(cacheDir, { recursive: true });
  const tbaAuthKey = requireEnv("TBA_AUTH_KEY");
  const statboticsBaseUrl = optionalEnv("STATBOTICS_BASE_URL") || defaultStatboticsBaseUrl;
  const headers = {
    "X-TBA-Auth-Key": tbaAuthKey,
    Accept: "application/json",
  };

  for (const eventConfig of realEventSourceConfig) {
    await syncEvent(eventConfig, headers, statboticsBaseUrl);
  }

  const { outputPath } = writeRealEventSnapshots(realEventSourceConfig);
  console.log(`Wrote refreshed snapshot bundle to ${outputPath}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
