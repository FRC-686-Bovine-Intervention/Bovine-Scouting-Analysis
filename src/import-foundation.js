(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const templateProfileSpecs = [
  {
    id: "match-current-v2",
    label: "Current Match Template",
    schemaVersion: "match-v2",
    kind: "current",
  },
  {
    id: "match-legacy-v1",
    label: "Legacy Match Template",
    schemaVersion: "match-v1",
    kind: "legacy",
  },
];

const requiredMetadataKeys = ["season", "eventKey", "schemaVersion", "templateProfileId"];
const requiredIdentityFields = ["matchNumber", "teamNumber", "scoutUser", "alliance", "station"];
const headerSynonymGroups = {
  matchnumber: ["match", "matchnum", "qualificationmatch"],
  teamnumber: ["team", "team#", "teamnum", "team_no", "teamno"],
  scoutuser: ["scout", "scouter", "scoutname", "observer"],
  alliance: ["alliancecolor", "color"],
  station: ["driverstation", "stationcolor", "ds"],
  defenseplayed: ["playeddefense", "defense", "wasdefense"],
  robotstatus: ["robotstate", "status", "robotcondition"],
  notes: ["comments", "comment", "note"],
};

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value.length || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows.map((cells) => cells.map((cell) => cell.trim()));
}

function normalizeToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

function synonymMap(extraEntries = {}) {
  const map = new Map();
  Object.entries(headerSynonymGroups).forEach(([canonical, aliases]) => {
    map.set(canonical, canonical);
    aliases.forEach((alias) => map.set(normalizeToken(alias), canonical));
  });
  Object.entries(extraEntries).forEach(([canonical, aliases]) => {
    map.set(normalizeToken(canonical), normalizeToken(canonical));
    aliases.forEach((alias) => map.set(normalizeToken(alias), normalizeToken(canonical)));
  });
  return map;
}

function normalizeHeader(value, map) {
  const token = normalizeToken(value);
  return map.get(token) || token;
}

function componentFieldId(component) {
  return normalizeToken((seasonFramework.metricFieldId || ((metricDefinition) => metricDefinition.id))(component));
}

function scouterMetricDefinitions(eventModel) {
  return (seasonFramework.scouterMetricDefinitions || ((model) => model?.scoringComponents || []))(eventModel);
}

function formulaFieldDefinitions(eventModel) {
  return (seasonFramework.formulaFieldDefinitions || seasonFramework.scouterMetricDefinitions || ((model) => model?.scoringComponents || []))(eventModel);
}

function csvHeaderForMetric(component) {
  return (seasonFramework.csvHeaderForMetric || ((metricDefinition) => (metricDefinition.unit === "pts" ? `${metricDefinition.id}Pts` : metricDefinition.id)))(component);
}

function currentHeaderLabels(eventModel) {
  return [
    "matchNumber",
    "teamNumber",
    "scoutUser",
    "alliance",
    "station",
    "defensePlayed",
    "robotStatus",
    "notes",
    ...formulaFieldDefinitions(eventModel).map((component) => csvHeaderForMetric(component)),
  ];
}

function legacyHeaderLabels(eventModel) {
  return [
    "match",
    "team #",
    "scouter",
    "alliance color",
    "driver station",
    "played defense",
    "robot state",
    "comments",
    ...formulaFieldDefinitions(eventModel).map((component) => component.label),
  ];
}

function buildProfiles(eventModel) {
  const componentSynonyms = Object.fromEntries(
    formulaFieldDefinitions(eventModel).map((component) => [
      componentFieldId(component),
      [component.id, csvHeaderForMetric(component), `${component.label} pts`, `${component.label} score`, component.label, ...(component.aliases || [])],
    ]),
  );
  const synonyms = synonymMap(componentSynonyms);
  return templateProfileSpecs.map((spec) => {
    const headers = spec.kind === "current" ? currentHeaderLabels(eventModel) : legacyHeaderLabels(eventModel);
    const expectedHeaders = headers.map((header) => normalizeHeader(header, synonyms));
    return {
      ...spec,
      expectedHeaders,
      synonyms,
      headers,
    };
  });
}

