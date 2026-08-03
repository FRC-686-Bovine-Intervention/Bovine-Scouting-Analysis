import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/event-source-cache.js", import.meta.url), "utf8");
const context = { globalThis: { btoa: (value) => Buffer.from(value, "binary").toString("base64"), atob: (value) => Buffer.from(value, "base64").toString("binary") }, TextEncoder };
vm.createContext(context);
vm.runInContext(source, context);
const { maxChunkCharacters, createRawSourceArtifact, reconstructRawSourceArtifact } = context.globalThis.EventSourceCache;

function runTest(name, callback) {
  try { callback(); console.log(`PASS ${name}`); } catch (error) { console.error(`FAIL ${name}`); throw error; }
}

runTest("preserves raw provider text byte-for-byte across safe chunks", () => {
  const rawText = `\ufeff${"é".repeat(maxChunkCharacters)}\n{"exact":true}\n`;
  const artifact = createRawSourceArtifact({ sourceId: "tba-matches", rawText, sourceUrl: "https://example.test/matches", contentType: "application/json", status: 200, fetchedAt: "2026-08-02T00:00:00.000Z" });
  assert.equal(artifact.manifest.chunkCount, 2);
  assert.ok(artifact.chunks.every((chunk) => chunk.text.length <= maxChunkCharacters));
  assert.equal(reconstructRawSourceArtifact(artifact.manifest, artifact.chunks), rawText);
});

runTest("rejects incomplete and corrupted raw artifacts", () => {
  const artifact = createRawSourceArtifact({ sourceId: "scouting", rawText: "a,b\n1,2\n" });
  assert.throws(() => reconstructRawSourceArtifact(artifact.manifest, []), /incomplete/);
  assert.throws(() => reconstructRawSourceArtifact(artifact.manifest, [{ index: 0, text: "changed" }]), /fingerprint/);
});

runTest("preserves non-text response bytes through base64 chunks", () => {
  const rawBytes = Uint8Array.from([0, 255, 10, 195, 40]);
  const artifact = createRawSourceArtifact({ sourceId: "binary-provider", rawBytes });
  assert.equal(artifact.manifest.encoding, "base64");
  assert.deepEqual([...reconstructRawSourceArtifact(artifact.manifest, artifact.chunks)], [...rawBytes]);
});
