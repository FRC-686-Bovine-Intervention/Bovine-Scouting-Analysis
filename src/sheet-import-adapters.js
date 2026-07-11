(function () {
const seasonFramework = globalThis.SeasonFramework || {};
const seasonFormulaFieldDefinitions = seasonFramework.formulaFieldDefinitions || (seasonFramework.scouterMetricDefinitions || ((eventModel) => eventModel?.scoringComponents || []));
const seasonMetricFieldId = seasonFramework.csvHeaderForMetric || ((metricDefinition) => (metricDefinition.unit === "pts" ? `${metricDefinition.id}Pts` : metricDefinition.id));

const seasonSheetTranslators = {
  2024: {
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
        metrics: {
          auto: autoSpeaker + autoAmp,
          speaker: teleSpeaker,
          amp: teleAmp,
          trap: 0,
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
  2025: {
    version: "2025-thin-v2",
    translateRow(rowTools) {
      const autoPoints =
        rowTools.number("Auto-L3Make") * 6 +
        rowTools.number("Auto-L2Make") * 4 +
        rowTools.number("Auto-TroughMake") * 3 +
        rowTools.number("Auto-ScoredProcessorMake") * 6 +
        rowTools.number("Auto-ScoredBargeMake") * 4;
      const coralPoints =
        rowTools.number("Tele-Op-L4Make") * 5 +
        rowTools.number("Tele-Op-L3Make") * 4 +
        rowTools.number("Tele-Op-L2Make") * 3 +
        rowTools.number("Tele-Op-TroughMake") * 2;
      const algaePoints =
        rowTools.number("Tele-Op-ScoredProcessorMake") * 6 +
        rowTools.number("Tele-Op-ScoredBargeMake") * 4;
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
        metrics: {
          auto: autoPoints,
          coral: coralPoints,
          algae: algaePoints,
          climb: reefscape2025ClimbPoints(climbLevel),
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
  2026: {
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
      const climbScore =
        rowTools.categoricalScore("Shifts Auto Climb", { climbed: 15, successfulattempt: 15 }) +
        rowTools.categoricalScore("Shifts Endgame Climb", { climbed: 20, successfulattempt: 20, parked: 8 });

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
        metrics: {
          alliance: rowTools.text("Alliance"),
          startingPosition: rowTools.text("Shifts Auto Starting Position"),
          auto: autoFuel,
          cycle: transitionFuel + shift1Fuel + shift2Fuel + shift3Fuel + shift4Fuel,
          endgame: endgameFuel + climbScore,
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
};

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

function translatorForEvent(eventModel) {
  return seasonSheetTranslators[Number(eventModel?.season)] || null;
}

function importTranslationVersionForEvent(eventModel) {
  return translatorForEvent(eventModel)?.version || "";
}

function buildCanonicalImportCsv(eventModel, records) {
  const metadataRow = ["meta", "season", "eventKey", "schemaVersion", "templateProfileId"];
  const valueRow = ["value", eventModel.season, eventModel.key, "match-v2", "match-current-v2"];
  const metricDefinitions = seasonFormulaFieldDefinitions(eventModel);
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
    ...metricDefinitions.map((metricDefinition) => record.metrics[metricDefinition.id] ?? ""),
  ]);
  return toCsvText([metadataRow, valueRow, [], headerRow, ...dataRows]);
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

function adaptEventSheetCsv(eventModel, csvText) {
  if (!csvText) return "";
  const translator = translatorForEvent(eventModel);
  if (!translator) return csvText;

  const rows = parseCsvText(csvText);
  const headers = rows[0] || [];
  const headerIndex = eventSheetHeaderMap(headers);
  const records = rows
    .slice(1)
    .filter((row) => row.some((cell) => cell))
    .map((row) => {
      const rowTools = createRowTools(row, headerIndex);
      if (translator.filterRow && !translator.filterRow(rowTools, eventModel)) return null;
      return translator.translateRow(rowTools, eventModel);
    })
    .filter(Boolean);

  return buildCanonicalImportCsv(eventModel, records);
}

globalThis.SheetImportAdapters = {
  adapt2024SheetCsv: (eventModel, csvText) => adaptEventSheetCsv({ ...eventModel, season: 2024 }, csvText),
  adapt2025SheetCsv: (eventModel, csvText) => adaptEventSheetCsv({ ...eventModel, season: 2025 }, csvText),
  adapt2026SheetCsv: (eventModel, csvText) => adaptEventSheetCsv({ ...eventModel, season: 2026 }, csvText),
  adaptEventSheetCsv,
  buildCanonicalImportCsv,
  importTranslationVersionForEvent,
  parseCsvText,
};
})();
