import fs from "node:fs";
import path from "node:path";

const fixtureDir = path.resolve("tests/fixtures/prior-ridge");
const blairVectorUrl = "https://raw.githubusercontent.com/blair-robot-project/scouting2026/main/prior_ridge/data/epa_pridge_mse.csv";
const blairPriorsUrl = "https://raw.githubusercontent.com/blair-robot-project/scouting2026/main/prior_ridge/data/all_epas_for_all_teams.csv";
const blairScoresUrl = "https://raw.githubusercontent.com/blair-robot-project/scouting2026/main/prior_ridge/data/real_scores.csv";

const eventKeys = ["2024mdsev", "2024txfor", "2025mdsev"];

async function fetchText(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

function parseCsv(text) {
  const rows = [];
  let index = 0;
  let row = [];
  let value = "";
  let inQuotes = false;

  while (index < text.length) {
    const character = text[index];
    if (inQuotes) {
      if (character === "\"") {
        if (text[index + 1] === "\"") {
          value += "\"";
          index += 2;
          continue;
        }
        inQuotes = false;
        index += 1;
        continue;
      }
      value += character;
      index += 1;
      continue;
    }

    if (character === "\"") {
      inQuotes = true;
      index += 1;
      continue;
    }
    if (character === ",") {
      row.push(value);
      value = "";
      index += 1;
      continue;
    }
    if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      index += 1;
      continue;
    }
    if (character === "\r") {
      index += 1;
      continue;
    }
    value += character;
    index += 1;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter((candidate) => candidate.length && candidate.some((value) => value.length)).map((values) => {
    const record = {};
    headers.forEach((header, headerIndex) => {
      record[header || `column_${headerIndex}`] = values[headerIndex] || "";
    });
    return record;
  });
}

function writeJson(relativePath, value) {
  const filePath = path.join(fixtureDir, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function buildTeamEvents(eventRows) {
  const earliestByTeam = new Map();
  for (const row of eventRows) {
    const teamNumber = Number(row.team);
    const startEpa = Number(row.pre_epa);
    const time = Number(row.time);
    if (!Number.isFinite(teamNumber) || !Number.isFinite(startEpa) || !Number.isFinite(time)) continue;
    const previous = earliestByTeam.get(teamNumber);
    if (!previous || time < previous.time) {
      earliestByTeam.set(teamNumber, { time, startEpa });
    }
  }
  return Array.from(earliestByTeam.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([team, entry]) => ({
      team,
      epa: {
        stats: {
          start: entry.startEpa,
        },
      },
    }));
}

function buildMatches(eventKey, eventRows, scoreRows) {
  const teamsByMatchAlliance = new Map();
  for (const row of eventRows) {
    const match = Number(row.match);
    const alliance = String(row.alliance || "").trim().toLowerCase();
    const team = Number(row.team);
    if (!Number.isFinite(match) || !Number.isFinite(team) || (alliance !== "blue" && alliance !== "red")) continue;
    const mapKey = `${match}:${alliance}`;
    const teams = teamsByMatchAlliance.get(mapKey) || new Set();
    teams.add(team);
    teamsByMatchAlliance.set(mapKey, teams);
  }

  const scoresByMatch = new Map();
  for (const row of scoreRows) {
    const match = Number(row.match);
    const allianceKey = String(row.alliance || "").trim().toLowerCase();
    const score = Number(row.scores);
    if (!Number.isFinite(match) || !Number.isFinite(score)) continue;
    const entry = scoresByMatch.get(match) || {};
    if (allianceKey === "blue_score") entry.blue = score;
    if (allianceKey === "red_score") entry.red = score;
    scoresByMatch.set(match, entry);
  }

  return Array.from(scoresByMatch.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([match, scoreEntry]) => {
      const blueTeams = Array.from(teamsByMatchAlliance.get(`${match}:blue`) || []).sort((left, right) => left - right);
      const redTeams = Array.from(teamsByMatchAlliance.get(`${match}:red`) || []).sort((left, right) => left - right);
      if (blueTeams.length !== 3 || redTeams.length !== 3) {
        throw new Error(`Expected three teams per alliance for ${eventKey} match ${match}`);
      }
      if (!Number.isFinite(scoreEntry.blue) || !Number.isFinite(scoreEntry.red)) {
        throw new Error(`Missing Blair scores for ${eventKey} match ${match}`);
      }
      return {
        key: `${eventKey}_qm${match}`,
        comp_level: "qm",
        alliances: {
          blue: {
            team_keys: blueTeams.map((team) => `frc${team}`),
            score: scoreEntry.blue,
          },
          red: {
            team_keys: redTeams.map((team) => `frc${team}`),
            score: scoreEntry.red,
          },
        },
      };
    });
}

async function main() {
  fs.mkdirSync(fixtureDir, { recursive: true });
  const [vectorCsvText, priorCsvText, scoreCsvText] = await Promise.all([
    fetchText(blairVectorUrl),
    fetchText(blairPriorsUrl),
    fetchText(blairScoresUrl),
  ]);
  const vectorRows = parseCsv(vectorCsvText);
  const priorRows = parseCsv(priorCsvText);
  const scoreRows = parseCsv(scoreCsvText);
  const manifest = [];

  for (const eventKey of eventKeys) {
    const vector = vectorRows.find((row) => row.event === eventKey);
    if (!vector) {
      throw new Error(`Missing Blair vector row for ${eventKey}`);
    }

    const eventPriorRows = priorRows.filter((row) => row.event === eventKey);
    if (!eventPriorRows.length) {
      throw new Error(`Missing Blair prior rows for ${eventKey}`);
    }
    const eventScoreRows = scoreRows.filter((row) => row.event === eventKey);
    if (!eventScoreRows.length) {
      throw new Error(`Missing Blair score rows for ${eventKey}`);
    }

    const matches = buildMatches(eventKey, eventPriorRows, eventScoreRows);
    const teamEvents = buildTeamEvents(eventPriorRows);

    writeJson(`${eventKey}-tba-matches.json`, matches);
    writeJson(`${eventKey}-team-events.json`, teamEvents);
    manifest.push({
      eventKey,
      expectedLambda: Number(vector.lambda_opt),
      expectedMse: Number(vector.pridge_mse),
    });
    console.log(`Wrote Blair pRidge fixtures for ${eventKey}: ${teamEvents.length} team priors, ${matches.length} matches.`);
  }

  writeJson("blair-vectors.json", manifest);
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
