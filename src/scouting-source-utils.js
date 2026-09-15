function normalizeSourceUrl(value) {
  return String(value || "").trim();
}

function sourceBasename(value) {
  const normalized = normalizeSourceUrl(value).split(/[?#]/)[0];
  if (!normalized) return "";
  const decoded = normalized.replace(/^file:\/\/\//i, "").replace(/\\/g, "/").split("/").pop() || "";
  try {
    return decodeURIComponent(decoded);
  } catch {
    return decoded;
  }
}

function googleSheetInfo(url) {
  const match = String(url || "").match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;
  const id = match[1];
  let gid = "0";
  const gidMatch = String(url).match(/[?#&]gid=([0-9]+)/);
  if (gidMatch) gid = gidMatch[1];
  return {
    id,
    gid,
    csvUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`,
  };
}

function sourceUrlMatchesEventSheet(url, eventModel = {}) {
  const normalized = normalizeSourceUrl(url);
  if (!normalized) return false;
  const eventInfo = googleSheetInfo(eventModel?.sheet?.url || eventModel?.sheet?.csvUrl || "");
  const inputInfo = googleSheetInfo(normalized);
  if (eventModel?.sheet?.url === normalized || eventModel?.sheet?.csvUrl === normalized) return true;
  return Boolean(eventInfo && inputInfo && eventInfo.id === inputInfo.id);
}

function shouldFallbackToEventSheetSample(url, eventModel = {}) {
  return Boolean(eventModel?.sheet?.sampleCsvText && sourceUrlMatchesEventSheet(url, eventModel));
}

function inferProfileIdFromAttachmentSource(source, options = {}) {
  const filename = sourceBasename(source).toLowerCase();
  const normalizedFormat = normalizeSourceUrl(options.format).toLowerCase();
  if (!filename) return normalizedFormat === "scouting-json" ? "canonical-json-v1" : "";
  if (normalizedFormat === "scouting-json" || /\.(entries|schema)\.json$/i.test(filename) || /\.json$/i.test(filename)) {
    return "canonical-json-v1";
  }
  if (/(^|[^a-z])legacy([^a-z]|$)|match[-_. ]?v1/i.test(filename)) {
    return "match-legacy-v1";
  }
  if (/(^|[^a-z])current([^a-z]|$)|match[-_. ]?v2|teamcalculations|scouting analysis/i.test(filename)) {
    return "match-current-v2";
  }
  return "";
}

function duplicateSubmissionKey(submission) {
  const eventKey = String(submission?.eventKey || "").trim();
  const matchNumber = Number(submission?.matchNumber);
  const teamNumber = Number(submission?.teamNumber);
  const teamIdentity = submission?.teamKey
    ? String(submission.teamKey).trim().toLowerCase()
    : (Number.isFinite(teamNumber) ? String(teamNumber) : "");
  return `${eventKey}:${Number.isFinite(matchNumber) ? matchNumber : ""}:${teamIdentity}`;
}

function assessDuplicateSubmissions(existingSubmissions, incomingSubmissions) {
  const grouped = new Map();
  [...(existingSubmissions || []), ...(incomingSubmissions || [])].forEach((submission) => {
    const key = duplicateSubmissionKey(submission);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(submission);
  });

  const impactedTeams = new Set();
  const duplicateGroups = [];

  (incomingSubmissions || []).forEach((submission) => {
    const key = duplicateSubmissionKey(submission);
    const group = grouped.get(key) || [];
    if (group.length <= 1) return;
    submission.validity = "flagged";
    submission.confidenceTier = "low";
    if (!Array.isArray(submission.confidenceReasons)) submission.confidenceReasons = [];
    if (!submission.confidenceReasons.includes("duplicate_submission")) {
      submission.confidenceReasons.push("duplicate_submission");
    }
    impactedTeams.add(Number(submission.teamNumber));
    if (!duplicateGroups.some((candidate) => candidate.key === key)) {
      duplicateGroups.push({
        key,
        eventKey: String(submission.eventKey || "").trim(),
        matchNumber: Number(submission.matchNumber),
        teamNumber: Number(submission.teamNumber),
        submissionIds: group.map((entry) => entry?.id).filter(Boolean),
        count: group.length,
      });
    }
  });

  return {
    impactedTeams: [...impactedTeams].filter(Number.isFinite),
    duplicateGroups,
  };
}

globalThis.ScoutingSourceUtils = {
  normalizeSourceUrl,
  sourceBasename,
  googleSheetInfo,
  sourceUrlMatchesEventSheet,
  shouldFallbackToEventSheetSample,
  inferProfileIdFromAttachmentSource,
  duplicateSubmissionKey,
  assessDuplicateSubmissions,
};
