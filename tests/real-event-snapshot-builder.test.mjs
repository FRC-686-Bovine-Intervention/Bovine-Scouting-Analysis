import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildRealEventSnapshots, serializeRealEventSnapshots } from "../scripts/real-event-snapshot-builder.mjs";

function runTest(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function writeFixtureFile(baseDir, fileName, content) {
  fs.writeFileSync(path.join(baseDir, fileName), content, "utf8");
}

runTest("buildRealEventSnapshots preserves full cached TBA match payloads including score_breakdown", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "snapshot-builder-"));
  writeFixtureFile(tempDir, "unit2026-tba-event.json", JSON.stringify({ name: "Unit Event" }));
  writeFixtureFile(tempDir, "unit2026-tba-teams.json", JSON.stringify([{ team_number: 1 }]));
  writeFixtureFile(
    tempDir,
    "unit2026-tba-matches.json",
    JSON.stringify([
      {
        comp_level: "qm",
        match_number: 1,
        alliances: {
          red: { team_keys: ["frc1", "frc2", "frc3"], score: 100 },
          blue: { team_keys: ["frc4", "frc5", "frc6"], score: 90 },
        },
        score_breakdown: {
          red: { auto_points: 30, teleop_points: 40 },
          blue: { auto_points: 20, teleop_points: 35 },
        },
      },
    ]),
  );
  writeFixtureFile(tempDir, "unit2026-statbotics-event.json", JSON.stringify({ status: "Completed" }));
  writeFixtureFile(tempDir, "unit2026-statbotics-team-events.json", JSON.stringify([]));
  writeFixtureFile(tempDir, "unit2026-sheet.csv", "Team,Match\n1,1\n");

  const snapshotData = buildRealEventSnapshots(
    [
      {
        key: "unit2026",
        year: 2026,
        importProfileId: "",
        sheet: {
          url: "https://example.com/sheet",
          tab: "Sheet1",
          csvUrl: "https://example.com/sheet.csv",
          access: "public_csv",
        },
      },
    ],
    {
      cacheDir: tempDir,
      generatedAt: "2026-07-05T00:00:00.000Z",
    },
  );

  const event = snapshotData.events[0];
  assert.equal(event.sheet?.sampleCsvText, "Team,Match\n1,1\n");
  const matches = JSON.parse(event.tbaMatchesText);
  assert.equal(matches[0].score_breakdown.red.auto_points, 30);
  assert.equal(matches[0].score_breakdown.blue.teleop_points, 35);

  const serialized = serializeRealEventSnapshots(snapshotData);
  assert.ok(serialized.includes("score_breakdown"));
});
