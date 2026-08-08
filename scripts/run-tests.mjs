import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The built-in `node --test` runner launches one worker process per file. The
// Windows development sandbox rejects those child-process launches with EPERM.
// Importing the existing script-style tests sequentially preserves their
// assertions while keeping the suite in one Node process.
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const testDirectory = path.join(rootDirectory, "tests");
const testFiles = (await fs.readdir(testDirectory))
  .filter((fileName) => fileName.endsWith(".test.mjs"))
  .sort((left, right) => left.localeCompare(right));

for (const fileName of testFiles) {
  await import(pathToFileURL(path.join(testDirectory, fileName)).href);
}

console.log(`PASS sequential test suite (${testFiles.length} files)`);
