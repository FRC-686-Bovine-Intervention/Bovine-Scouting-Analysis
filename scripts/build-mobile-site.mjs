import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = resolve(repositoryRoot, ".firebase", "mobile-site");
const requiredFiles = [
  ["mobile.html", "index.html"],
  ["src/mobile-alliance.css", "src/mobile-alliance.css"],
  ["src/mobile-alliance-display.js", "src/mobile-alliance-display.js"],
  ["src/mobile-alliance-viewer.js", "src/mobile-alliance-viewer.js"],
  ["src/firebase-mobile-display.js", "src/firebase-mobile-display.js"],
  ["src/firebase-config.js", "src/firebase-config.js"],
  ["src/firebase-environment.mjs", "src/firebase-environment.mjs"],
];

await rm(outputRoot, { recursive: true, force: true });
for (const [sourcePath, outputPath] of requiredFiles) {
  const destination = resolve(outputRoot, outputPath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(repositoryRoot, sourcePath), destination);
}

console.log(`Built ${requiredFiles.length} mobile Hosting files in ${outputRoot}`);
