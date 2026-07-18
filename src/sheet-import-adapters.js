(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const scoutingJsonSchema = globalThis.ScoutingJsonSchema || {};
const buildCanonicalSchemaForEventModel =
  scoutingJsonSchema.buildCanonicalSchemaForEventModel ||
  ((eventModel, options = {}) => ({ schemaId: String(options.schemaId || `${eventModel?.season || "season"}-match-v1`), fields: [] }));
const buildCanonicalMetaForEventModel =
  scoutingJsonSchema.buildCanonicalMetaForEventModel ||
  ((eventModel, options = {}) => ({ format: "frc-scouting-analysis/v1", season: Number(options.season || eventModel?.season || 0), eventKey: String(options.eventKey || eventModel?.key || ""), entryType: "match" }));
const genericSheetTranslationVersion = "sheet-fallback-v1";
const genericSheetTemplateProfileId = "canonical-json-v1";
const genericSheetProfileLabel = "Canonical Sheet Bridge";

function normalizeText(value) {
  return String(value || "").trim();
}

function formulaFieldDefinitions(eventModel) {
  if (Array.isArray(eventModel?.formulaFieldDefinitions) && eventModel.formulaFieldDefinitions.length) {
    return eventModel.formulaFieldDefinitions;
  }
  if (typeof seasonFramework.formulaFieldDefinitions === "function") {
    return seasonFramework.formulaFieldDefinitions(eventModel);
  }
  if (Array.isArray(eventModel?.scouterMetricDefinitions) && eventModel.scouterMetricDefinitions.length) {
    return eventModel.scouterMetricDefinitions;
  }
  return (eventModel?.scoringComponents || []).map((component) => ({
    id: component.id,
    label: component.label,
    unit: component.unit || "pts",
  }));
}

function metricCsvHeader(fieldDefinition) {
  if (fieldDefinition?.csvKey) return fieldDefinition.csvKey;
  if (typeof seasonFramework.csvHeaderForMetric === "function") return seasonFramework.csvHeaderForMetric(fieldDefinition);
  return fieldDefinition?.unit === "pts" ? `${fieldDefinition.id}Pts` : fieldDefinition.id;
}

const baseFieldHeaderAliases = {
  matchNumber: ["match", "match #", "match number", "matchnumber", "qualification match"],
  teamNumber: ["team", "team #", "team number", "teamnumber", "team num", "team no"],
  scoutUser: ["scout", "scouter", "scout user", "scout name", "observer"],
  alliance: ["alliance", "alliance color", "alliiance", "color"],
  station: ["station", "driver station", "driverstation", "alliance index", "allianceindex", "ds"],
  defensePlayed: ["played defense", "defense played", "was defense", "defense"],
  robotStatus: ["robot status", "robot state", "status", "robot condition"],
  notes: ["notes", "comments", "comment", "overall notes"],
};

const provenanceHeaderAliases = {
  collectedAt: ["timestamp", "created at", "scouted time", "scoutedtime"],
  updatedAt: ["updated at"],
  sourceEventKey: ["event key", "eventkey"],
  sourceMatchKey: ["match key", "matchkey"],
  sourceRecordId: ["_id", "record id"],
};

const legacySheetAdapters = [
  {
    id: "legacy-2024-sheet",
    profileIds: ["match-current-v2", "match-legacy-v1"],
    seasons: [2024],
    headerHints: ["Auto Speaker", "Tele-op Speaker", "Starting location", "Climb Attempt"],
    minimumHeaderMatches: 2,
    version: "2024-thin-v2",
    translateRow(rowTools) {
      const matchNumber = rowTools.leadingNumber("Match #");
      const teamNumber = rowTools.leadingNumber("Team #");
      if (!matchNumber || !teamNumber) return null;

      const autoSpeaker = rowTools.number("Auto Speaker");
      const autoSpeakerMissed = rowTools.number("Auto Speaker Miss");
      const autoAmp = rowTools.number("Auto Amp");
      const autoAmpMissed = rowTools.number("Auto Amp Miss");
      const teleAmp = rowTools.number("Tele-op Amp score");
      const teleAmpMissed = rowTools.number("Tele-op Amp miss");
      const teleSpeaker = rowTools.number("Tele-op Speaker");
      const teleSpeakerMissed = rowTools.number("Tele-op Speaker miss");
      const notes = rowTools.text("Notes");

      return {
        matchNumber,
        teamNumber,
        scoutUser: rowTools.text("Timestamp") || "Imported Sheet",
        alliance: "unknown",
        station: rowTools.text("Starting location") || "sheet",
        defensePlayed: false,
        robotStatus: noteIndicatesNoShow(notes) ? "no_show" : "ok",
        notes,
        provenance: {
          collectedAt: rowTools.text("Timestamp"),
        },
        metrics: {
          autoSpeakerMade: autoSpeaker,
          autoSpeakerMissed,
          autoAmpMade: autoAmp,
          autoAmpMissed,
          teleSpeakerMade: teleSpeaker,
          teleSpeakerMissed,
          teleAmpMade: teleAmp,
          teleAmpMissed,
          climbAttempt: rowTools.number("Climb Attempt"),
          climbSuccess: rowTools.number("Climb Sucess"),
          driverPerformance: rowTools.optionalNumber("Driver Performance"),
          defenseOnThemRating: rowTools.optionalNumber("Defense Played On"),
        },
      };
    },
  },
  {
    id: "legacy-2025-sheet",
    profileIds: ["match-current-v2", "match-legacy-v1"],
    seasons: [2025],
    headerHints: ["Auto-L4Make", "Tele-Op-L4Make", "Climbing", "Alliance Index"],
    minimumHeaderMatches: 2,
    version: "2025-thin-v2",
    translateRow(rowTools) {
      const climbLevel = rowTools.number("Climbing");

      return {
        matchNumber: rowTools.number("MatchNumber"),
        teamNumber: rowTools.number("Team Number"),
        scoutUser: rowTools.text("ScouterName") || "Imported Sheet",
        alliance: (rowTools.text("Alliiance", "Alliance", "Alliance Color") || "unknown").toLowerCase(),
        station: rowTools.number("Alliance Index", "AllianceIndex") ? String(rowTools.number("Alliance Index", "AllianceIndex")) : "sheet",
        defensePlayed: rowTools.number("DidTheyPLAYDefense?HowEffective?") > 0,
        robotStatus: "ok",
        notes: rowTools.text("Notes"),
        provenance: {
          collectedAt: rowTools.text("ScoutedTime"),
          sourceEventKey: rowTools.text("EventKey"),
        },
        metrics: {
          autoL4Made: rowTools.number("Auto-L4Make"),
          autoL4Missed: rowTools.number("Auto-L4Miss"),
          autoL3Made: rowTools.number("Auto-L3Make"),
          autoL3Missed: rowTools.number("Auto-L3Miss"),
          autoL2Made: rowTools.number("Auto-L2Make"),
          autoL2Missed: rowTools.number("Auto-L2Miss"),
          autoTroughMade: rowTools.number("Auto-TroughMake"),
          autoTroughMissed: rowTools.number("Auto-TroughMiss"),
          autoRemovedAlgaeMade: rowTools.number("Auto-RemovedAlgaeMake"),
          autoRemovedAlgaeMissed: rowTools.number("Auto-RemovedAlgaeMiss"),
          autoProcessorMade: rowTools.number("Auto-ScoredProcessorMake"),
          autoProcessorMissed: rowTools.number("Auto-ScoredProcessorMiss"),
          autoBargeMade: rowTools.number("Auto-ScoredBargeMake"),
          autoBargeMissed: rowTools.number("Auto-ScoredBargeMiss"),
          teleL4Made: rowTools.number("Tele-Op-L4Make"),
          teleL4Missed: rowTools.number("Tele-Op-L4Miss"),
          teleL3Made: rowTools.number("Tele-Op-L3Make"),
          teleL3Missed: rowTools.number("Tele-Op-L3Miss"),
          teleL2Made: rowTools.number("Tele-Op-L2Make"),
          teleL2Missed: rowTools.number("Tele-Op-L2Miss"),
          teleTroughMade: rowTools.number("Tele-Op-TroughMake"),
          teleTroughMissed: rowTools.number("Tele-Op-TroughMiss"),
          teleRemovedAlgaeMade: rowTools.number("Tele-Op-RemovedAlgaeMake"),
          teleRemovedAlgaeMissed: rowTools.number("Tele-Op-RemovedAlgaeMiss"),
          teleProcessorMade: rowTools.number("Tele-Op-ScoredProcessorMake"),
          teleProcessorMissed: rowTools.number("Tele-Op-ScoredProcessorMiss"),
          teleBargeMade: rowTools.number("Tele-Op-ScoredBargeMake"),
          teleBargeMissed: rowTools.number("Tele-Op-ScoredBargeMiss"),
          climbLevel,
          climbAttempt: rowTools.truthyNumber("Climb Attempt"),
          driverPerformance: rowTools.optionalNumber("DriverPerformance"),
          playedDefenseRating: rowTools.optionalNumber("DidTheyPLAYDefense?HowEffective?"),
          defenseOnThemRating: rowTools.optionalNumber("WasDefensePlayedONThem?HowEffective?"),
        },
      };
    },
  },
  {
    id: "legacy-2026-sheet",
    profileIds: ["match-current-v2", "match-legacy-v1"],
    seasons: [2026],
    headerHints: ["Shifts Auto Primary Role", "Shifts Transition Fuel Pct", "Overall Shooter", "Shifts Endgame Climb"],
    minimumHeaderMatches: 2,
    version: "2026-thin-v2",
    filterRow(rowTools, eventModel) {
      const rowEventKey = rowTools.text("Event Key");
      return !rowEventKey || rowEventKey === eventModel.key;
    },
    translateRow(rowTools) {
      const autoFuel = rowTools.number("Shifts Auto Fuel Pct");
      const transitionFuel = rowTools.number("Shifts Transition Fuel Pct");
      const shift1Fuel = rowTools.number("Shifts Shift1 Fuel Pct");
      const shift2Fuel = rowTools.number("Shifts Shift2 Fuel Pct");
      const shift3Fuel = rowTools.number("Shifts Shift3 Fuel Pct");
      const shift4Fuel = rowTools.number("Shifts Shift4 Fuel Pct");
      const endgameFuel = rowTools.number("Shifts Endgame Fuel Pct");

      return {
        matchNumber: rowTools.number("Match Number"),
        teamNumber: rowTools.number("Team Number"),
        scoutUser: rowTools.text("Scouter") || "Imported Sheet",
        alliance: (rowTools.text("Alliance") || "unknown").toLowerCase(),
        station: rowTools.text("Shifts Auto Starting Position") || "sheet",
        defensePlayed:
          [
            "Shifts Transition Defense On",
            "Shifts Shift1 Defense On",
            "Shifts Shift2 Defense On",
            "Shifts Shift3 Defense On",
            "Shifts Shift4 Defense On",
            "Shifts Endgame Defense On",
          ].some((header) => rowTools.text(header) && normalizeImportToken(rowTools.text(header)) !== "none") ||
          rowTools.number("Overall Defense") > 0,
        robotStatus: rowTools.boolean("No Show") ? "no_show" : "ok",
        notes: rowTools.text("Overall Notes"),
        provenance: {
          collectedAt: rowTools.text("Created At"),
          updatedAt: rowTools.text("Updated At"),
          sourceEventKey: rowTools.text("Event Key"),
          sourceMatchKey: rowTools.text("Match Key"),
          sourceRecordId: rowTools.text("_id"),
        },
        metrics: {
          alliance: rowTools.text("Alliance"),
          startingPosition: rowTools.text("Shifts Auto Starting Position"),
          autoPrimaryRole: rowTools.text("Shifts Auto Primary Role"),
          autoSecondaryRole: rowTools.text("Shifts Auto Secondary Role"),
          autoFuelPct: autoFuel,
          autoClimbAttempt: rowTools.text("Shifts Auto Climb"),
          transitionPrimaryRole: rowTools.text("Shifts Transition Primary Role"),
          transitionSecondaryRole: rowTools.text("Shifts Transition Secondary Role"),
          transitionFuelPct: transitionFuel,
          shift1PrimaryRole: rowTools.text("Shifts Shift1 Primary Role"),
          shift1SecondaryRole: rowTools.text("Shifts Shift1 Secondary Role"),
          shift1FuelPct: shift1Fuel,
          shift2PrimaryRole: rowTools.text("Shifts Shift2 Primary Role"),
          shift2SecondaryRole: rowTools.text("Shifts Shift2 Secondary Role"),
          shift2FuelPct: shift2Fuel,
          shift3PrimaryRole: rowTools.text("Shifts Shift3 Primary Role"),
          shift3SecondaryRole: rowTools.text("Shifts Shift3 Secondary Role"),
          shift3FuelPct: shift3Fuel,
          shift4PrimaryRole: rowTools.text("Shifts Shift4 Primary Role"),
          shift4SecondaryRole: rowTools.text("Shifts Shift4 Secondary Role"),
          shift4FuelPct: shift4Fuel,
          endgamePrimaryRole: rowTools.text("Shifts Endgame Primary Role"),
          endgameSecondaryRole: rowTools.text("Shifts Endgame Secondary Role"),
          endgameFuelPct: endgameFuel,
          teleopClimbAttempt: rowTools.text("Shifts Endgame Climb"),
          overallShooter: rowTools.optionalNumber("Overall Shooter"),
          overallPasser: rowTools.optionalNumber("Overall Passer"),
          overallIntake: rowTools.optionalNumber("Overall Intake"),
          overallDriver: rowTools.optionalNumber("Overall Driver"),
          overallDefenseAvoidance: rowTools.optionalNumber("Overall Defense Avoidance"),
          overallDefense: rowTools.optionalNumber("Overall Defense"),
          overallNotes: rowTools.text("Overall Notes"),
          noShow: rowTools.boolean("No Show") ? 1 : 0,
        },
      };
    },
  },
];

function parseCsvText(text) {
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
  return rows.map((cells) => cells.map((cell) => String(cell ?? "").trim()));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsvText(rows) {
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function normalizeImportToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseNumericValue(value, blankValue = 0) {
  const text = String(value ?? "").trim();
  if (!text) return blankValue;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : blankValue;
}

function truthyValue(value) {
  return ["true", "yes", "y", "1"].includes(normalizeImportToken(value));
}

function inferCanonicalFieldType(fieldDefinition) {
  const explicitType = String(fieldDefinition?.type || "").trim().toLowerCase();
  if (explicitType) return explicitType;
  const unit = String(fieldDefinition?.unit || "").trim().toLowerCase();
  if (unit === "text" || unit === "string") return "string";
  return "number";
}

function identifierTokens(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/%/g, " pct ")
    .replace(/#/g, " number ")
    .replace(/&/g, " and ")
    .split(/[^A-Za-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function camelCaseIdentifier(value, fallback = "field") {
  const tokens = identifierTokens(value);
  if (!tokens.length) return fallback;
  const normalized = tokens.map((token) => token.toLowerCase());
  const identifier = normalized
    .map((token, index) => (index === 0 ? token : `${token.charAt(0).toUpperCase()}${token.slice(1)}`))
    .join("");
  if (!identifier) return fallback;
  if (/^[a-z]/.test(identifier)) return identifier;
  return `${fallback}${identifier.charAt(0).toUpperCase()}${identifier.slice(1)}`;
}

function buildHeaderAliasLookup(entries) {
  const lookup = new Map();
  Object.entries(entries).forEach(([targetId, aliases]) => {
    [targetId, ...(aliases || [])].forEach((alias) => lookup.set(normalizeImportToken(alias), targetId));
  });
  return lookup;
}

function numericCellValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const numeric = Number(text);
  return Number.isFinite(numeric) ? numeric : null;
}

function leadingNumericCellValue(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const numeric = leadingNumericValue(text);
  return Number.isFinite(numeric) && numeric !== 0 ? numeric : null;
}

function inferSheetFieldType(values = [], fallbackType = "string") {
  const samples = values.map((value) => String(value ?? "").trim()).filter(Boolean);
  if (!samples.length) return fallbackType;
  return samples.every((value) => Number.isFinite(Number(value))) ? "number" : "string";
}

function normalizeSchemaField(fieldDefinition = {}) {
  return {
    id: String(fieldDefinition.id || "").trim(),
    label: String(fieldDefinition.label || fieldDefinition.id || "").trim(),
    type: inferCanonicalFieldType(fieldDefinition),
    unit: String(fieldDefinition.unit || "").trim(),
    optional: fieldDefinition.optional !== false,
    aggregate: String(fieldDefinition.aggregate || "").trim() || (inferCanonicalFieldType(fieldDefinition) === "number" ? "average" : ""),
  };
}

function normalizeGenericMetricValue(value, fieldType) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (fieldType === "number") {
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return text;
}

function uniqueFieldId(fieldId, usedFieldIds) {
  const baseFieldId = String(fieldId || "").trim() || "field";
  if (!usedFieldIds.has(baseFieldId)) {
    usedFieldIds.add(baseFieldId);
    return baseFieldId;
  }
  let suffix = 2;
  while (usedFieldIds.has(`${baseFieldId}${suffix}`)) suffix += 1;
  const nextFieldId = `${baseFieldId}${suffix}`;
  usedFieldIds.add(nextFieldId);
  return nextFieldId;
}

function knownSchemaFieldsForEvent(eventModel) {
  return (buildCanonicalSchemaForEventModel(eventModel, { schemaId: `${eventModel?.season || "season"}-match-v1` }).fields || []).map(normalizeSchemaField);
}

function knownMetricFieldLookup(eventModel) {
  const schemaFieldById = new Map(knownSchemaFieldsForEvent(eventModel).map((fieldDefinition) => [fieldDefinition.id, fieldDefinition]));
  const lookup = new Map();
  formulaFieldDefinitions(eventModel).forEach((metricDefinition) => {
    const fieldId = String(metricDefinition?.id || "").trim();
    if (!fieldId) return;
    [fieldId, metricCsvHeader(metricDefinition), metricDefinition.label, ...(metricDefinition.aliases || [])]
      .filter(Boolean)
      .forEach((alias) => lookup.set(normalizeImportToken(alias), schemaFieldById.get(fieldId) || normalizeSchemaField(metricDefinition)));
  });
  return lookup;
}

function buildGenericColumnDescriptors(eventModel, headers = [], dataRows = []) {
  const baseLookup = buildHeaderAliasLookup(baseFieldHeaderAliases);
  const provenanceLookup = buildHeaderAliasLookup(provenanceHeaderAliases);
  const metricLookup = knownMetricFieldLookup(eventModel);
  const usedMetricIds = new Set();

  return headers.map((header, index) => {
    const label = String(header ?? "").trim();
    const token = normalizeImportToken(label);
    if (!token) return { kind: "ignore", index, header: label };

    const baseFieldId = baseLookup.get(token);
    if (baseFieldId) return { kind: "base", index, header: label, fieldId: baseFieldId };

    const provenanceFieldId = provenanceLookup.get(token);
    if (provenanceFieldId) return { kind: "provenance", index, header: label, fieldId: provenanceFieldId };

    const knownField = metricLookup.get(token);
    if (knownField && !usedMetricIds.has(knownField.id)) {
      usedMetricIds.add(knownField.id);
      return { kind: "metric", index, header: label, field: knownField };
    }

    const fieldId = uniqueFieldId(camelCaseIdentifier(label), usedMetricIds);
    const samples = dataRows.map((row) => row[index]);
    const fieldType = inferSheetFieldType(samples);
    return {
      kind: "metric",
      index,
      header: label,
      field: {
        id: fieldId,
        label: label || fieldId,
        type: fieldType,
        unit: fieldType === "number" ? "count" : "text",
        optional: true,
        aggregate: fieldType === "number" ? "average" : "",
      },
    };
  });
}

function translateGenericRows(eventModel, rows = []) {
  const headers = rows[0] || [];
  const dataRows = rows.slice(1).filter((row) => row.some((cell) => cell));
  const descriptors = buildGenericColumnDescriptors(eventModel, headers, dataRows);
  const records = dataRows.map((row, rowIndex) => {
    const metrics = {};
    const provenance = {
      mode: "sheet-column-canonicalization",
      sourceRowNumber: rowIndex + 2,
    };
    const baseRecord = {
      matchNumber: null,
      teamNumber: null,
      scoutUser: "",
      alliance: "",
      station: "",
      defensePlayed: false,
      robotStatus: "",
      notes: "",
      provenance,
      metrics,
    };

    descriptors.forEach((descriptor) => {
      if (!descriptor || descriptor.kind === "ignore") return;
      const value = String(row[descriptor.index] ?? "").trim();
      if (descriptor.kind === "base") {
        if (descriptor.fieldId === "matchNumber") baseRecord.matchNumber = leadingNumericCellValue(value);
        else if (descriptor.fieldId === "teamNumber") baseRecord.teamNumber = leadingNumericCellValue(value);
        else if (descriptor.fieldId === "defensePlayed") baseRecord.defensePlayed = truthyValue(value) || Number(value) > 0;
        else if (descriptor.fieldId === "alliance") baseRecord.alliance = value.toLowerCase();
        else if (descriptor.fieldId === "station") baseRecord.station = value;
        else if (descriptor.fieldId === "notes") baseRecord.notes = value;
        else if (descriptor.fieldId === "robotStatus") baseRecord.robotStatus = value;
        else if (descriptor.fieldId === "scoutUser") baseRecord.scoutUser = value;
        return;
      }
      if (descriptor.kind === "provenance") {
        if (value) provenance[descriptor.fieldId] = value;
        return;
      }
      metrics[descriptor.field.id] = normalizeGenericMetricValue(value, descriptor.field.type);
    });

    if (!baseRecord.scoutUser) baseRecord.scoutUser = "Imported Sheet";
    if (!baseRecord.alliance) baseRecord.alliance = "unknown";
    if (!baseRecord.station) baseRecord.station = "sheet";
    if (!baseRecord.robotStatus) baseRecord.robotStatus = noteIndicatesNoShow(baseRecord.notes) ? "no_show" : "ok";
    return baseRecord;
  });

  return {
    records,
    schemaFields: descriptors
      .filter((descriptor) => descriptor.kind === "metric")
      .map((descriptor) => normalizeSchemaField(descriptor.field)),
  };
}

function mergeTranslatedAndGenericRecords(translatedRecords = [], genericRecords = []) {
  const genericBySourceRow = new Map(
    genericRecords
      .filter((record) => record?.provenance?.sourceRowNumber)
      .map((record) => [record.provenance.sourceRowNumber, record]),
  );
  return translatedRecords.map((record) => {
    const sourceRowNumber = Number(record?.provenance?.sourceRowNumber) || null;
    const genericRecord = sourceRowNumber ? genericBySourceRow.get(sourceRowNumber) : null;
    if (!genericRecord) return record;
    return {
      ...record,
      scoutUser: record.scoutUser || genericRecord.scoutUser,
      alliance: record.alliance || genericRecord.alliance,
      station: record.station || genericRecord.station,
      notes: record.notes || genericRecord.notes,
      provenance: {
        ...(genericRecord.provenance || {}),
        ...(record.provenance || {}),
      },
      metrics: {
        ...(genericRecord.metrics || {}),
        ...(record.metrics || {}),
      },
    };
  });
}

function numericMetricValue(metrics, fieldId) {
  const numeric = Number(metrics?.[fieldId] || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function populateSeasonScoringComponents(eventModel, metrics = {}) {
  const nextMetrics = { ...(metrics || {}) };
  const season = Number(eventModel?.season) || 0;
  if (season === 2024) {
    if (!Object.prototype.hasOwnProperty.call(nextMetrics, "auto")) {
      nextMetrics.auto = numericMetricValue(nextMetrics, "autoSpeakerMade") + numericMetricValue(nextMetrics, "autoAmpMade");
    }
    if (!Object.prototype.hasOwnProperty.call(nextMetrics, "speaker")) {
      nextMetrics.speaker = numericMetricValue(nextMetrics, "teleSpeakerMade");
    }
    if (!Object.prototype.hasOwnProperty.call(nextMetrics, "amp")) {
      nextMetrics.amp = numericMetricValue(nextMetrics, "teleAmpMade");
    }
    if (!Object.prototype.hasOwnProperty.call(nextMetrics, "trap")) {
      nextMetrics.trap = numericMetricValue(nextMetrics, "trap");
    }
    return nextMetrics;
  }
  if (season === 2025) {
    if (!Object.prototype.hasOwnProperty.call(nextMetrics, "auto")) {
      nextMetrics.auto =
        (numericMetricValue(nextMetrics, "autoL4Made") * 7)
        + (numericMetricValue(nextMetrics, "autoL3Made") * 6)
        + (numericMetricValue(nextMetrics, "autoL2Made") * 4)
        + (numericMetricValue(nextMetrics, "autoTroughMade") * 3)
        + (numericMetricValue(nextMetrics, "autoProcessorMade") * 6)
        + (numericMetricValue(nextMetrics, "autoBargeMade") * 4);
    }
    if (!Object.prototype.hasOwnProperty.call(nextMetrics, "coral")) {
      nextMetrics.coral =
        (numericMetricValue(nextMetrics, "teleL4Made") * 5)
        + (numericMetricValue(nextMetrics, "teleL3Made") * 4)
        + (numericMetricValue(nextMetrics, "teleL2Made") * 3)
        + (numericMetricValue(nextMetrics, "teleTroughMade") * 2);
    }
    if (!Object.prototype.hasOwnProperty.call(nextMetrics, "algae")) {
      nextMetrics.algae =
        (numericMetricValue(nextMetrics, "teleProcessorMade") * 6)
        + (numericMetricValue(nextMetrics, "teleBargeMade") * 4);
    }
    if (!Object.prototype.hasOwnProperty.call(nextMetrics, "climb")) {
      nextMetrics.climb = reefscape2025ClimbPoints(nextMetrics.climbLevel);
    }
  }
  return nextMetrics;
}

function categoricalScore(value, mapping = {}) {
  const normalized = normalizeImportToken(value);
  return mapping[normalized] ?? 0;
}

function leadingNumericValue(value) {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function noteIndicatesNoShow(value) {
  return normalizeImportToken(value).includes("noshow");
}

function eventSheetHeaderMap(headers) {
  const map = new Map();
  headers.forEach((header, index) => map.set(header, index));
  return map;
}

function eventSheetCell(row, headerIndex, ...headers) {
  for (const header of headers) {
    const position = headerIndex.get(header);
    if (position !== undefined) return String(row[position] ?? "").trim();
  }
  return "";
}

function createRowTools(row, headerIndex) {
  return {
    text: (...headers) => eventSheetCell(row, headerIndex, ...headers),
    number: (...headers) => parseNumericValue(eventSheetCell(row, headerIndex, ...headers), 0),
    optionalNumber: (...headers) => parseNumericValue(eventSheetCell(row, headerIndex, ...headers), null),
    leadingNumber: (...headers) => leadingNumericValue(eventSheetCell(row, headerIndex, ...headers)),
    boolean: (...headers) => truthyValue(eventSheetCell(row, headerIndex, ...headers)),
    truthyNumber: (...headers) => {
      const value = eventSheetCell(row, headerIndex, ...headers);
      return truthyValue(value) ? 1 : parseNumericValue(value, 0);
    },
    categoricalScore: (header, mapping) => categoricalScore(eventSheetCell(row, headerIndex, header), mapping),
  };
}

function adapterMatchesEvent(adapter, eventModel) {
  const seasons = Array.isArray(adapter?.seasons) ? adapter.seasons.map((season) => Number(season)) : [];
  if (!seasons.length) return true;
  return seasons.includes(Number(eventModel?.season) || 0);
}

function normalizedHeaderTokenSet(headers = []) {
  return new Set(
    (headers || [])
      .map((header) => normalizeImportToken(header))
      .filter(Boolean),
  );
}

function adapterHeaderMatchScore(adapter, normalizedHeaders) {
  const hints = Array.isArray(adapter?.headerHints) ? adapter.headerHints : [];
  return hints.reduce((count, hint) => count + (normalizedHeaders.has(normalizeImportToken(hint)) ? 1 : 0), 0);
}

function bestMatchingLegacySheetAdapter(adapters, headers = [], eventModel = null) {
  if (!Array.isArray(headers) || !headers.length) return null;
  const normalizedHeaders = normalizedHeaderTokenSet(headers);
  let bestAdapter = null;
  let bestScore = 0;
  adapters.forEach((adapter) => {
    const hints = Array.isArray(adapter?.headerHints) ? adapter.headerHints : [];
    if (!hints.length) return;
    const requiredMatches = Math.max(1, Math.min(
      hints.length,
      Number.isFinite(Number(adapter?.minimumHeaderMatches)) ? Number(adapter.minimumHeaderMatches) : hints.length,
    ));
    const score = adapterHeaderMatchScore(adapter, normalizedHeaders);
    if (score < requiredMatches) return;
    const nextSeasonMatch = adapterMatchesEvent(adapter, eventModel);
    const bestSeasonMatch = adapterMatchesEvent(bestAdapter, eventModel);
    if (score > bestScore || (score === bestScore && nextSeasonMatch && !bestSeasonMatch)) {
      bestAdapter = adapter;
      bestScore = score;
    }
  });
  return bestAdapter;
}

function translatorForEvent(eventModel, options = {}) {
  const explicitAdapterId = normalizeText(options?.translatorId);
  if (explicitAdapterId) {
    return legacySheetAdapters.find((adapter) => normalizeText(adapter?.id) === explicitAdapterId) || null;
  }
  const headers = Array.isArray(options?.headers) ? options.headers : [];
  const explicitProfileId = normalizeText(options?.templateProfileId);
  if (explicitProfileId) {
    const profileMatchedAdapters = legacySheetAdapters.filter((adapter) => (adapter.profileIds || []).includes(explicitProfileId));
    const headerMatchedProfileAdapter = bestMatchingLegacySheetAdapter(profileMatchedAdapters, headers, eventModel);
    if (headerMatchedProfileAdapter) return headerMatchedProfileAdapter;
    const profileMatchedAdapter = profileMatchedAdapters.find((adapter) => adapterMatchesEvent(adapter, eventModel));
    if (profileMatchedAdapter) return profileMatchedAdapter;
  }
  const headerMatchedAdapter = bestMatchingLegacySheetAdapter(legacySheetAdapters, headers, eventModel);
  if (headerMatchedAdapter) return headerMatchedAdapter;
  return legacySheetAdapters.find((adapter) => adapterMatchesEvent(adapter, eventModel)) || null;
}

function importTranslationVersionForEvent(eventModel, options = {}) {
  return translatorForEvent(eventModel, options)?.version || "";
}

function profileSchemaVersion(profileId) {
  return {
    "match-current-v2": "match-v2",
    "match-legacy-v1": "match-v1",
  }[String(profileId || "").trim()] || "match-v2";
}

function buildCanonicalImportCsv(eventModel, records, options = {}) {
  const templateProfileId = String(options.templateProfileId || eventModel?.sheet?.recommendedProfileId || "match-current-v2").trim() || "match-current-v2";
  const schemaVersion = String(options.schemaVersion || profileSchemaVersion(templateProfileId)).trim() || profileSchemaVersion(templateProfileId);
  const translationVersion = String(options.translationVersion || importTranslationVersionForEvent(eventModel, options)).trim();
  const metadataRow = ["meta", "season", "eventKey", "schemaVersion", "templateProfileId", "translationVersion"];
  const valueRow = ["value", eventModel.season, eventModel.key, schemaVersion, templateProfileId, translationVersion];
  const metricDefinitions = formulaFieldDefinitions(eventModel);
  const headerRow = [
    "matchNumber",
    "teamNumber",
    "scoutUser",
    "alliance",
    "station",
    "defensePlayed",
    "robotStatus",
    "notes",
    ...metricDefinitions.map((metricDefinition) => metricCsvHeader(metricDefinition)),
  ];
  const dataRows = records.map((record) => [
    record.matchNumber,
    record.teamNumber,
    record.scoutUser,
    record.alliance,
    record.station,
    record.defensePlayed ? "yes" : "no",
    record.robotStatus,
    record.notes,
    ...metricDefinitions.map((metricDefinition) => {
      const value = record.metrics[metricDefinition.id];
      if (value !== undefined && value !== null && value !== "") return value;
      return String(metricDefinition.unit || "").trim().toLowerCase() === "pts" ? 0 : "";
    }),
  ]);
  return toCsvText([metadataRow, valueRow, [], headerRow, ...dataRows]);
}

function canonicalEntriesFromRecords(records, options = {}) {
  const translatorVersion = String(options.translationVersion || "").trim();
  const provenanceMode = String(options.provenanceMode || "").trim();
  return (records || []).map((record, index) => ({
    entryId: record.entryId || `sheet-entry-${index + 1}`,
    matchNumber: record.matchNumber,
    teamNumber: record.teamNumber,
    scoutUser: record.scoutUser,
    alliance: record.alliance,
    station: record.station,
    defensePlayed: Boolean(record.defensePlayed),
    robotStatus: record.robotStatus || "",
    notes: record.notes || "",
    rawMetrics: { ...(record.metrics || {}) },
    provenance: Object.fromEntries(
      Object.entries({
        mode: provenanceMode || record?.provenance?.mode || "legacy-sheet-translation",
        sourceRowNumber: record?.provenance?.sourceRowNumber || index + 2,
        translatorVersion,
        ...(record.provenance || {}),
      }).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    ),
  }));
}

function buildCanonicalDataset(eventModel, records, options = {}) {
  const templateProfileId = String(options.templateProfileId || eventModel?.sheet?.recommendedProfileId || "match-current-v2").trim() || "match-current-v2";
  const schemaVersion = String(options.schemaVersion || profileSchemaVersion(templateProfileId)).trim() || profileSchemaVersion(templateProfileId);
  const translationVersion = String(options.translationVersion || importTranslationVersionForEvent(eventModel, options)).trim();
  const normalizedRecords = (records || []).map((record) => ({
    ...record,
    metrics: populateSeasonScoringComponents(eventModel, record.metrics || {}),
  }));
  const presentFieldIds = new Set(
    normalizedRecords.flatMap((record) => Object.keys(record.metrics || {})).map((fieldId) => String(fieldId || "").trim()).filter(Boolean),
  );
  const explicitSchemaFields = Array.isArray(options.schemaFields) ? options.schemaFields.map((fieldDefinition) => normalizeSchemaField(fieldDefinition)) : [];
  const explicitSchemaFieldIds = new Set(explicitSchemaFields.map((fieldDefinition) => fieldDefinition.id).filter(Boolean));
  const baseSchema = buildCanonicalSchemaForEventModel(eventModel, { schemaId: schemaVersion });
  const mergedSchemaFieldMap = new Map(
    (baseSchema.fields || [])
      .map((fieldDefinition) => normalizeSchemaField(fieldDefinition))
      .filter((fieldDefinition) => presentFieldIds.has(fieldDefinition.id) || explicitSchemaFieldIds.has(fieldDefinition.id))
      .map((fieldDefinition) => [fieldDefinition.id, fieldDefinition]),
  );
  explicitSchemaFields.forEach((fieldDefinition) => {
    const normalizedField = normalizeSchemaField(fieldDefinition);
    if (!normalizedField.id) return;
    mergedSchemaFieldMap.set(normalizedField.id, {
      ...(mergedSchemaFieldMap.get(normalizedField.id) || {}),
      ...normalizedField,
    });
  });
  const meta = {
    ...buildCanonicalMetaForEventModel(eventModel, {
      eventKey: eventModel.key,
      season: eventModel.season,
      entryType: "match",
      sourceApp: String(options.sourceApp || "").trim() || "legacy-sheet-translator",
    }),
    templateProfileId,
    profileLabel:
      String(options.profileLabel || "").trim()
      || {
        "match-current-v2": "Current Match Template",
        "match-legacy-v1": "Legacy Match Template",
        "canonical-json-v1": genericSheetProfileLabel,
      }[templateProfileId]
      || templateProfileId,
    translationVersion,
  };
  return {
    meta,
    schema: {
      ...baseSchema,
      schemaId: schemaVersion,
      fields: [...mergedSchemaFieldMap.values()],
    },
    entries: canonicalEntriesFromRecords(normalizedRecords, {
      translationVersion,
      provenanceMode: options.provenanceMode,
    }),
    translatorVersion: translationVersion,
    templateProfileId,
    profileLabel: meta.profileLabel,
  };
}

function buildCanonicalJsonText(dataset) {
  return JSON.stringify(
    {
      meta: dataset?.meta || {},
      schema: dataset?.schema || {},
      entries: dataset?.entries || [],
    },
    null,
    2,
  );
}

function translateEventSheetToCanonical(eventModel, csvText, options = {}) {
  if (!csvText) {
    return buildCanonicalDataset(eventModel, [], options);
  }
  const rows = parseCsvText(csvText);
  const headers = rows[0] || [];
  const genericTranslation = translateGenericRows(eventModel, rows);
  const translator = translatorForEvent(eventModel, { ...options, headers });
  if (!translator) {
    return buildCanonicalDataset(eventModel, genericTranslation.records, {
      ...options,
      templateProfileId: genericSheetTemplateProfileId,
      profileLabel: genericSheetProfileLabel,
      schemaVersion: `${eventModel?.season || "season"}-match-v1`,
      translationVersion: genericSheetTranslationVersion,
      sourceApp: "sheet-column-canonicalizer",
      provenanceMode: "sheet-column-canonicalization",
      schemaFields: genericTranslation.schemaFields,
    });
  }

  const headerIndex = eventSheetHeaderMap(headers);
  const translatedRecords = rows
    .slice(1)
    .map((row, rowIndex) => {
      if (!row.some((cell) => cell)) return null;
      const rowTools = createRowTools(row, headerIndex);
      if (translator.filterRow && !translator.filterRow(rowTools, eventModel)) return null;
      const record = translator.translateRow(rowTools, eventModel);
      if (!record) return null;
      return {
        ...record,
        provenance: {
          mode: "legacy-sheet-translation",
          ...(record.provenance || {}),
          sourceRowNumber: rowIndex + 2,
        },
      };
    })
    .filter(Boolean);

  if (!translatedRecords.length && genericTranslation.records.length) {
    return buildCanonicalDataset(eventModel, genericTranslation.records, {
      ...options,
      templateProfileId: genericSheetTemplateProfileId,
      profileLabel: genericSheetProfileLabel,
      schemaVersion: `${eventModel?.season || "season"}-match-v1`,
      translationVersion: genericSheetTranslationVersion,
      sourceApp: "sheet-column-canonicalizer",
      provenanceMode: "sheet-column-canonicalization",
      schemaFields: genericTranslation.schemaFields,
    });
  }

  return buildCanonicalDataset(eventModel, mergeTranslatedAndGenericRecords(translatedRecords, genericTranslation.records), {
    ...options,
    translationVersion: translator.version,
    schemaFields: genericTranslation.schemaFields,
  });
}

function reefscape2025ClimbPoints(value) {
  return {
    0: 0,
    1: 2,
    2: 6,
    3: 8,
    4: 12,
  }[Number(value) || 0] ?? 0;
}

function adaptEventSheetCsv(eventModel, csvText, options = {}) {
  if (!csvText) return "";
  const dataset = translateEventSheetToCanonical(eventModel, csvText, options);
  if (dataset?.meta?.templateProfileId === genericSheetTemplateProfileId) return csvText;
  const records = dataset.entries.map((entry) => ({
    matchNumber: entry.matchNumber,
    teamNumber: entry.teamNumber,
    scoutUser: entry.scoutUser,
    alliance: entry.alliance,
    station: entry.station,
    defensePlayed: entry.defensePlayed,
    robotStatus: entry.robotStatus,
    notes: entry.notes,
    metrics: entry.rawMetrics || {},
  }));
  return buildCanonicalImportCsv(eventModel, records, {
    ...options,
    templateProfileId: dataset.templateProfileId || options.templateProfileId,
    schemaVersion: dataset.schema?.schemaId || options.schemaVersion,
    translationVersion: dataset.translatorVersion || options.translationVersion,
  });
}

globalThis.SheetImportAdapters = {
  adapt2024SheetCsv: (eventModel, csvText) => adaptEventSheetCsv({ ...eventModel, season: 2024 }, csvText),
  adapt2025SheetCsv: (eventModel, csvText) => adaptEventSheetCsv({ ...eventModel, season: 2025 }, csvText),
  adapt2026SheetCsv: (eventModel, csvText) => adaptEventSheetCsv({ ...eventModel, season: 2026 }, csvText),
  adaptEventSheetCsv,
  buildCanonicalJsonText,
  buildCanonicalImportCsv,
  importTranslationVersionForEvent,
  parseCsvText,
  translateEventSheetToCanonical,
};
})();