function readMetadata(rows) {
  if (rows.length < 2) return { metadata: {}, headerIndex: 0, hasMetadataBlock: false };
  if (normalizeToken(rows[0][0]) !== "meta" || normalizeToken(rows[1][0]) !== "value") {
    return { metadata: {}, headerIndex: 0, hasMetadataBlock: false };
  }
  const keys = rows[0].slice(1);
  const values = rows[1].slice(1);
  const metadata = {};
  keys.forEach((key, index) => {
    metadata[key] = values[index] || "";
  });
  let headerIndex = 2;
  while (headerIndex < rows.length && rows[headerIndex].every((cell) => !cell)) headerIndex += 1;
  return { metadata, headerIndex, hasMetadataBlock: true };
}

function detectProfile(headers, profiles) {
  const candidates = profiles
    .map((profile) => {
      const matched = profile.expectedHeaders.filter((header) => headers.includes(header)).length;
      const score = matched / Math.max(profile.expectedHeaders.length, headers.length || 1);
      return { profile, score, matched };
    })
    .sort((left, right) => right.score - left.score || right.matched - left.matched);

  const best = candidates[0];
  const second = candidates[1];
  if (!best || best.score < 0.6) return { status: "unknown", candidates };
  if (second && Math.abs(best.score - second.score) < 0.05) return { status: "ambiguous", candidates: candidates.slice(0, 2) };
  return { status: "matched", profile: best.profile, candidates };
}

function toBoolean(value) {
  const normalized = normalizeToken(value);
  return ["yes", "true", "1", "y"].includes(normalized);
}

