(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const seasonScouterMetricDefinitions = seasonFramework.scouterMetricDefinitions || ((eventModel) => eventModel?.scoringComponents || []);
const seasonMetricFieldId = seasonFramework.csvHeaderForMetric || ((metricDefinition) => (metricDefinition.unit === "pts" ? `${metricDefinition.id}Pts` : metricDefinition.id));

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

function numericValue(value) {
  const numeric = Number(String(value || "").trim());
  return Number.isFinite(numeric) ? numeric : 0;
}

function truthyValue(value) {
  return ["true", "yes", "y", "1"].includes(normalizeImportToken(value));
}

function categoricalScore(value, mapping = {}) {
  const normalized = normalizeImportToken(value);
  return mapping[normalized] ?? 0;
}

function leadingNumericValue(value) {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function defenseEffectivenessScore(value) {
  return categoricalScore(value, {
    none: 0,
    na: 0,
    n: 0,
    noteffective: 1,
    somewhateffective: 2,
    effective: 3,
    significantlyeffective: 4,
    light: 1,
    moderate: 2,
    heavy: 3,
  });
}

function eventSheetHeaderMap(headers) {
  const map = new Map();
  headers.forEach((header, index) => map.set(header, index));
  return map;
}

function eventSheetCell(row, headerIndex, header) {
  const position = headerIndex.get(header);
  return position === undefined ? "" : String(row[position] ?? "").trim();
}

function buildCanonicalImportCsv(eventModel, records) {
  const metadataRow = ["meta", "season", "eventKey", "schemaVersion", "templateProfileId"];
  const valueRow = ["value", eventModel.season, eventModel.key, "match-v2", "match-current-v2"];
  const metricDefinitions = seasonScouterMetricDefinitions(eventModel);
  const headerRow = [
    "matchNumber",
    "teamNumber",
    "scoutUser",
    "alliance",
    "station",
    "defensePlayed",
    "robotStatus",
    "notes",
    ...metricDefinitions.map((metricDefinition) => seasonMetricFieldId(metricDefinition)),
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
    ...metricDefinitions.map((metricDefinition) => record.metrics[metricDefinition.id] ?? 0),
  ]);
  return toCsvText([metadataRow, valueRow, [], headerRow, ...dataRows]);
}

function parse2025TeamDescriptor(value) {
  const [alliance = "", station = "", teamNumber = "", ...nameParts] = String(value || "").split(",");
  return {
    alliance: alliance.trim().toLowerCase(),
    station: station.trim(),
    teamNumber: Number(teamNumber),
    name: nameParts.join(",").trim(),
  };
}

function reefscape2025Count(row, headerIndex, header) {
  return numericValue(eventSheetCell(row, headerIndex, header));
}

function reefscape2025ClimbPoints(value) {
  const climbCode = numericValue(value);
  return {
    0: 0,
    1: 2,
    2: 6,
    3: 8,
    4: 12,
  }[climbCode] ?? 0;
}

function adapt2025SheetCsv(eventModel, csvText) {
  const rows = parseCsvText(csvText);
  const headers = rows[0] || [];
  const headerIndex = eventSheetHeaderMap(headers);
  const records = rows.slice(1).filter((row) => row.some((cell) => cell)).map((row) => {
    const team = parse2025TeamDescriptor(eventSheetCell(row, headerIndex, "Team"));
    const autoPoints =
      reefscape2025Count(row, headerIndex, "Auto-L4Make") * 7 +
      reefscape2025Count(row, headerIndex, "Auto-L3Make") * 6 +
      reefscape2025Count(row, headerIndex, "Auto-L2Make") * 4 +
      reefscape2025Count(row, headerIndex, "Auto-TroughMake") * 3 +
      reefscape2025Count(row, headerIndex, "Auto-ScoredProcessorMake") * 6 +
      reefscape2025Count(row, headerIndex, "Auto-ScoredBargeMake") * 4;
    const coralPoints =
      reefscape2025Count(row, headerIndex, "Tele-Op-L4Make") * 5 +
      reefscape2025Count(row, headerIndex, "Tele-Op-L3Make") * 4 +
      reefscape2025Count(row, headerIndex, "Tele-Op-L2Make") * 3 +
      reefscape2025Count(row, headerIndex, "Tele-Op-TroughMake") * 2;
    const algaePoints =
      reefscape2025Count(row, headerIndex, "Tele-Op-ScoredProcessorMake") * 6 +
      reefscape2025Count(row, headerIndex, "Tele-Op-ScoredBargeMake") * 4;
    const climbPoints = reefscape2025ClimbPoints(eventSheetCell(row, headerIndex, "Climbing"));
    return {
      matchNumber: numericValue(eventSheetCell(row, headerIndex, "MatchNumber")),
      teamNumber: team.teamNumber,
      scoutUser: eventSheetCell(row, headerIndex, "ScouterName") || "Imported Sheet",
      alliance: team.alliance || "unknown",
      station: team.station || String(numericValue(eventSheetCell(row, headerIndex, "StartingPosition")) || "sheet"),
      defensePlayed: numericValue(eventSheetCell(row, headerIndex, "DidTheyPLAYDefense?HowEffective?")) > 0,
      robotStatus: "ok",
      notes: eventSheetCell(row, headerIndex, "Notes"),
      metrics: {
        auto: autoPoints,
        coral: coralPoints,
        algae: algaePoints,
        climb: climbPoints,
        autoL4Made: reefscape2025Count(row, headerIndex, "Auto-L4Make"),
        autoL4Missed: reefscape2025Count(row, headerIndex, "Auto-L4Miss"),
        autoL3Made: reefscape2025Count(row, headerIndex, "Auto-L3Make"),
        autoL3Missed: reefscape2025Count(row, headerIndex, "Auto-L3Miss"),
        autoL2Made: reefscape2025Count(row, headerIndex, "Auto-L2Make"),
        autoL2Missed: reefscape2025Count(row, headerIndex, "Auto-L2Miss"),
        autoTroughMade: reefscape2025Count(row, headerIndex, "Auto-TroughMake"),
        autoTroughMissed: reefscape2025Count(row, headerIndex, "Auto-TroughMiss"),
        autoRemovedAlgaeMade: reefscape2025Count(row, headerIndex, "Auto-RemovedAlgaeMake"),
        autoRemovedAlgaeMissed: reefscape2025Count(row, headerIndex, "Auto-RemovedAlgaeMiss"),
        autoProcessorMade: reefscape2025Count(row, headerIndex, "Auto-ScoredProcessorMake"),
        autoProcessorMissed: reefscape2025Count(row, headerIndex, "Auto-ScoredProcessorMiss"),
        autoBargeMade: reefscape2025Count(row, headerIndex, "Auto-ScoredBargeMake"),
        autoBargeMissed: reefscape2025Count(row, headerIndex, "Auto-ScoredBargeMiss"),
        teleL4Made: reefscape2025Count(row, headerIndex, "Tele-Op-L4Make"),
        teleL4Missed: reefscape2025Count(row, headerIndex, "Tele-Op-L4Miss"),
        teleL3Made: reefscape2025Count(row, headerIndex, "Tele-Op-L3Make"),
        teleL3Missed: reefscape2025Count(row, headerIndex, "Tele-Op-L3Miss"),
        teleL2Made: reefscape2025Count(row, headerIndex, "Tele-Op-L2Make"),
        teleL2Missed: reefscape2025Count(row, headerIndex, "Tele-Op-L2Miss"),
        teleTroughMade: reefscape2025Count(row, headerIndex, "Tele-Op-TroughMake"),
        teleTroughMissed: reefscape2025Count(row, headerIndex, "Tele-Op-TroughMiss"),
        teleRemovedAlgaeMade: reefscape2025Count(row, headerIndex, "Tele-Op-RemovedAlgaeMake"),
        teleRemovedAlgaeMissed: reefscape2025Count(row, headerIndex, "Tele-Op-RemovedAlgaeMiss"),
        teleProcessorMade: reefscape2025Count(row, headerIndex, "Tele-Op-ScoredProcessorMake"),
        teleProcessorMissed: reefscape2025Count(row, headerIndex, "Tele-Op-ScoredProcessorMiss"),
        teleBargeMade: reefscape2025Count(row, headerIndex, "Tele-Op-ScoredBargeMake"),
        teleBargeMissed: reefscape2025Count(row, headerIndex, "Tele-Op-ScoredBargeMiss"),
        climbLevel: numericValue(eventSheetCell(row, headerIndex, "Climbing")),
        driverPerformance: numericValue(eventSheetCell(row, headerIndex, "DriverPerformance")),
        playedDefenseRating: numericValue(eventSheetCell(row, headerIndex, "DidTheyPLAYDefense?HowEffective?")),
        defenseOnThemRating: numericValue(eventSheetCell(row, headerIndex, "WasDefensePlayedONThem?HowEffective?")),
      },
    };
  });
  return buildCanonicalImportCsv(eventModel, records);
}

function adapt2024SheetCsv(eventModel, csvText) {
  const rows = parseCsvText(csvText);
  const headers = rows[0] || [];
  const headerIndex = eventSheetHeaderMap(headers);
  const records = rows.slice(1).filter((row) => row.some((cell) => cell)).map((row) => {
    const autoSpeaker = numericValue(eventSheetCell(row, headerIndex, "AUTO scoring \n(uncheck all but final score before continuing) [Speaker score âœ…]"));
    const autoAmp = numericValue(eventSheetCell(row, headerIndex, "AUTO scoring \n(uncheck all but final score before continuing) [Amp score âœ…]"));
    const teleAmp = numericValue(eventSheetCell(row, headerIndex, "Tele-op scoring \n(uncheck all but final score before continuing) [Amp score âœ…]"));
    const teleSpeaker = numericValue(eventSheetCell(row, headerIndex, "Tele-op scoring \n(uncheck all but final score before continuing) [Speaker score âœ…]"));
    return {
      matchNumber: numericValue(eventSheetCell(row, headerIndex, "Match #?")),
      teamNumber: numericValue(eventSheetCell(row, headerIndex, "Team #?")),
      scoutUser: eventSheetCell(row, headerIndex, "Timestamp") || "Imported Sheet",
      alliance: "unknown",
      station: eventSheetCell(row, headerIndex, "Starting location?") || "sheet",
      defensePlayed: !["", "no", "none", "na", "n/a"].includes(normalizeImportToken(eventSheetCell(row, headerIndex, "Did this robot PLAY defence? If so how effectively?"))),
      robotStatus: normalizeImportToken(eventSheetCell(row, headerIndex, "Did the robot break on the field?")) === "yes" ? "broken" : "ok",
      notes: eventSheetCell(row, headerIndex, "Other notes?"),
      metrics: {
        auto: autoSpeaker + autoAmp + numericValue(eventSheetCell(row, headerIndex, "AUTO [Note passes]")),
        speaker: teleSpeaker + numericValue(eventSheetCell(row, headerIndex, "Tele-op [Note passes]")),
        amp: teleAmp,
        trap:
          categoricalScore(eventSheetCell(row, headerIndex, "Scored trap?"), { successfulattempt: 1 }) +
          categoricalScore(eventSheetCell(row, headerIndex, "Harmony? (2 robots on the same chain)"), { successfulattempt: 1 }),
        autoSpeakerMade: autoSpeaker,
        autoSpeakerMissed: numericValue(eventSheetCell(row, headerIndex, "AUTO scoring \n(uncheck all but final score before continuing) [Speaker miss Ã¢ÂÅ’]")),
        autoAmpMade: autoAmp,
        autoAmpMissed: numericValue(eventSheetCell(row, headerIndex, "AUTO scoring \n(uncheck all but final score before continuing) [Amp miss Ã¢ÂÅ’]")),
        teleSpeakerMade: teleSpeaker,
        teleSpeakerMissed: numericValue(eventSheetCell(row, headerIndex, "Tele-op scoring \n(uncheck all but final score before continuing) [Speaker miss Ã¢ÂÅ’]")),
        teleAmpMade: teleAmp,
        teleAmpMissed: numericValue(eventSheetCell(row, headerIndex, "Tele-op scoring \n(uncheck all but final score before continuing) [Amp miss Ã¢ÂÅ’]")),
        driverPerformance: leadingNumericValue(eventSheetCell(row, headerIndex, "Driver skill?")),
        playedDefenseRating: defenseEffectivenessScore(eventSheetCell(row, headerIndex, "Did this robot PLAY defence? If so how effectively?")),
        defenseOnThemRating: defenseEffectivenessScore(eventSheetCell(row, headerIndex, "Was defence played ON this robot? If so, how effectively?")),
        climbSuccess: categoricalScore(eventSheetCell(row, headerIndex, "Climb?"), { successfulattempt: 1 }),
        trapSuccess: categoricalScore(eventSheetCell(row, headerIndex, "Scored trap?"), { successfulattempt: 1 }),
        harmonySuccess: categoricalScore(eventSheetCell(row, headerIndex, "Harmony? (2 robots on the same chain)"), { successfulattempt: 1 }),
      },
    };
  });
  return buildCanonicalImportCsv(eventModel, records);
}

function adapt2026SheetCsv(eventModel, csvText) {
  const rows = parseCsvText(csvText);
  const headers = rows[0] || [];
  const headerIndex = eventSheetHeaderMap(headers);
  const defenseHeaders = [
    "Shifts Transition Defense On",
    "Shifts Shift1 Defense On",
    "Shifts Shift2 Defense On",
    "Shifts Shift3 Defense On",
    "Shifts Shift4 Defense On",
    "Shifts Endgame Defense On",
  ];
  const records = rows.slice(1).filter((row) => row.some((cell) => cell)).map((row) => {
    const autoFuel = numericValue(eventSheetCell(row, headerIndex, "Shifts Auto Fuel Pct"));
    const cycleFuel = ["Shifts Transition Fuel Pct", "Shifts Shift1 Fuel Pct", "Shifts Shift2 Fuel Pct", "Shifts Shift3 Fuel Pct", "Shifts Shift4 Fuel Pct"].reduce(
      (sum, header) => sum + numericValue(eventSheetCell(row, headerIndex, header)),
      0,
    );
    const endgameFuel = numericValue(eventSheetCell(row, headerIndex, "Shifts Endgame Fuel Pct"));
    const climbScore =
      categoricalScore(eventSheetCell(row, headerIndex, "Shifts Auto Climb"), { climbed: 15, successfulattempt: 15 }) +
      categoricalScore(eventSheetCell(row, headerIndex, "Shifts Endgame Climb"), { climbed: 20, successfulattempt: 20, parked: 8 });
    return {
      matchNumber: numericValue(eventSheetCell(row, headerIndex, "Match Number")),
      teamNumber: numericValue(eventSheetCell(row, headerIndex, "Team Number")),
      scoutUser: eventSheetCell(row, headerIndex, "Scouter") || "Imported Sheet",
      alliance: eventSheetCell(row, headerIndex, "Alliance").toLowerCase() || "unknown",
      station: eventSheetCell(row, headerIndex, "Shifts Auto Starting Position") || "sheet",
      defensePlayed: defenseHeaders.some((header) => !["", "none"].includes(normalizeImportToken(eventSheetCell(row, headerIndex, header)))) || numericValue(eventSheetCell(row, headerIndex, "Overall Defense")) > 0,
      robotStatus: truthyValue(eventSheetCell(row, headerIndex, "No Show")) ? "no_show" : "ok",
      notes: eventSheetCell(row, headerIndex, "Overall Notes"),
      metrics: {
        auto: autoFuel,
        cycle: cycleFuel,
        endgame: endgameFuel + climbScore,
        autoFuelPct: autoFuel,
        transitionFuelPct: numericValue(eventSheetCell(row, headerIndex, "Shifts Transition Fuel Pct")),
        shift1FuelPct: numericValue(eventSheetCell(row, headerIndex, "Shifts Shift1 Fuel Pct")),
        shift2FuelPct: numericValue(eventSheetCell(row, headerIndex, "Shifts Shift2 Fuel Pct")),
        shift3FuelPct: numericValue(eventSheetCell(row, headerIndex, "Shifts Shift3 Fuel Pct")),
        shift4FuelPct: numericValue(eventSheetCell(row, headerIndex, "Shifts Shift4 Fuel Pct")),
        endgameFuelPct: endgameFuel,
        overallShooter: numericValue(eventSheetCell(row, headerIndex, "Overall Shooter")),
        overallPasser: numericValue(eventSheetCell(row, headerIndex, "Overall Passer")),
        overallIntake: numericValue(eventSheetCell(row, headerIndex, "Overall Intake")),
        overallDriver: numericValue(eventSheetCell(row, headerIndex, "Overall Driver")),
        overallDefenseAvoidance: numericValue(eventSheetCell(row, headerIndex, "Overall Defense Avoidance")),
        overallDefense: numericValue(eventSheetCell(row, headerIndex, "Overall Defense")),
        noShow: truthyValue(eventSheetCell(row, headerIndex, "No Show")) ? 1 : 0,
      },
    };
  });
  return buildCanonicalImportCsv(eventModel, records);
}

function adaptEventSheetCsv(eventModel, csvText) {
  if (!csvText) return "";
  if (eventModel.key === "2024mdsev") return adapt2024SheetCsv(eventModel, csvText);
  if (eventModel.key === "2025chcmp") return adapt2025SheetCsv(eventModel, csvText);
  if (eventModel.key === "2026chcmp") return adapt2026SheetCsv(eventModel, csvText);
  return csvText;
}

globalThis.SheetImportAdapters = {
  adapt2024SheetCsv,
  adapt2025SheetCsv,
  adapt2026SheetCsv,
  adaptEventSheetCsv,
  buildCanonicalImportCsv,
  parseCsvText,
};
})();