function toNumber(value) {
  if (value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function parseImportedMetricValue(value) {
  if (value === "") return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return value;
}

function importedValueType(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number") return "number";
  return "string";
}

function dominantTypeWarnings(parsedRows, fieldDefinitions) {
  const warnings = [];
  (fieldDefinitions || []).forEach((fieldDefinition) => {
    const samples = parsedRows
      .map((row) => ({ rowNumber: row.rowNumber, value: row.rawMetrics?.[fieldDefinition.id] }))
      .filter((entry) => entry.value !== null && entry.value !== undefined);
    if (!samples.length) return;
    const counts = samples.reduce((map, entry) => {
      const type = importedValueType(entry.value);
      map.set(type, (map.get(type) || 0) + 1);
      return map;
    }, new Map());
    const dominantEntry = [...counts.entries()].sort((left, right) => right[1] - left[1])[0];
    if (!dominantEntry) return;
    const [dominantType, dominantCount] = dominantEntry;
    if (dominantCount / samples.length < 0.9) return;
    samples
      .filter((entry) => importedValueType(entry.value) !== dominantType)
      .forEach((entry) => {
        warnings.push(`Row ${entry.rowNumber} has ${fieldDefinition.label} as ${importedValueType(entry.value)} but most of that column is ${dominantType}.`);
      });
  });
  return warnings;
}

function buildHeaderIndex(headers) {
  const index = new Map();
  headers.forEach((header, position) => {
    if (!index.has(header)) index.set(header, position);
  });
  return index;
}

function profileById(profileId, profiles) {
  return profiles.find((profile) => profile.id === profileId) || null;
}

function expectedTemplateMetadata(eventModel, profile) {
  return {
    season: String(eventModel.season),
    eventKey: eventModel.key,
    schemaVersion: profile.schemaVersion,
    templateProfileId: profile.id,
  };
}

function validateMetadata(metadata, eventModel, profile, activeEventKey) {
  const warnings = [];
  const errors = [];
  const expected = expectedTemplateMetadata(eventModel, profile);

  requiredMetadataKeys.forEach((key) => {
    if (!metadata[key]) warnings.push(`Missing metadata field: ${key}`);
  });

  if (metadata.season && String(metadata.season) !== String(eventModel.season)) {
    errors.push(`Metadata season ${metadata.season} does not match active season ${eventModel.season}.`);
  }
  if (metadata.schemaVersion && metadata.schemaVersion !== expected.schemaVersion) {
    errors.push(`Metadata schema version ${metadata.schemaVersion} does not match profile ${profile.schemaVersion}.`);
  }
  if (metadata.templateProfileId && metadata.templateProfileId !== profile.id) {
    errors.push(`Metadata template profile ${metadata.templateProfileId} does not match detected profile ${profile.id}.`);
  }
  if (metadata.eventKey && metadata.eventKey !== activeEventKey) {
    errors.push(`Metadata event key ${metadata.eventKey} does not match active event ${activeEventKey}.`);
  }

  return { warnings, errors, suggestedEventKey: metadata.eventKey || null };
}

function parseRows(rows, headers, profile, eventModel, metadata) {
  const index = buildHeaderIndex(headers);
  const warnings = [];
  const parsedRows = [];
  const metricHeaders = formulaFieldDefinitions(eventModel).map((fieldDefinition) => ({
    fieldDefinition,
    normalizedHeader: normalizeHeader(profile.kind === "current" ? csvHeaderForMetric(fieldDefinition) : fieldDefinition.label, profile.synonyms),
  }));

  rows.forEach((row, rowOffset) => {
    if (row.every((cell) => !cell)) return;
    const rowNumber = rowOffset + 1;
    const baseRecord = {
      id: createId("submission"),
      season: Number(metadata.season || eventModel.season),
      eventKey: metadata.eventKey || eventModel.key,
      schemaVersion: metadata.schemaVersion || profile.schemaVersion,
      templateProfileId: metadata.templateProfileId || profile.id,
      sourceType: "team-scouting",
      matchNumber: toNumber(row[index.get("matchnumber")]),
      teamNumber: toNumber(row[index.get("teamnumber")]),
      scoutUser: row[index.get("scoutuser")] || "",
      alliance: row[index.get("alliance")] || "",
      station: row[index.get("station")] || "",
      defensePlayed: toBoolean(row[index.get("defenseplayed")]),
      robotStatus: row[index.get("robotstatus")] || "",
      notes: row[index.get("notes")] || "",
      rawMetrics: {},
      validity: "valid",
      confidenceTier: "high",
      confidenceReasons: [],
      rowNumber,
    };

    metricHeaders.forEach(({ fieldDefinition, normalizedHeader }) => {
      const cellIndex = index.get(normalizedHeader);
      if (cellIndex === undefined) {
        warnings.push(`Missing mapped column for ${fieldDefinition.label} in row ${rowNumber}.`);
        return;
      }
      const parsedValue = parseImportedMetricValue(row[cellIndex]);
      baseRecord.rawMetrics[fieldDefinition.id] = parsedValue;
      if (parsedValue === null && fieldDefinition.optional !== true) baseRecord.confidenceReasons.push("missing_metric");
    });

    const missingIdentity = requiredIdentityFields.filter((field) => {
      if (field === "matchNumber") return !baseRecord.matchNumber;
      if (field === "teamNumber") return !baseRecord.teamNumber;
      return !baseRecord[field];
    });
    if (missingIdentity.length) {
      baseRecord.validity = "excluded";
      baseRecord.confidenceTier = "low";
      baseRecord.confidenceReasons.push("schema_gap");
      warnings.push(`Row ${rowNumber} is missing required identity fields: ${missingIdentity.join(", ")}.`);
    } else if (baseRecord.confidenceReasons.length) {
      baseRecord.validity = "flagged";
      baseRecord.confidenceTier = "medium";
    }

    parsedRows.push(baseRecord);
  });

  warnings.push(...dominantTypeWarnings(parsedRows, formulaFieldDefinitions(eventModel)));
  return { parsedRows, warnings };
}

function duplicateKey(submission) {
  return `${submission.eventKey}:${submission.matchNumber}:${submission.teamNumber}`;
}

function applyDuplicateFlags(existingSubmissions, incomingSubmissions) {
  const grouped = new Map();
  [...existingSubmissions, ...incomingSubmissions].forEach((submission) => {
    const key = duplicateKey(submission);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(submission);
  });

  const impactedTeams = new Set();
  const duplicateGroups = [];

  incomingSubmissions.forEach((submission) => {
    const group = grouped.get(duplicateKey(submission)) || [];
    if (group.length > 1) {
      submission.validity = "flagged";
      submission.confidenceTier = "low";
      if (!submission.confidenceReasons.includes("duplicate_submission")) {
        submission.confidenceReasons.push("duplicate_submission");
      }
      impactedTeams.add(submission.teamNumber);
      duplicateGroups.push(duplicateKey(submission));
    }
  });

  return {
    impactedTeams: [...impactedTeams],
    duplicateGroups: [...new Set(duplicateGroups)],
  };
}

function validateSeasonPackage(eventModel) {
  const missing = [];
  if (!eventModel?.season) missing.push("season");
  if (!eventModel?.seasonLabel) missing.push("seasonLabel");
  if (!Array.isArray(eventModel?.metrics) || !eventModel.metrics.length) missing.push("metrics");
  if (!Array.isArray(scouterMetricDefinitions(eventModel)) || !scouterMetricDefinitions(eventModel).length) missing.push("scouterMetricDefinitions");
  if (!Array.isArray(eventModel?.criteriaSources) || !eventModel.criteriaSources.length) missing.push("criteriaSources");
  return {
    valid: missing.length === 0,
    missing,
  };
}

function buildSampleCsv(eventModel, profileId) {
  const profiles = buildProfiles(eventModel);
  const profile = profileById(profileId, profiles) || profiles[0];
  const metadata = expectedTemplateMetadata(eventModel, profile);
  const metaRow = ["meta", "season", "eventKey", "schemaVersion", "templateProfileId"];
  const valueRow = ["value", metadata.season, metadata.eventKey, metadata.schemaVersion, metadata.templateProfileId];
  const headerRow = profile.headers;
  const teams = eventModel.teams.slice(0, 4);
  const rows = teams.map((team, index) => {
    const matchNumber = eventModel.matches[index]?.number || index + 1;
    const baseCells = profile.kind === "current"
      ? [matchNumber, team.number, `Scout ${index + 1}`, index % 2 === 0 ? "red" : "blue", index + 1, index === 1 ? "yes" : "no", "ok", `Imported sample row ${index + 1}`]
      : [matchNumber, team.number, `Scout ${index + 1}`, index % 2 === 0 ? "red" : "blue", index + 1, index === 1 ? "yes" : "no", "ok", `Legacy sample row ${index + 1}`];
    const componentCells = formulaFieldDefinitions(eventModel).map((component) => team.sources.scouter.components[component.id] ?? "");
    return [...baseCells, ...componentCells];
  });
  return [metaRow, valueRow, [], headerRow, ...rows]
    .map((row) => row.map((cell) => (String(cell).includes(",") ? `"${String(cell).replaceAll('"', '""')}"` : String(cell))).join(","))
    .join("\n");
}

function previewScoutingImport({ csvText, eventModel, activeEventKey, existingSubmissions = [], templateProfileId = "" }) {
  const seasonCheck = validateSeasonPackage(eventModel);
  if (!seasonCheck.valid) {
    return {
      ok: false,
      errors: [`Season package is incomplete: ${seasonCheck.missing.join(", ")}.`],
      warnings: [],
      summary: null,
    };
  }

  const rows = parseCsv(csvText || "");
  if (!rows.length) {
    return {
      ok: false,
      errors: ["No CSV content was provided."],
      warnings: [],
      summary: null,
    };
  }

  const profiles = buildProfiles(eventModel);
  const metadataRead = readMetadata(rows);
  const headerRow = rows[metadataRead.headerIndex];
  if (!headerRow) {
    return {
      ok: false,
      errors: ["The file does not contain a header row."],
      warnings: [],
      summary: null,
    };
  }

  const normalizedHeaders = headerRow.map((header) => normalizeHeader(header, synonymMap(Object.fromEntries(
    formulaFieldDefinitions(eventModel).map((component) => [componentFieldId(component), [component.id, csvHeaderForMetric(component), `${component.label} pts`, `${component.label} score`, component.label, ...(component.aliases || [])]]),
  ))));

  let profile = null;
  const warnings = [];
  const errors = [];
  const detection = detectProfile(normalizedHeaders, profiles);

  const requestedProfileId = templateProfileId || metadataRead.metadata.templateProfileId || "";
  if (requestedProfileId) {
    profile = profileById(requestedProfileId, profiles);
    if (!profile) {
      errors.push(`Unknown template profile id: ${requestedProfileId}.`);
    }
  } else if (detection.status === "matched") {
    profile = detection.profile;
    warnings.push("Metadata block missing; used header auto-detection.");
  } else if (detection.status === "ambiguous") {
    return {
      ok: false,
      errors: ["Importer profile detection is ambiguous. Admin must choose a profile."],
      warnings: detection.candidates.map((candidate) => `Possible match: ${candidate.profile.label}`),
      summary: null,
      ambiguousProfiles: detection.candidates.map((candidate) => ({ id: candidate.profile.id, label: candidate.profile.label })),
    };
  } else {
    return {
      ok: false,
      errors: ["No importer profile matched the CSV headers."],
      warnings: [],
      summary: null,
    };
  }

  const metadataValidation = validateMetadata(metadataRead.metadata, eventModel, profile, activeEventKey);
  warnings.push(...metadataValidation.warnings);
  if (metadataValidation.errors.length) {
    return {
      ok: false,
      errors: metadataValidation.errors,
      warnings,
      summary: null,
      suggestedEventKey: metadataValidation.suggestedEventKey,
      canSwitchContext: Boolean(metadataValidation.suggestedEventKey && metadataValidation.suggestedEventKey !== activeEventKey),
    };
  }

  const dataRows = rows.slice(metadataRead.headerIndex + 1);
  const parsed = parseRows(dataRows, normalizedHeaders, profile, eventModel, metadataRead.metadata);
  warnings.push(...parsed.warnings);
  const duplicateAssessment = applyDuplicateFlags(existingSubmissions, parsed.parsedRows);
  const flaggedRows = parsed.parsedRows.filter((submission) => submission.validity === "flagged");
  const excludedRows = parsed.parsedRows.filter((submission) => submission.validity === "excluded");
  const impactedTeams = [...new Set([...duplicateAssessment.impactedTeams, ...flaggedRows.map((submission) => submission.teamNumber)])];

  return {
    ok: true,
    errors,
    warnings,
    summary: {
      profileId: profile.id,
      profileLabel: profile.label,
      schemaVersion: profile.schemaVersion,
      rowCount: parsed.parsedRows.length,
      newRows: parsed.parsedRows.length,
      duplicateGroups: duplicateAssessment.duplicateGroups.length,
      flaggedRows: flaggedRows.length,
      excludedRows: excludedRows.length,
      impactedTeams,
      confidenceImpactTeams: impactedTeams.length,
      metadata: {
        season: metadataRead.metadata.season || String(eventModel.season),
        eventKey: metadataRead.metadata.eventKey || eventModel.key,
        schemaVersion: metadataRead.metadata.schemaVersion || profile.schemaVersion,
        templateProfileId: metadataRead.metadata.templateProfileId || profile.id,
      },
      submissions: parsed.parsedRows,
    },
  };
}

function commitScoutingImport({ preview, existingSubmissions = [], existingActivity = [], replaceExisting = false }) {
  if (!preview?.ok || !preview.summary) {
    return {
      submissions: existingSubmissions,
      activity: existingActivity,
    };
  }

  const timestamp = new Date().toISOString();
  const baseSubmissions = replaceExisting ? [] : existingSubmissions;
  const submissions = [...baseSubmissions, ...preview.summary.submissions.map((submission) => ({ ...submission, importedAt: timestamp }))];
  const activityEntry = {
    id: createId("activity"),
    kind: "import",
    timestamp,
    message: `${replaceExisting ? "Replaced" : "Imported"} ${preview.summary.newRows} rows into ${preview.summary.metadata.eventKey}; ${preview.summary.duplicateGroups} duplicate groups flagged; confidence lowered for ${preview.summary.confidenceImpactTeams} teams.`,
  };

  return {
    submissions,
    activity: [activityEntry, ...existingActivity].slice(0, 12),
  };
}

globalThis.ImportFoundation = {
  validateSeasonPackage,
  buildSampleCsv,
  previewScoutingImport,
  commitScoutingImport,
};
})();
